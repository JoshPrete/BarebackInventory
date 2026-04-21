/**
 * Shopify inventory adjustment helpers.
 *
 * Used after a packing run to push the stock increase to Shopify so that
 * Shopify stays in sync with internal production records.
 *
 * Architecture:
 *   - This app is the source of truth for production and ingredients.
 *   - Shopify is the source of truth for sales.
 *   - After every packing run, we push the delta to Shopify so the dashboard
 *     (which reads live Shopify inventoryQuantity) reflects the new stock.
 *
 * If Shopify is not configured or the push fails, the DB transaction has
 * already committed — caller should surface a warning, not an error.
 */

import { shopifyAdminGraphql } from "./admin";
import { isShopifyConfigured } from "./config";
import { prisma } from "@/lib/prisma";

// ─── GraphQL ──────────────────────────────────────────────────────────────────

const GET_LOCATIONS_QUERY = `
  query GetFirstLocation {
    locations(first: 1) {
      edges {
        node { id name }
      }
    }
  }
`;

const GET_VARIANT_INVENTORY_ITEM_QUERY = `
  query GetVariantInventoryItem($id: ID!) {
    productVariant(id: $id) {
      inventoryItem { id }
    }
  }
`;

const ADJUST_INVENTORY_MUTATION = `
  mutation AdjustInventory($input: InventoryAdjustQuantitiesInput!) {
    inventoryAdjustQuantities(input: $input) {
      userErrors {
        field
        message
      }
      inventoryAdjustmentGroup {
        changes {
          delta
          quantityAfterChange
        }
      }
    }
  }
`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocationsResponse {
  locations: {
    edges: { node: { id: string; name: string } }[];
  };
}

interface VariantInventoryItemResponse {
  productVariant: { inventoryItem: { id: string } } | null;
}

interface AdjustInventoryResponse {
  inventoryAdjustQuantities: {
    userErrors: { field: string; message: string }[];
    inventoryAdjustmentGroup: {
      changes: { delta: number; quantityAfterChange: number }[];
    } | null;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the Shopify GID of the first active location. Cached per process. */
let cachedLocationId: string | null = null;

async function getDefaultLocationId(): Promise<string | null> {
  if (cachedLocationId) return cachedLocationId;

  const res = await shopifyAdminGraphql<LocationsResponse>(GET_LOCATIONS_QUERY);
  const id = res.data?.locations.edges[0]?.node.id ?? null;
  if (id) cachedLocationId = id;
  return id;
}

/**
 * Returns the inventoryItemGid for a SKU's Shopify variant.
 * If the mapping already stores it, returns immediately.
 * Otherwise fetches from Shopify and persists it back for future calls.
 */
async function resolveInventoryItemGid(sellableSkuId: string): Promise<string | null> {
  const mapping = await prisma.shopifyVariantMapping.findUnique({
    where: { sellableSkuId },
    select: { id: true, shopifyVariantGid: true, shopifyInventoryItemGid: true },
  });

  if (!mapping) return null;
  if (mapping.shopifyInventoryItemGid) return mapping.shopifyInventoryItemGid;

  // Fetch from Shopify and cache in DB.
  const res = await shopifyAdminGraphql<VariantInventoryItemResponse>(
    GET_VARIANT_INVENTORY_ITEM_QUERY,
    { id: mapping.shopifyVariantGid },
  );

  const inventoryItemGid = res.data?.productVariant?.inventoryItem?.id ?? null;
  if (!inventoryItemGid) return null;

  await prisma.shopifyVariantMapping.update({
    where: { id: mapping.id },
    data: { shopifyInventoryItemGid: inventoryItemGid },
  });

  return inventoryItemGid;
}

// ─── Public ───────────────────────────────────────────────────────────────────

export type AdjustShopifyInventoryResult =
  | { ok: true; quantityAfterChange: number }
  | { ok: false; error: string };

/**
 * Pushes a stock delta to Shopify after a packing run.
 *
 * Returns ok:false (with a human-readable error) rather than throwing, so the
 * caller can surface a warning without rolling back the DB transaction.
 */
export async function adjustShopifyInventory(
  sellableSkuId: string,
  delta: number,
): Promise<AdjustShopifyInventoryResult> {
  if (!isShopifyConfigured()) {
    return { ok: false, error: "Shopify is not configured — stock not synced." };
  }

  const [inventoryItemGid, locationId] = await Promise.all([
    resolveInventoryItemGid(sellableSkuId),
    getDefaultLocationId(),
  ]);

  if (!inventoryItemGid) {
    return {
      ok: false,
      error: "No Shopify variant mapping found for this SKU — update the mapping and sync manually.",
    };
  }

  if (!locationId) {
    return { ok: false, error: "Could not retrieve Shopify location — sync manually." };
  }

  const res = await shopifyAdminGraphql<AdjustInventoryResponse>(ADJUST_INVENTORY_MUTATION, {
    input: {
      reason: "received",
      name: "Packing run",
      changes: [{ inventoryItemId: inventoryItemGid, locationId, delta }],
    },
  });

  const userErrors = res.data?.inventoryAdjustQuantities.userErrors ?? [];
  if (userErrors.length > 0 || res.errors?.length) {
    const messages = [
      ...(res.errors ?? []).map((e) => e.message),
      ...userErrors.map((e) => `${e.field}: ${e.message}`),
    ];
    return { ok: false, error: `Shopify sync failed: ${messages.join("; ")}` };
  }

  const change = res.data?.inventoryAdjustQuantities.inventoryAdjustmentGroup?.changes[0];
  return { ok: true, quantityAfterChange: change?.quantityAfterChange ?? 0 };
}
