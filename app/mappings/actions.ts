"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type CreateMappingState = {
  error?: string;
};

export async function createSkuComponentRule(
  _prevState: CreateMappingState,
  formData: FormData,
): Promise<CreateMappingState> {
  const skuId = String(formData.get("skuId") ?? "").trim();
  const componentId = String(formData.get("componentId") ?? "").trim();
  const qtyRaw = String(formData.get("qtyPerUnit") ?? "");

  if (!skuId) {
    return { error: "Select a sellable SKU first." };
  }
  if (!componentId) {
    return { error: "Select a component." };
  }

  const qtyPerUnit = Number(qtyRaw);
  if (Number.isNaN(qtyPerUnit)) {
    return { error: "Quantity per unit must be a number." };
  }

  const existing = await prisma.sKUComponentRule.findFirst({
    where: { skuId, componentId },
  });
  if (existing) {
    return { error: "This SKU already has a rule for that component." };
  }

  await prisma.sKUComponentRule.create({
    data: {
      skuId,
      componentId,
      qtyPerUnit,
    },
  });

  revalidatePath("/mappings");
  return {};
}
