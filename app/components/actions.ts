"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ComponentType } from "@/app/generated/prisma/enums";

export type CreateComponentState = {
  error?: string;
};

export async function createComponent(
  _prevState: CreateComponentState,
  formData: FormData,
): Promise<CreateComponentState> {
  const name = String(formData.get("name") ?? "").trim();
  const typeRaw = String(formData.get("type") ?? "");
  const unit = String(formData.get("unit") ?? "").trim();
  const reorderPointRaw = String(formData.get("reorderPoint") ?? "");
  const reorderQtyRaw = String(formData.get("reorderQty") ?? "");

  if (!name) {
    return { error: "Name is required." };
  }
  if (typeRaw !== "BILTONG_BULK" && typeRaw !== "PACKAGING") {
    return { error: "Type must be BILTONG_BULK or PACKAGING." };
  }
  if (!unit) {
    return { error: "Unit is required." };
  }

  const reorderPoint = Number(reorderPointRaw);
  const reorderQty = Number(reorderQtyRaw);
  if (Number.isNaN(reorderPoint) || Number.isNaN(reorderQty)) {
    return { error: "Reorder point and reorder qty must be numbers." };
  }

  const type = typeRaw as ComponentType;

  await prisma.component.create({
    data: {
      name,
      type,
      unit,
      reorderPoint,
      reorderQty,
    },
  });

  revalidatePath("/components");
  revalidatePath("/stock");
  revalidatePath("/reorder");
  return {};
}
