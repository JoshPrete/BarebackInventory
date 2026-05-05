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
} | {
  ok: false;
  error: string;
};

/**
 * FormData wrapper for syncShopifyCatalog — called from useActionState in SyncButton.
 * Never throws: errors are returned as { ok: false, error } so the UI can display them.
 */
export async function syncCatalogFormAction(
  _prev: SyncCatalogActionResult | null,
  _formData: FormData,
): Promise<SyncCatalogActionResult> {
  try {
    const result = await _syncCatalog();
    revalidatePath("/shopify-sync");
    revalidatePath("/skus");
    revalidatePath("/dashboard");
    return {
      ok: true,
      productsUpserted: result.productsUpserted,
      variantsUpserted: result.variantsUpserted,
      skusCreated: result.skusCreated,
      skusUpdated: result.skusUpdated,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[syncCatalogFormAction] Sync failed:", message);
    return { ok: false, error: message };
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
