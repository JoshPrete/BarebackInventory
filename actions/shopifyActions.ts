"use server";
/**
 * Shopify server actions — the only entry points for UI-triggered Shopify
 * operations. UI components call these; they delegate to shopifyService
 * and bomService. No Prisma imports here.
 */

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
