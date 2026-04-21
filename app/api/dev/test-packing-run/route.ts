/**
 * TEMPORARY DEV endpoint — delete after end-to-end test.
 * POST /api/dev/test-packing-run?skuId=<uuid>&qty=<number>
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordPackingRun } from "@/lib/record-packing-run";
import { adjustShopifyInventory } from "@/lib/shopify/inventory";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const sellableSkuId = searchParams.get("skuId") ?? "";
  const qty = Number(searchParams.get("qty") ?? "0");

  if (!sellableSkuId || qty <= 0) {
    return NextResponse.json({ error: "skuId and qty required" }, { status: 400 });
  }

  // Snapshot before
  const before = await prisma.packedStockMovement.aggregate({
    where: { sellableSkuId },
    _sum: { qtyChange: true },
  });
  const beforePacked = before._sum.qtyChange ?? 0;

  const bomRules = await prisma.sKUComponentRule.findMany({
    where: { skuId: sellableSkuId },
    include: { component: { select: { name: true, unit: true } } },
  });

  const componentsBefore = await Promise.all(
    bomRules.map(async (r) => {
      const agg = await prisma.stockMovement.aggregate({
        where: { componentId: r.componentId },
        _sum: { qtyChange: true },
      });
      return { name: r.component.name, unit: r.component.unit, qtyPerUnit: r.qtyPerUnit, before: agg._sum.qtyChange ?? 0 };
    }),
  );

  // Run packing
  const dbResult = await prisma.$transaction((tx) =>
    recordPackingRun(tx, { sellableSkuId, quantity: qty, note: "e2e test" }),
  );

  if (!dbResult.ok) {
    return NextResponse.json({ error: dbResult.error }, { status: 400 });
  }

  const shopifyResult = await adjustShopifyInventory(sellableSkuId, qty);

  // Snapshot after
  const after = await prisma.packedStockMovement.aggregate({
    where: { sellableSkuId },
    _sum: { qtyChange: true },
  });
  const afterPacked = after._sum.qtyChange ?? 0;

  const componentsAfter = await Promise.all(
    bomRules.map(async (r) => {
      const agg = await prisma.stockMovement.aggregate({
        where: { componentId: r.componentId },
        _sum: { qtyChange: true },
      });
      return { name: r.component.name, unit: r.component.unit, qtyPerUnit: r.qtyPerUnit, after: agg._sum.qtyChange ?? 0 };
    }),
  );

  const ingredientDeductions = componentsBefore.map((b, i) => ({
    name: b.name,
    unit: b.unit,
    qtyPerUnit: b.qtyPerUnit,
    before: b.before,
    after: componentsAfter[i].after,
    deducted: b.before - componentsAfter[i].after,
  }));

  return NextResponse.json({
    sku: sellableSkuId,
    qtyPacked: qty,
    packingRunId: dbResult.packingRunId,
    internal: { before: beforePacked, after: afterPacked, delta: afterPacked - beforePacked },
    ingredientDeductions,
    shopify: shopifyResult,
  });
}
