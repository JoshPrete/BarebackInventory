/**
 * BOM (Bill of Materials) service — manages sellable SKUs, components,
 * and the rules that define how many units of each component are consumed
 * per packed SKU unit.
 *
 * Task 1: stubs only.
 */

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
 */
export async function mapVariantToSku(
  _input: MapVariantToSkuInput,
): Promise<MapVariantToSkuResult> {
  // TODO: prisma.shopifyVariantMapping.upsert via data layer
  return { mappingId: "" };
}
