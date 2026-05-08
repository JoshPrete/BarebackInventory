"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Create a new user-defined product category.
 * Returns the new category id, or null if the name already exists.
 */
export async function createCategory(
  name: string,
): Promise<{ id: string; name: string } | { error: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Category name cannot be empty." };

  try {
    const row = await prisma.productCategory.create({ data: { name: trimmed } });
    revalidatePath("/skus");
    return { id: row.id, name: row.name };
  } catch {
    return { error: `"${trimmed}" already exists.` };
  }
}

/**
 * Assign (or clear) a category on a SellableSKU.
 * Pass categoryId = null to remove the category.
 */
export async function setSkuCategory(
  skuId: string,
  categoryId: string | null,
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "SellableSKU" SET "categoryId" = ${categoryId} WHERE "id" = ${skuId}
  `;
  revalidatePath("/skus");
  revalidatePath("/dashboard");
  revalidatePath("/packed-stock");
}

/**
 * Delete a category. SKUs assigned to it will have categoryId set to null
 * automatically (ON DELETE SET NULL).
 */
export async function deleteCategory(categoryId: string): Promise<void> {
  await prisma.productCategory.delete({ where: { id: categoryId } });
  revalidatePath("/skus");
  revalidatePath("/dashboard");
  revalidatePath("/packed-stock");
}

/**
 * Set the classification on a SellableSKU.
 * Uses raw SQL to bypass stale generated Prisma client.
 * Pass null to clear the classification.
 */
export async function setSkuClassification(
  skuId: string,
  classification: string | null,
): Promise<void> {
  if (classification === null) {
    await prisma.$executeRaw`
      UPDATE "SellableSKU" SET "classification" = NULL WHERE "id" = ${skuId}
    `;
  } else {
    await prisma.$executeRaw`
      UPDATE "SellableSKU"
      SET "classification" = ${classification}::"SkuClassification"
      WHERE "id" = ${skuId}
    `;
  }
  revalidatePath("/skus");
  revalidatePath("/dashboard");
}
