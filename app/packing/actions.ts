"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordPackingRun } from "@/lib/record-packing-run";
import { adjustShopifyInventory } from "@/lib/shopify/inventory";

export type PackingState = {
  error?: string;
  success?: string;
  /** Set when the DB transaction succeeded but the Shopify push failed. */
  shopifyWarning?: string;
};

export async function submitPackingRun(
  _prevState: PackingState,
  formData: FormData,
): Promise<PackingState> {
  const sellableSkuId = String(formData.get("sellableSkuId") ?? "").trim();
  const quantityRaw = String(formData.get("quantity") ?? "");
  const noteRaw = String(formData.get("note") ?? "").trim();
  const quantity = Number(quantityRaw);
  const note = noteRaw.length > 0 ? noteRaw : null;

  // 1. Record packing run in DB: deduct components, add packed stock movement.
  const result = await prisma.$transaction(async (tx) => {
    return recordPackingRun(tx, { sellableSkuId, quantity, note });
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/packing");
  revalidatePath("/packed-stock");
  revalidatePath("/movements");
  revalidatePath("/components");
  revalidatePath("/stock");
  revalidatePath("/reorder");
  revalidatePath("/dashboard");

  // 2. Push stock increase to Shopify so the dashboard reflects the new count.
  //    This runs after the transaction commits — a Shopify failure does NOT
  //    roll back production data. We surface a warning instead.
  const shopifyResult = await adjustShopifyInventory(sellableSkuId, quantity);

  if (!shopifyResult.ok) {
    console.warn(`[packing] Shopify sync failed after run ${result.packingRunId}: ${shopifyResult.error}`);
    return {
      success: "Packing run recorded.",
      shopifyWarning: shopifyResult.error,
    };
  }

  console.log(
    `[packing] Run ${result.packingRunId}: Shopify inventory updated, ` +
    `now ${shopifyResult.quantityAfterChange} units`,
  );

  return { success: "Packing run recorded. Shopify inventory updated." };
}
