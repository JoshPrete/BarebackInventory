"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type CreateComponentState = {
  error?: string;
};

export async function createComponent(
  _prevState: CreateComponentState,
  formData: FormData,
): Promise<CreateComponentState> {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const reorderPointRaw = String(formData.get("reorderPoint") ?? "");
  const reorderQtyRaw = String(formData.get("reorderQty") ?? "");

  if (!name) return { error: "Name is required." };
  if (!type) return { error: "Type is required." };
  if (!unit) return { error: "Unit is required." };

  const reorderPoint = Number(reorderPointRaw);
  const reorderQty = Number(reorderQtyRaw);
  if (Number.isNaN(reorderPoint) || Number.isNaN(reorderQty)) {
    return { error: "Reorder point and reorder qty must be numbers." };
  }

  await prisma.component.create({
    data: { name, type, unit, reorderPoint, reorderQty },
  });

  revalidatePath("/components");
  revalidatePath("/reorder");
  return {};
}
