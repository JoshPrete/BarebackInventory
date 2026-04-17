/**
 * Shopify service — owns all business logic for syncing Shopify catalog
 * and orders into internal tables. Depends on a ShopifyAdapter (never
 * calls the Shopify API directly) and a data-layer module (never
 * imports Prisma directly in page components).
 */

import { prisma } from "@/lib/prisma";
import { mockShopifyAdapter } from "@/adapters/shopify/mockShopifyAdapter";
import type { ShopifyAdapter } from "@/adapters/shopify/types";
import { recordShopifyOrder } from "@/services/salesProcessingService";

// Resolve adapter from env flag or DI when the live adapter is ready.
function getAdapter(): ShopifyAdapter {
  return mockShopifyAdapter;
}

// ─── Catalog sync (stub) ─────────────────────────────────────────────────────

export interface SyncCatalogResult {
  productsUpserted: number;
  variantsUpserted: number;
}

/**
 * Pull all products + variants from Shopify and upsert into
 * ShopifyProduct / ShopifyVariant tables.
 * TODO: implement in the catalog-sync task.
 */
export async function syncShopifyCatalog(): Promise<SyncCatalogResult> {
  const adapter = getAdapter();
  const products = await adapter.fetchProducts();
  void products;
  return { productsUpserted: 0, variantsUpserted: 0 };
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
