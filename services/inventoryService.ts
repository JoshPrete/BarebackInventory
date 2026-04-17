/**
 * Inventory service — owns raw component stock and packed stock levels.
 * All reads and writes go through this service; no page or action
 * imports Prisma directly.
 */

import { prisma } from "@/lib/prisma";

// ─── Read models ─────────────────────────────────────────────────────────────

export interface ComponentStockLevel {
  componentId: string;
  componentName: string;
  unit: string;
  onHand: number;
  reorderPoint: number;
}

export interface PackedStockLevel {
  sellableSkuId: string;
  skuCode: string;
  skuName: string;
  onHand: number;
}

/**
 * Return current raw component stock levels (sum of movements).
 * TODO: implement in the component-stock task.
 */
export async function getComponentStockLevels(): Promise<
  ComponentStockLevel[]
> {
  return [];
}

/**
 * Return current packed-stock on-hand for all sellable SKUs.
 * TODO: implement in the packed-stock read task.
 */
export async function getPackedStockLevels(): Promise<PackedStockLevel[]> {
  return [];
}

// ─── Stock snapshot (read) ───────────────────────────────────────────────────

export interface ComponentSnapshot {
  componentId: string;
  componentName: string;
  unit: string;
  qtyPerUnit: number;
  onHand: number;
}

export interface SkuStockSnapshot {
  sellableSkuId: string;
  skuName: string;
  skuCode: string;
  packedOnHand: number;
  components: ComponentSnapshot[];
}

/**
 * Return packed stock on-hand and per-component on-hand for one SKU.
 * Packed on-hand = SUM(PackedStockMovement.qtyChange) for the SKU.
 * Component on-hand = SUM(StockMovement.qtyChange) for each BOM component.
 */
export async function getStockSnapshotForSku(
  sellableSkuId: string,
): Promise<SkuStockSnapshot> {
  const [sku, packedAgg, bomRules] = await Promise.all([
    prisma.sellableSKU.findUniqueOrThrow({
      where: { id: sellableSkuId },
      select: { name: true, sku: true },
    }),
    prisma.packedStockMovement.aggregate({
      where: { sellableSkuId },
      _sum: { qtyChange: true },
    }),
    prisma.sKUComponentRule.findMany({
      where: { skuId: sellableSkuId },
      select: {
        componentId: true,
        qtyPerUnit: true,
        component: { select: { name: true, unit: true } },
      },
    }),
  ]);

  const components: ComponentSnapshot[] = await Promise.all(
    bomRules.map(async (rule) => {
      const agg = await prisma.stockMovement.aggregate({
        where: { componentId: rule.componentId },
        _sum: { qtyChange: true },
      });
      return {
        componentId: rule.componentId,
        componentName: rule.component.name,
        unit: rule.component.unit,
        qtyPerUnit: rule.qtyPerUnit,
        onHand: agg._sum.qtyChange ?? 0,
      };
    }),
  );

  return {
    sellableSkuId,
    skuName: sku.name,
    skuCode: sku.sku,
    packedOnHand: packedAgg._sum.qtyChange ?? 0,
    components,
  };
}

/**
 * Return stock snapshots for every SellableSKU, ordered by SKU code.
 */
export async function getStockSummaryForAllSkus(): Promise<SkuStockSnapshot[]> {
  const skus = await prisma.sellableSKU.findMany({
    select: { id: true },
    orderBy: { sku: "asc" },
  });
  return Promise.all(skus.map((s) => getStockSnapshotForSku(s.id)));
}

// ─── Packed stock deduction ───────────────────────────────────────────────────

export interface DeductPackedStockResult {
  /** Quantity actually deducted (may be less than requested if stock is low). */
  deducted: number;
  /**
   * True when the SKU had no stock, or on-hand was less than qty and
   * the deduction was clamped.
   */
  warning: boolean;
  /**
   * True when a PackedStockMovement for this manualSaleLineId already existed.
   * The deduction was not applied again — idempotent skip.
   */
  alreadyApplied: boolean;
}

/**
 * Deduct packed stock for one sellable SKU after a sale line is recorded.
 *
 * UNIT NOTE: PackedStockMovement.qtyChange is always in whole sellable units
 * (packs, bags, bottles — whatever the SKU represents). It is never in grams
 * or any raw-material unit. Component quantities live in StockMovement and use
 * Component.unit (g, ea, etc.). The two ledgers are never mixed.
 *
 * Idempotency: manualSaleLineId is a unique key on PackedStockMovement.
 * If a movement for this line already exists the function returns early.
 * The DB-level UNIQUE constraint on manualSaleLineId blocks concurrent
 * double-insertions structurally.
 */
export async function deductPackedStock(
  sellableSkuId: string,
  qty: number,
  manualSaleId: string,
  manualSaleLineId: string,
  orderRef: string,
): Promise<DeductPackedStockResult> {
  const existing = await prisma.packedStockMovement.findUnique({
    where: { manualSaleLineId },
    select: { qtyChange: true },
  });

  if (existing) {
    return { deducted: Math.abs(existing.qtyChange), warning: false, alreadyApplied: true };
  }

  const agg = await prisma.packedStockMovement.aggregate({
    where: { sellableSkuId },
    _sum: { qtyChange: true },
  });
  const onHand = agg._sum.qtyChange ?? 0;

  if (onHand <= 0) {
    return { deducted: 0, warning: true, alreadyApplied: false };
  }

  const actualDeduction = Math.min(qty, onHand);

  await prisma.packedStockMovement.create({
    data: {
      sellableSkuId,
      qtyChange: -actualDeduction,
      type: "SALE",
      sourceType: "shopify_order",
      manualSaleId,
      manualSaleLineId,
      note: `Shopify order ${orderRef}`,
    },
  });

  return { deducted: actualDeduction, warning: actualDeduction < qty, alreadyApplied: false };
}

// ─── Component stock deduction ────────────────────────────────────────────────

export type ComponentWarningType =
  | "no_bom"             // SKU has no SKUComponentRules
  | "no_stock"           // component on-hand is zero/negative
  | "insufficient_stock" // deduction clamped to available
  | "already_applied";   // idempotent skip — movement existed

export interface ComponentDeductionWarning {
  type: ComponentWarningType;
  componentId?: string;
}

export interface DeductComponentStockResult {
  componentsDeducted: number;
  warnings: ComponentDeductionWarning[];
}

/**
 * Deduct raw component stock for one ManualSaleLine using the BOM
 * (SKUComponentRule rows for the sellableSkuId).
 *
 * UNIT NOTE: StockMovement.qtyChange and SKUComponentRule.qtyPerUnit share
 * Component.unit (e.g. g, ea). They are always directly comparable to each
 * other. Neither is in sellable units — that is PackedStockMovement's domain.
 * Example: qtyPerUnit=35 with unit=g means 35 g of that component per packed
 * unit sold. For 3 units sold: requiredQty = 3 × 35 = 105 g.
 *
 * For each BOM component:
 *   requiredQty = line.quantity * rule.qtyPerUnit   (both in Component.unit)
 *   on-hand is derived from StockMovement.qtyChange sum for that component
 *   deduction is clamped to available stock (never goes negative)
 *
 * Idempotency:
 *   The unique constraint @@unique([manualSaleLineId, componentId]) on
 *   StockMovement ensures one SALE movement per (line, component).
 *   The service checks for an existing movement first and skips if found.
 *   Concurrent retries are blocked structurally by the DB constraint.
 *   RECEIPT / ADJUSTMENT rows use manualSaleLineId = NULL and are unaffected
 *   (Postgres composite unique constraints treat NULL-containing rows as
 *   non-duplicate).
 *
 * Missing BOM / missing stock never blocks the order import — warnings only.
 */
export async function deductComponentStock(
  sellableSkuId: string,
  saleQty: number,
  manualSaleId: string,
  manualSaleLineId: string,
  orderRef: string,
): Promise<DeductComponentStockResult> {
  const warnings: ComponentDeductionWarning[] = [];

  // 1. Load BOM rules for this SKU.
  const bomRules = await prisma.sKUComponentRule.findMany({
    where: { skuId: sellableSkuId },
    select: { componentId: true, qtyPerUnit: true },
  });

  if (bomRules.length === 0) {
    warnings.push({ type: "no_bom" });
    return { componentsDeducted: 0, warnings };
  }

  let componentsDeducted = 0;

  for (const rule of bomRules) {
    const { componentId, qtyPerUnit } = rule;
    const requiredQty = saleQty * qtyPerUnit;

    // 2. Idempotency check — skip if movement already exists for this line + component.
    const existing = await prisma.stockMovement.findFirst({
      where: { manualSaleLineId, componentId },
      select: { qtyChange: true },
    });

    if (existing) {
      warnings.push({ type: "already_applied", componentId });
      continue;
    }

    // 3. Derive on-hand from ledger.
    const agg = await prisma.stockMovement.aggregate({
      where: { componentId },
      _sum: { qtyChange: true },
    });
    const onHand = agg._sum.qtyChange ?? 0;

    if (onHand <= 0) {
      warnings.push({ type: "no_stock", componentId });
      continue;
    }

    // 4. Clamp to available stock.
    const actualDeduction = Math.min(requiredQty, onHand);
    if (actualDeduction < requiredQty) {
      warnings.push({ type: "insufficient_stock", componentId });
    }

    // 5. Write the component deduction movement.
    await prisma.stockMovement.create({
      data: {
        componentId,
        qtyChange: -actualDeduction,
        type: "SALE",
        sourceType: "shopify_order",
        manualSaleId,
        manualSaleLineId,
        note: `Shopify order ${orderRef}`,
      },
    });

    componentsDeducted++;
  }

  return { componentsDeducted, warnings };
}
