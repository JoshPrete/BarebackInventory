import type { PrismaClient } from "@/app/generated/prisma/client";
import { PackedStockMovementType } from "@/app/generated/prisma/enums";

/** Transaction client or full Prisma client (subset used here). */
export type SaleDb = Pick<
  PrismaClient,
  "manualSale" | "manualSaleLine" | "packedStockMovement"
>;

export type RecordManualSaleInput = {
  sellableSkuId: string;
  quantity: number;
  orderRef: string | null;
};

export type RecordManualSaleResult =
  | { ok: true; manualSaleId: string }
  | { ok: false; error: string };

/**
 * Creates ManualSale + ManualSaleLine and a PackedStockMovement (SALE, negative qty).
 * Does not deduct component stock — use packing workflow to consume components and add packed stock first.
 */
export async function recordManualSale(
  db: SaleDb,
  input: RecordManualSaleInput,
): Promise<RecordManualSaleResult> {
  const { sellableSkuId, quantity, orderRef } = input;

  if (!sellableSkuId) {
    return { ok: false, error: "Sellable SKU is required." };
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: "Quantity must be a positive number." };
  }

  const onHandAgg = await db.packedStockMovement.aggregate({
    where: { sellableSkuId },
    _sum: { qtyChange: true },
  });
  const onHand = onHandAgg._sum.qtyChange ?? 0;
  if (onHand < quantity) {
    return {
      ok: false,
      error: `Insufficient packed stock (on hand ${onHand}, need ${quantity}). Pack finished goods first.`,
    };
  }

  const sale = await db.manualSale.create({
    data: { orderRef: orderRef?.trim() || null },
  });

  await db.manualSaleLine.create({
    data: {
      manualSaleId: sale.id,
      sellableSkuId,
      quantity,
    },
  });

  await db.packedStockMovement.create({
    data: {
      sellableSkuId,
      qtyChange: -quantity,
      type: PackedStockMovementType.SALE,
      sourceType: "manual_sale",
      manualSaleId: sale.id,
    },
  });

  return { ok: true, manualSaleId: sale.id };
}
