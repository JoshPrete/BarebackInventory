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

/**
 * FormData wrapper for syncShopifyCatalog — called from a <form> action.
 * Revalidates /shopify-sync so the variant table refreshes.
 */
export async function syncCatalogFormAction(
  _formData: FormData,
): Promise<void> {
  await _syncCatalog();
  revalidatePath("/shopify-sync");
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
