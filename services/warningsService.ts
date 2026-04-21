/**
 * Warnings service — derives inventory health warnings from the existing
 * ledger and master data tables. No schema changes; all data is computed
 * from PackedStockMovement, StockMovement, SKUComponentRule, and Component.
 *
 * Thresholds (in-code, no DB column needed at this stage):
 *   PACKED_LOW_THRESHOLD  — packed on-hand below this triggers a low-stock warning
 *   COMPONENT_NEAR_ZERO   — component on-hand at or below this is a near-negative risk
 */

import { prisma } from "@/lib/prisma";

const PACKED_LOW_THRESHOLD = 5;
const COMPONENT_NEAR_ZERO = 0;

// ─── Output types ─────────────────────────────────────────────────────────────

export type WarningSeverity = "critical" | "warning" | "info";

export interface SkuWarning {
  sellableSkuId: string;
  skuCode: string;
  skuName: string;
  onHand: number;
}

export interface ComponentWarning {
  componentId: string;
  name: string;
  unit: string;
  onHand: number;
  reorderPoint: number;
}

export interface WarningsSummary {
  /** SellableSKUs where packed on-hand is zero or negative. */
  noPackedStock: SkuWarning[];
  /** SellableSKUs where packed on-hand is > 0 but below PACKED_LOW_THRESHOLD. */
  lowPackedStock: SkuWarning[];
  /** SellableSKUs that have no SKUComponentRule rows. */
  missingBom: { sellableSkuId: string; skuCode: string; skuName: string }[];
  /** Components where on-hand has dropped below their reorderPoint. */
  belowReorderPoint: ComponentWarning[];
  /** Components where on-hand is at or below zero — immediate risk. */
  nearNegative: ComponentWarning[];
}

// ─── Query ────────────────────────────────────────────────────────────────────

export async function getWarnings(): Promise<WarningsSummary> {
  const [
    allSkus,
    allComponents,
    packedSums,
    componentSums,
    bomCoverage,
  ] = await Promise.all([
    prisma.sellableSKU.findMany({
      select: { id: true, sku: true, name: true },
      orderBy: { sku: "asc" },
    }),
    prisma.component.findMany({
      select: { id: true, name: true, unit: true, reorderPoint: true },
      orderBy: { name: "asc" },
    }),
    // Aggregate packed on-hand per SKU.
    prisma.packedStockMovement.groupBy({
      by: ["sellableSkuId"],
      _sum: { qtyChange: true },
    }),
    // Aggregate component on-hand per component.
    prisma.stockMovement.groupBy({
      by: ["componentId"],
      _sum: { qtyChange: true },
    }),
    // Which SKUs have at least one BOM rule?
    prisma.sKUComponentRule.findMany({
      select: { skuId: true },
      distinct: ["skuId"],
    }),
  ]);

  // Build lookup maps.
  const packedOnHandById = new Map(
    packedSums.map((s) => [s.sellableSkuId, s._sum.qtyChange ?? 0]),
  );
  const componentOnHandById = new Map(
    componentSums.map((s) => [s.componentId, s._sum.qtyChange ?? 0]),
  );
  const skusWithBom = new Set(bomCoverage.map((r) => r.skuId));

  // ── SKU warnings ─────────────────────────────────────────────────────────
  const noPackedStock: SkuWarning[] = [];
  const lowPackedStock: SkuWarning[] = [];

  for (const sku of allSkus) {
    const onHand = packedOnHandById.get(sku.id) ?? 0;
    const entry: SkuWarning = { sellableSkuId: sku.id, skuCode: sku.sku, skuName: sku.name, onHand };
    if (onHand <= 0) {
      noPackedStock.push(entry);
    } else if (onHand < PACKED_LOW_THRESHOLD) {
      lowPackedStock.push(entry);
    }
  }

  const missingBom = allSkus
    .filter((s) => !skusWithBom.has(s.id))
    .map((s) => ({ sellableSkuId: s.id, skuCode: s.sku, skuName: s.name }));

  // ── Component warnings ────────────────────────────────────────────────────
  const belowReorderPoint: ComponentWarning[] = [];
  const nearNegative: ComponentWarning[] = [];

  for (const comp of allComponents) {
    const onHand = componentOnHandById.get(comp.id) ?? 0;
    const entry: ComponentWarning = {
      componentId: comp.id,
      name: comp.name,
      unit: comp.unit,
      onHand,
      reorderPoint: comp.reorderPoint,
    };
    if (onHand <= COMPONENT_NEAR_ZERO) {
      nearNegative.push(entry);
    } else if (comp.reorderPoint > 0 && onHand < comp.reorderPoint) {
      belowReorderPoint.push(entry);
    }
  }

  return { noPackedStock, lowPackedStock, missingBom, belowReorderPoint, nearNegative };
}
