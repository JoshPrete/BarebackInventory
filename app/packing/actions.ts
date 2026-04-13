"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordPackingRun } from "@/lib/record-packing-run";

export type PackingState = {
  error?: string;
  success?: string;
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

  const result = await prisma.$transaction(async (tx) => {
    return recordPackingRun(tx, {
      sellableSkuId,
      quantity,
      note,
    });
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
  return { success: "Packing run recorded." };
}
