/**
 * Sales processing service — converts an inbound order (from Shopify or
 * manual entry) into ManualSale + ManualSaleLine rows, then triggers
 * packed-stock deductions via inventoryService.
 */

import { prisma } from "@/lib/prisma";
import type { ShopifyOrderRecord } from "@/adapters/shopify/types";
import {
  deductPackedStock,
  deductComponentStock,
  type DeductPackedStockResult,
  type DeductComponentStockResult,
} from "@/services/inventoryService";

// ─── Manual sale (generic) ───────────────────────────────────────────────────

export interface SaleLineInput {
  sellableSkuId: string;
  quantity: number;
}

export interface RecordSaleInput {
  orderRef?: string;
  sourceType: "shopify_order" | "manual";
  lines: SaleLineInput[];
}

export interface RecordSaleResult {
  saleId: string;
  linesRecorded: number;
}

/**
 * Persist a generic sale to the ledger.
 * TODO: implement manual sale path (including packed stock deduction).
 */
export async function recordSale(
  _input: RecordSaleInput,
): Promise<RecordSaleResult> {
  return { saleId: "", linesRecorded: 0 };
}

// ─── Reprocess a single ManualSaleLine ───────────────────────────────────────

export interface ReprocessLineResult {
  manualSaleLineId: string;
  sellableSkuId: string;
  quantity: number;
  packed: DeductPackedStockResult;
  components: DeductComponentStockResult;
}

/**
 * Re-run deductions for a ManualSaleLine that already exists in the ledger.
 * Both deduction functions are idempotent: if movements already exist for
 * this line they return alreadyApplied=true / already_applied warnings
 * without writing anything new.
 *
 * Use this path to recover a line whose deductions were skipped due to
 * missing stock, or to verify idempotency under repeated calls.
 */
export async function reprocessSaleLine(
  manualSaleLineId: string,
): Promise<ReprocessLineResult> {
  const line = await prisma.manualSaleLine.findUnique({
    where: { id: manualSaleLineId },
    select: {
      id: true,
      sellableSkuId: true,
      quantity: true,
      manualSaleId: true,
      manualSale: { select: { orderRef: true } },
    },
  });

  if (!line) {
    throw new Error(`ManualSaleLine not found: ${manualSaleLineId}`);
  }

  const orderRef = line.manualSale.orderRef ?? line.manualSaleId;

  const [packed, components] = await Promise.all([
    deductPackedStock(
      line.sellableSkuId,
      line.quantity,
      line.manualSaleId,
      line.id,
      orderRef,
    ),
    deductComponentStock(
      line.sellableSkuId,
      line.quantity,
      line.manualSaleId,
      line.id,
      orderRef,
    ),
  ]);

  return {
    manualSaleLineId: line.id,
    sellableSkuId: line.sellableSkuId,
    quantity: line.quantity,
    packed,
    components,
  };
}

// ─── Shopify order import ────────────────────────────────────────────────────

export interface RecordShopifyOrderResult {
  saleId: string;
  linesImported: number;
  /** Line items skipped because the variant GID had no ShopifyVariantMapping. */
  linesSkipped: number;
  /**
   * Count of lines where packed stock was missing or insufficient.
   * The import still succeeds; only the deduction is affected.
   */
  deductionWarnings: number;
  /**
   * Total component-level warnings across all lines (no BOM, no stock,
   * insufficient stock, or already-applied idempotent skips).
   */
  componentWarnings: number;
}

/**
 * Persist one Shopify order as ManualSale + ManualSaleLine rows, then
 * deduct packed stock for each imported line via inventoryService.
 *
 * - Dedup is the caller's responsibility (this function always inserts).
 * - Lines with no ShopifyVariantMapping are skipped (linesSkipped).
 * - Missing or insufficient packed stock does not fail the import
 *   (deductionWarnings is incremented instead).
 * - Component deduction follows packed stock deduction using BOM rules.
 */
export async function recordShopifyOrder(
  order: ShopifyOrderRecord,
): Promise<RecordShopifyOrderResult> {
  // 1. Collect all variant GIDs present on this order.
  const variantGids = order.lineItems
    .map((li) => li.shopifyVariantGid)
    .filter((gid): gid is string => gid !== null);

  // 2. Resolve variant GIDs → internal sellable SKU IDs via the mapping table.
  const mappings =
    variantGids.length > 0
      ? await prisma.shopifyVariantMapping.findMany({
          where: { shopifyVariantGid: { in: variantGids } },
          select: { shopifyVariantGid: true, sellableSkuId: true },
        })
      : [];

  const gidToSkuId = new Map(
    mappings.map((m) => [m.shopifyVariantGid, m.sellableSkuId]),
  );

  // 3. Build the lines that can be imported; track skipped ones.
  const linesToCreate: { sellableSkuId: string; quantity: number }[] = [];
  let linesSkipped = 0;

  for (const li of order.lineItems) {
    if (!li.shopifyVariantGid) {
      linesSkipped++;
      continue;
    }
    const sellableSkuId = gidToSkuId.get(li.shopifyVariantGid);
    if (!sellableSkuId) {
      linesSkipped++;
      continue;
    }
    linesToCreate.push({ sellableSkuId, quantity: li.quantity });
  }

  // 4. Insert ManualSale + lines; select line IDs for the deduction step.
  const sale = await prisma.manualSale.create({
    data: {
      orderRef: order.shopifyOrderGid,
      createdAt: new Date(order.createdAt),
      lines: { create: linesToCreate },
    },
    select: {
      id: true,
      lines: { select: { id: true, sellableSkuId: true, quantity: true } },
    },
  });

  // 5. Deduct packed stock for each imported line.
  //    manualSaleLineId is the idempotency key — reruns skip already-applied
  //    deductions without writing duplicates.
  //    Missing stock does not fail the import (warning incremented instead).
  let deductionWarnings = 0;
  let componentWarnings = 0;

  for (const line of sale.lines) {
    // Packed stock deduction.
    const packedResult = await deductPackedStock(
      line.sellableSkuId,
      line.quantity,
      sale.id,
      line.id,
      order.shopifyOrderGid,
    );
    if (packedResult.warning) {
      deductionWarnings++;
    }

    // Component stock deduction via BOM.
    const componentResult = await deductComponentStock(
      line.sellableSkuId,
      line.quantity,
      sale.id,
      line.id,
      order.shopifyOrderGid,
    );
    componentWarnings += componentResult.warnings.length;
  }

  return {
    saleId: sale.id,
    linesImported: linesToCreate.length,
    linesSkipped,
    deductionWarnings,
    componentWarnings,
  };
}
