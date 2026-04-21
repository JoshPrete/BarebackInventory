/**
 * DEV-ONLY endpoint — not for production use.
 * POST /api/dev/seed-stock
 *
 * Seeds a PACK receipt into PackedStockMovement for a given internal SKU code.
 * Used to put stock on hand before running simulate-order.
 *
 * Body: { internalSkuCode: string, qty: number }
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available in production" }, { status: 404 });
  }

  const body = (await request.json()) as { internalSkuCode: string; qty: number };
  const { internalSkuCode, qty } = body;

  if (!internalSkuCode || typeof qty !== "number" || qty <= 0) {
    return NextResponse.json(
      { error: "internalSkuCode (string) and qty (positive number) required" },
      { status: 400 },
    );
  }

  const sku = await prisma.sellableSKU.findFirst({
    where: { sku: internalSkuCode },
    select: { id: true, sku: true, name: true },
  });
  if (!sku) {
    return NextResponse.json(
      { error: `SellableSKU with sku="${internalSkuCode}" not found` },
      { status: 404 },
    );
  }

  const movement = await prisma.packedStockMovement.create({
    data: {
      sellableSkuId: sku.id,
      qtyChange: qty,
      type: "PACK",
      sourceType: "dev_seed",
      note: `Dev seed — ${qty} units of ${internalSkuCode}`,
    },
    select: { id: true, qtyChange: true, type: true, createdAt: true },
  });

  const agg = await prisma.packedStockMovement.aggregate({
    where: { sellableSkuId: sku.id },
    _sum: { qtyChange: true },
  });

  return NextResponse.json({
    sku: sku.sku,
    name: sku.name,
    movement,
    onHandAfter: agg._sum.qtyChange ?? 0,
  });
}
