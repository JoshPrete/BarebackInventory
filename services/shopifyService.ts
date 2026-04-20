/**
 * Shopify service — owns all business logic for syncing Shopify catalog
 * and orders into internal tables. Depends on a ShopifyAdapter (never
 * calls the Shopify API directly) and a data-layer module (never
 * imports Prisma directly in page components).
 */

import { prisma } from "@/lib/prisma";
import { mockShopifyAdapter } from "@/adapters/shopify/mockShopifyAdapter";
import { liveShopifyAdapter } from "@/adapters/shopify/liveShopifyAdapter";
import { isShopifyConfigured } from "@/lib/shopify/config";
import type { ShopifyAdapter } from "@/adapters/shopify/types";
import { recordShopifyOrder } from "@/services/salesProcessingService";

function getAdapter(): ShopifyAdapter {
  return isShopifyConfigured() ? liveShopifyAdapter : mockShopifyAdapter;
}

// ─── Catalog sync ─────────────────────────────────────────────────────────────

export interface SyncCatalogResult {
  productsUpserted: number;
  variantsUpserted: number;
}

/**
 * Pull all products + variants from Shopify and upsert into
 * ShopifyProduct / ShopifyVariant tables.
 */
export async function syncShopifyCatalog(): Promise<SyncCatalogResult> {
  const adapter = getAdapter();
  const products = await adapter.fetchProducts();

  let productsUpserted = 0;
  let variantsUpserted = 0;

  for (const product of products) {
    await prisma.shopifyProduct.upsert({
      where: { shopifyProductGid: product.shopifyProductGid },
      create: {
        shopifyProductGid: product.shopifyProductGid,
        title: product.title,
        handle: product.handle,
        status: product.status,
      },
      update: {
        title: product.title,
        handle: product.handle,
        status: product.status,
        updatedAt: new Date(),
      },
    });
    productsUpserted++;

    for (const variant of product.variants) {
      await prisma.shopifyVariant.upsert({
        where: { shopifyVariantGid: variant.shopifyVariantGid },
        create: {
          shopifyVariantGid: variant.shopifyVariantGid,
          shopifyProductGid: variant.shopifyProductGid,
          title: variant.title,
          sku: variant.sku,
          price: variant.price,
          inventoryItemGid: variant.inventoryItemGid,
        },
        update: {
          title: variant.title,
          sku: variant.sku,
          price: variant.price,
          inventoryItemGid: variant.inventoryItemGid,
          updatedAt: new Date(),
        },
      });
      variantsUpserted++;
    }
  }

  return { productsUpserted, variantsUpserted };
}

// ─── Variant mapping queue ────────────────────────────────────────────────────

export interface VariantMappingRow {
  shopifyVariantGid: string;
  shopifyProductGid: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  price: string;
  /** Present when this variant has a ShopifyVariantMapping row. */
  mappedSkuId: string | null;
  mappedSkuCode: string | null;
  mappedSkuName: string | null;
}

/**
 * Return all synced Shopify variants with their current mapping status.
 * Ordered by product GID then variant title.
 *
 * ShopifyVariantMapping is keyed by sellableSkuId (unique) with shopifyVariantGid
 * as an indexed string — no FK from ShopifyVariant. Join is done in memory.
 */
export async function getVariantMappingQueue(): Promise<VariantMappingRow[]> {
  const [variants, mappings] = await Promise.all([
    prisma.shopifyVariant.findMany({
      orderBy: [{ shopifyProductGid: "asc" }, { title: "asc" }],
      select: {
        shopifyVariantGid: true,
        shopifyProductGid: true,
        title: true,
        sku: true,
        price: true,
        product: { select: { title: true } },
      },
    }),
    prisma.shopifyVariantMapping.findMany({
      select: {
        shopifyVariantGid: true,
        sellableSkuId: true,
        sellableSku: { select: { sku: true, name: true } },
      },
    }),
  ]);

  const mappingByVariantGid = new Map(
    mappings.map((m) => [m.shopifyVariantGid, m]),
  );

  return variants.map((v) => {
    const mapping = mappingByVariantGid.get(v.shopifyVariantGid);
    return {
      shopifyVariantGid: v.shopifyVariantGid,
      shopifyProductGid: v.shopifyProductGid,
      productTitle: v.product.title,
      variantTitle: v.title,
      sku: v.sku,
      price: v.price,
      mappedSkuId: mapping?.sellableSkuId ?? null,
      mappedSkuCode: mapping?.sellableSku.sku ?? null,
      mappedSkuName: mapping?.sellableSku.name ?? null,
    };
  });
}

// ─── Order sync ───────────────────────────────────────────────────────────────

export interface SyncOrdersResult {
  ordersImported: number;
  ordersSkipped: number; // already in ledger
  lineItemsImported: number;
  lineItemsSkipped: number; // no ShopifyVariantMapping for this variant
  deductionWarnings: number;    // lines where packed stock was missing or insufficient
  componentWarnings: number;    // BOM / component stock warnings across all lines
}

/**
 * Pull orders from the Shopify adapter and import any that are not yet in
 * the internal sales ledger (ManualSale).
 *
 * Deduplication: an order is considered already imported when a ManualSale
 * row exists with orderRef equal to the Shopify order GID. Duplicate syncs
 * are safe — existing orders are skipped, not re-inserted.
 *
 * Packed stock deductions are triggered via inventoryService after each order is recorded.
 */
export async function syncShopifyOrders(
  sinceIso?: string,
): Promise<SyncOrdersResult> {
  const adapter = getAdapter();
  const orders = await adapter.fetchOrders(sinceIso);

  let ordersImported = 0;
  let ordersSkipped = 0;
  let lineItemsImported = 0;
  let lineItemsSkipped = 0;
  let deductionWarnings = 0;
  let componentWarnings = 0;

  for (const order of orders) {
    // Dedup check: has this Shopify order GID already been imported?
    const existing = await prisma.manualSale.findFirst({
      where: { orderRef: order.shopifyOrderGid },
      select: { id: true },
    });

    if (existing) {
      ordersSkipped++;
      continue;
    }

    const result = await recordShopifyOrder(order);
    ordersImported++;
    lineItemsImported += result.linesImported;
    lineItemsSkipped += result.linesSkipped;
    deductionWarnings += result.deductionWarnings;
    componentWarnings += result.componentWarnings;
  }

  return { ordersImported, ordersSkipped, lineItemsImported, lineItemsSkipped, deductionWarnings, componentWarnings };
}
