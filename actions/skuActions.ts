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
 *
 * Side-effect: if classification is PACKAGING_ITEM or RAW_COMPONENT_SOLD,
 * automatically creates a Component record linked to this SKU (idempotent —
 * does nothing if one already exists).
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

  // Auto-create a Component for items that are also physical inputs.
  if (classification === "PACKAGING_ITEM" || classification === "RAW_COMPONENT_SOLD") {
    const componentType = classification === "PACKAGING_ITEM" ? "Packaging" : "Ingredient";

    // Fetch the SKU name
    const skuRows = await prisma.$queryRaw<{ name: string }[]>`
      SELECT "name" FROM "SellableSKU" WHERE "id" = ${skuId}
    `;
    if (skuRows.length === 0) {
      revalidatePath("/skus");
      revalidatePath("/dashboard");
      return;
    }
    const skuName = skuRows[0].name;

    // Only create if no component is already linked to this SKU
    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Component" WHERE "sourceSkuId" = ${skuId} LIMIT 1
    `;
    if (existing.length === 0) {
      await prisma.$executeRaw`
        INSERT INTO "Component" ("id", "name", "type", "unit", "reorderPoint", "reorderQty", "createdAt", "sourceSkuId")
        VALUES (
          gen_random_uuid()::text,
          ${skuName},
          ${componentType},
          'each',
          0,
          0,
          NOW(),
          ${skuId}
        )
      `;
    }

    revalidatePath("/components");
    revalidatePath("/mappings");
  }

  revalidatePath("/skus");
  revalidatePath("/dashboard");
}
