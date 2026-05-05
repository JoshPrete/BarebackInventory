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
  skusCreated: number;
  skusUpdated: number;
}

/**
 * Pull all products + variants from Shopify and upsert into:
 *   - ShopifyProduct / ShopifyVariant (catalog mirror)
 *   - SellableSKU (one per variant, using Shopify SKU as the unique code)
 *   - ShopifyVariantMapping (links SellableSKU ↔ ShopifyVariant)
 *
 * Idempotent: safe to run multiple times. Existing rows are updated, not duplicated.
 * Running order: ShopifyProduct → ShopifyVariant → SellableSKU → ShopifyVariantMapping.
 */
export async function syncShopifyCatalog(): Promise<SyncCatalogResult> {
  const adapter = getAdapter();
  const products = await adapter.fetchProducts();

  let productsUpserted = 0;
  let variantsUpserted = 0;
  let skusCreated = 0;
  let skusUpdated = 0;

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
          inventoryQuantity: variant.inventoryQuantity,
        },
        update: {
          title: variant.title,
          sku: variant.sku,
          price: variant.price,
          inventoryItemGid: variant.inventoryItemGid,
          inventoryQuantity: variant.inventoryQuantity,
          updatedAt: new Date(),
        },
      });
      variantsUpserted++;

      // Derive a stable SKU code and human name from Shopify data.
      // "Default Title" is Shopify's placeholder for single-variant products — omit it.
      const skuCode =
        variant.sku?.trim() ||
        `SHOPIFY-${variant.shopifyVariantGid.split("/").pop()}`;
      const skuName =
        variant.title === "Default Title"
          ? product.title
          : `${product.title} — ${variant.title}`;

      // Check whether this variant already has a mapping (i.e. was synced before).
      const existingMapping = await prisma.shopifyVariantMapping.findFirst({
        where: { shopifyVariantGid: variant.shopifyVariantGid },
        select: { sellableSkuId: true },
      });

      if (existingMapping) {
        // Variant already linked — update the SKU name in case product/variant title changed.
        await prisma.sellableSKU.update({
          where: { id: existingMapping.sellableSkuId },
          data: { name: skuName },
        });
        // Keep inventoryItemGid current on the mapping.
        if (variant.inventoryItemGid) {
          await prisma.shopifyVariantMapping.update({
            where: { sellableSkuId: existingMapping.sellableSkuId },
            data: { shopifyInventoryItemGid: variant.inventoryItemGid },
          });
        }
        skusUpdated++;
      } else {
        // No mapping yet — upsert SellableSKU by sku code, then link it.
        // Upsert handles the case where a SellableSKU was manually created
        // with the same SKU code before this sync ran.
        const sellableSku = await prisma.sellableSKU.upsert({
          where: { sku: skuCode },
          create: { name: skuName, sku: skuCode, isBundle: false },
          update: { name: skuName },
        });

        await prisma.shopifyVariantMapping.upsert({
          where: { sellableSkuId: sellableSku.id },
          create: {
            sellableSkuId: sellableSku.id,
            shopifyVariantGid: variant.shopifyVariantGid,
            shopifyInventoryItemGid: variant.inventoryItemGid ?? null,
          },
          update: {
            shopifyVariantGid: variant.shopifyVariantGid,
            shopifyInventoryItemGid: variant.inventoryItemGid ?? null,
          },
        });
        skusCreated++;
      }
    }
  }

  return { productsUpserted, variantsUpserted, skusCreated, skusUpdated };
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
  ordersFetched: number;
  ordersImported: number;
  ordersSkipped: number; // already in ledger
  lineItemsImported: number;
  lineItemsSkipped: number; // no ShopifyVariantMapping for this variant
  deductionWarnings: number;    // lines where packed stock was missing or insufficient
  componentWarnings: number;    // BOM / component stock warnings across all lines
  errors: string[];
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

  console.log(`[shopify/orders] Fetched ${orders.length} order(s) from Shopify${sinceIso ? ` since ${sinceIso}` : ""}`);

  let ordersImported = 0;
  let ordersSkipped = 0;
  let lineItemsImported = 0;
  let lineItemsSkipped = 0;
  let deductionWarnings = 0;
  let componentWarnings = 0;
  const errors: string[] = [];

  for (const order of orders) {
    console.log(`[shopify/orders] Processing order ${order.shopifyOrderGid} (${order.orderNumber ? `#${order.orderNumber}` : "no number"})`);

    // Dedup check: has this Shopify order GID already been imported?
    const existing = await prisma.manualSale.findFirst({
      where: { orderRef: order.shopifyOrderGid },
      select: { id: true },
    });

    if (existing) {
      console.log(`[shopify/orders] Skipping ${order.shopifyOrderGid} — already imported`);
      ordersSkipped++;
      continue;
    }

    try {
      const result = await recordShopifyOrder(order);
      ordersImported++;
      lineItemsImported += result.linesImported;
      lineItemsSkipped += result.linesSkipped;
      deductionWarnings += result.deductionWarnings;
      componentWarnings += result.componentWarnings;
      console.log(`[shopify/orders] Imported ${order.shopifyOrderGid} — lines: ${result.linesImported} imported, ${result.linesSkipped} skipped, ${result.deductionWarnings} deduction warnings`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[shopify/orders] Failed to import order ${order.shopifyOrderGid}:`, err);
      errors.push(`Order ${order.shopifyOrderGid}: ${msg}`);
    }
  }

  console.log(`[shopify/orders] Done — imported: ${ordersImported}, skipped: ${ordersSkipped}, errors: ${errors.length}`);

  return { ordersFetched: orders.length, ordersImported, ordersSkipped, lineItemsImported, lineItemsSkipped, deductionWarnings, componentWarnings, errors };
}
