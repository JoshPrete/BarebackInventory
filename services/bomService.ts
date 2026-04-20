/**
 * BOM (Bill of Materials) service — manages sellable SKUs, components,
 * and the rules that define how many units of each component are consumed
 * per packed SKU unit.
 */

import { prisma } from "@/lib/prisma";

export interface CreateComponentInput {
  name: string;
  type: "BILTONG_BULK" | "PACKAGING";
  unit: string;
  reorderPoint: number;
  reorderQty: number;
}

export interface CreateComponentResult {
  componentId: string;
}

export interface CreateSkuComponentRuleInput {
  skuId: string;
  componentId: string;
  qtyPerUnit: number;
}

export interface CreateSkuComponentRuleResult {
  ruleId: string;
}

export interface MapVariantToSkuInput {
  shopifyVariantGid: string;
  sellableSkuId: string;
  shopifyInventoryItemGid?: string;
}

export interface MapVariantToSkuResult {
  mappingId: string;
}

export interface ListSellableSkusResult {
  id: string;
  sku: string;
  name: string;
}

/**
 * Return all sellable SKUs ordered by SKU code — used to populate
 * variant-mapping dropdowns.
 */
export async function listSellableSkus(): Promise<ListSellableSkusResult[]> {
  return prisma.sellableSKU.findMany({
    select: { id: true, sku: true, name: true },
    orderBy: { sku: "asc" },
  });
}

/**
 * Create a new component (raw material or packaging).
 */
export async function createComponent(
  _input: CreateComponentInput,
): Promise<CreateComponentResult> {
  // TODO: prisma.component.create via data layer
  return { componentId: "" };
}

/**
 * Define how many units of a component are consumed per SKU unit packed.
 */
export async function createSkuComponentRule(
  _input: CreateSkuComponentRuleInput,
): Promise<CreateSkuComponentRuleResult> {
  // TODO: prisma.sKUComponentRule.create via data layer
  return { ruleId: "" };
}

/**
 * Link a Shopify variant GID to an internal sellable SKU.
 *
 * ShopifyVariantMapping is unique on sellableSkuId, not on shopifyVariantGid.
 * To keep both sides consistent:
 *   1. Delete any existing mapping for this variant GID targeting a different SKU.
 *   2. Upsert by sellableSkuId so the SKU's mapping row is created or updated.
 */
export async function mapVariantToSku(
  input: MapVariantToSkuInput,
): Promise<MapVariantToSkuResult> {
  const mapping = await prisma.$transaction(async (tx) => {
    // Remove stale mapping if this variant was previously assigned to a different SKU.
    await tx.shopifyVariantMapping.deleteMany({
      where: {
        shopifyVariantGid: input.shopifyVariantGid,
        NOT: { sellableSkuId: input.sellableSkuId },
      },
    });

    return tx.shopifyVariantMapping.upsert({
      where: { sellableSkuId: input.sellableSkuId },
      create: {
        shopifyVariantGid: input.shopifyVariantGid,
        sellableSkuId: input.sellableSkuId,
        shopifyInventoryItemGid: input.shopifyInventoryItemGid ?? null,
      },
      update: {
        shopifyVariantGid: input.shopifyVariantGid,
        shopifyInventoryItemGid: input.shopifyInventoryItemGid ?? null,
      },
      select: { id: true },
    });
  });

  return { mappingId: mapping.id };
}
