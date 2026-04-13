import type { PrismaClient } from "@/app/generated/prisma/client";
import {
  PackedStockMovementType,
  StockMovementType,
} from "@/app/generated/prisma/enums";

export type PackingDb = Pick<
  PrismaClient,
  "packingRun" | "sKUComponentRule" | "stockMovement" | "packedStockMovement"
>;

export type RecordPackingRunInput = {
  sellableSkuId: string;
  quantity: number;
  note: string | null;
};

export type RecordPackingRunResult =
  | { ok: true; packingRunId: string }
  | { ok: false; error: string };

/**
 * Creates PackingRun, component StockMovement rows (packing consumption), and one PACK PackedStockMovement.
 */
export async function recordPackingRun(
  db: PackingDb,
  input: RecordPackingRunInput,
): Promise<RecordPackingRunResult> {
  const { sellableSkuId, quantity, note } = input;

  if (!sellableSkuId) {
    return { ok: false, error: "Sellable SKU is required." };
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: "Quantity must be a positive number." };
  }

  const rules = await db.sKUComponentRule.findMany({
    where: { skuId: sellableSkuId },
  });

  if (rules.length === 0) {
    return {
      ok: false,
      error: "No component mappings exist for this SKU. Add mappings first.",
    };
  }

  const run = await db.packingRun.create({
    data: { note: note?.trim() || null },
  });

  for (const rule of rules) {
    const qtyChange = -(rule.qtyPerUnit * quantity);
    await db.stockMovement.create({
      data: {
        componentId: rule.componentId,
        type: StockMovementType.ADJUSTMENT,
        qtyChange,
        sourceType: "packing_run",
        packingRunId: run.id,
        note: note?.trim() || null,
      },
    });
  }

  await db.packedStockMovement.create({
    data: {
      sellableSkuId,
      qtyChange: quantity,
      type: PackedStockMovementType.PACK,
      sourceType: "packing_run",
      packingRunId: run.id,
      note: note?.trim() || null,
    },
  });

  return { ok: true, packingRunId: run.id };
}
