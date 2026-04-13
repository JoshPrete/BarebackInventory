"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { StockMovementType } from "@/app/generated/prisma/enums";

export type AdjustmentState = {
  error?: string;
  success?: string;
};

export async function recordAdjustment(
  _prevState: AdjustmentState,
  formData: FormData,
): Promise<AdjustmentState> {
  const componentId = String(formData.get("componentId") ?? "").trim();
  const qtyRaw = String(formData.get("quantity") ?? "");
  const direction = String(formData.get("direction") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!componentId) {
    return { error: "Select a component." };
  }

  const quantity = Number(qtyRaw);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: "Quantity must be a positive number." };
  }

  if (direction !== "increase" && direction !== "decrease") {
    return { error: "Choose increase or decrease." };
  }

  const signed =
    direction === "increase" ? quantity : -quantity;

  await prisma.stockMovement.create({
    data: {
      componentId,
      type: StockMovementType.ADJUSTMENT,
      qtyChange: signed,
      sourceType: "manual_adjustment",
      note: reason || null,
    },
  });

  revalidatePath("/adjustments");
  revalidatePath("/movements");
  revalidatePath("/components");
  revalidatePath("/stock");
  revalidatePath("/reorder");
  return { success: "Adjustment recorded." };
}
