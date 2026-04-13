"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordManualSale } from "@/lib/record-manual-sale";

export type RecordSaleState = {
  error?: string;
  success?: string;
};

export async function recordSale(
  _prevState: RecordSaleState,
  formData: FormData,
): Promise<RecordSaleState> {
  const sellableSkuId = String(formData.get("sellableSkuId") ?? "").trim();
  const quantityRaw = String(formData.get("quantity") ?? "");
  const orderRefRaw = String(formData.get("orderRef") ?? "").trim();

  const quantity = Number(quantityRaw);
  const orderRef = orderRefRaw.length > 0 ? orderRefRaw : null;

  const result = await prisma.$transaction(async (tx) => {
    return recordManualSale(tx, {
      sellableSkuId,
      quantity,
      orderRef,
    });
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/sales");
  revalidatePath("/movements");
  revalidatePath("/packed-stock");
  revalidatePath("/packing");
  revalidatePath("/components");
  revalidatePath("/stock");
  revalidatePath("/reorder");
  return { success: "Sale recorded; packed stock updated." };
}
