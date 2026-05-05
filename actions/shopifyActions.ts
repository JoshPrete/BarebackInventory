"use server";
/**
 * Shopify server actions — the only entry points for UI-triggered Shopify
 * operations. UI components call these; they delegate to shopifyService
 * and bomService. No Prisma imports here.
 */

import { revalidatePath } from "next/cache";
import {
  syncShopifyCatalog as _syncCatalog,
  syncShopifyOrders as _syncOrders,
  type SyncCatalogResult,
  type SyncOrdersResult,
} from "@/services/shopifyService";
import {
  mapVariantToSku as _mapVariantToSku,
  type MapVariantToSkuInput,
  type MapVariantToSkuResult,
} from "@/services/bomService";

export async function syncShopifyCatalog(): Promise<SyncCatalogResult> {
  return _syncCatalog();
}

export async function syncShopifyOrders(
  sinceIso?: string,
): Promise<SyncOrdersResult> {
  return _syncOrders(sinceIso);
}

export async function mapVariantToSku(
  input: MapVariantToSkuInput,
): Promise<MapVariantToSkuResult> {
  return _mapVariantToSku(input);
}

// ─── Typed result for UI-facing form actions ──────────────────────────────────

export type SyncCatalogActionResult = {
  ok: true;
  productsUpserted: number;
  variantsUpserted: number;
  skusCreated: number;
  skusUpdated: number;
  ordersImported: number;
  ordersSkipped: number;
  lineItemsImported: number;
  orderErrors: string[];
} | {
  ok: false;
  error: string;
};

/**
 * FormData wrapper for syncShopifyCatalog + syncShopifyOrders.
 * Runs both in sequence. Never throws: errors are returned as { ok: false, error }.
 *
 * Orders sync runs after catalog sync so that ShopifyVariantMapping rows
 * exist before we try to resolve variant GIDs → sellableSkuIds.
 * Orders default to the last 30 days with financial_status:paid.
 */
export async function syncCatalogFormAction(
  _prev: SyncCatalogActionResult | null,
  _formData: FormData,
): Promise<SyncCatalogActionResult> {
  try {
    const catalog = await _syncCatalog();

    // Orders sync runs after catalog so new mappings are available.
    const orders = await _syncOrders();

    revalidatePath("/shopify-sync");
    revalidatePath("/skus");
    revalidatePath("/dashboard");
    revalidatePath("/sales");

    return {
      ok: true,
      productsUpserted: catalog.productsUpserted,
      variantsUpserted: catalog.variantsUpserted,
      skusCreated: catalog.skusCreated,
      skusUpdated: catalog.skusUpdated,
      ordersImported: orders.ordersImported,
      ordersSkipped: orders.ordersSkipped,
      lineItemsImported: orders.lineItemsImported,
      orderErrors: orders.errors,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[syncCatalogFormAction] Sync failed:", message);
    // Provide scope-specific guidance in the error message.
    const hint =
      message.includes("read_products") ? " — ensure read_products scope is enabled on your Shopify custom app" :
      message.includes("read_orders") ? " — ensure read_orders scope is enabled on your Shopify custom app" :
      message.includes("read_inventory") ? " — ensure read_inventory scope is enabled on your Shopify custom app" :
      "";
    return { ok: false, error: `${message}${hint}` };
  }
}

/**
 * FormData wrapper for mapVariantToSku — called from per-row <form> actions.
 * Expects fields: shopifyVariantGid, sellableSkuId.
 * Revalidates /shopify-sync so the mapping status updates.
 */
export async function mapVariantFormAction(
  formData: FormData,
): Promise<void> {
  const shopifyVariantGid = formData.get("shopifyVariantGid");
  const sellableSkuId = formData.get("sellableSkuId");

  if (
    typeof shopifyVariantGid !== "string" ||
    !shopifyVariantGid ||
    typeof sellableSkuId !== "string" ||
    !sellableSkuId
  ) {
    return;
  }

  await _mapVariantToSku({ shopifyVariantGid, sellableSkuId });
  revalidatePath("/shopify-sync");
}
