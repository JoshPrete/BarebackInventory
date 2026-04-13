"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type CreateSkuState = {
  error?: string;
};

export async function createSellableSKU(
  _prevState: CreateSkuState,
  formData: FormData,
): Promise<CreateSkuState> {
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const isBundleRaw = String(formData.get("isBundle") ?? "false");

  if (!name) {
    return { error: "Name is required." };
  }
  if (!sku) {
    return { error: "SKU code is required." };
  }

  const isBundle = isBundleRaw === "true" || isBundleRaw === "on";

  try {
    await prisma.sellableSKU.create({
      data: {
        name,
        sku,
        isBundle,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return { error: "That SKU code is already in use." };
    }
    throw e;
  }

  revalidatePath("/skus");
  revalidatePath("/mappings");
  return {};
}
