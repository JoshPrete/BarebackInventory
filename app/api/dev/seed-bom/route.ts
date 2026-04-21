/**
 * DEV-ONLY endpoint — not for production use.
 * POST /api/dev/seed-bom
 *
 * Seeds Component rows, SKUComponentRule rows, and opening StockMovement
 * RECEIPT entries for a given internal SKU.
 *
 * Body:
 * {
 *   internalSkuCode: string,
 *   rules: [{ componentCode, componentName, type, unit, qtyPerUnit, seedQty, reorderPoint?, reorderQty? }]
 * }
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RuleInput {
  componentCode: string;
  componentName: string;
  type: "BILTONG_BULK" | "PACKAGING";
  unit: string;
  qtyPerUnit: number;
  seedQty: number;
  reorderPoint?: number;
  reorderQty?: number;
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available in production" }, { status: 404 });
  }

  const body = (await request.json()) as { internalSkuCode: string; rules: RuleInput[] };
  const { internalSkuCode, rules } = body;

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

  const results = [];

  for (const rule of rules) {
    // 1. Find-or-create component by name (Component has no other unique key).
    const existing = await prisma.component.findFirst({
      where: { name: rule.componentCode },
      select: { id: true, name: true, unit: true },
    });
    const component = existing ?? await prisma.component.create({
      data: {
        name: rule.componentCode,
        type: rule.type,
        unit: rule.unit,
        reorderPoint: rule.reorderPoint ?? 0,
        reorderQty: rule.reorderQty ?? 0,
      },
      select: { id: true, name: true, unit: true },
    });

    // 2. Upsert SKUComponentRule.
    await prisma.sKUComponentRule.upsert({
      where: { skuId_componentId: { skuId: sku.id, componentId: component.id } },
      create: { skuId: sku.id, componentId: component.id, qtyPerUnit: rule.qtyPerUnit },
      update: { qtyPerUnit: rule.qtyPerUnit },
    });

    // 3. Seed opening stock as a RECEIPT movement.
    const movement = await prisma.stockMovement.create({
      data: {
        componentId: component.id,
        type: "RECEIPT",
        qtyChange: rule.seedQty,
        sourceType: "dev_seed",
        note: `Dev seed — opening stock for ${rule.componentCode}`,
      },
      select: { id: true, qtyChange: true },
    });

    // 4. Read on-hand after seeding.
    const agg = await prisma.stockMovement.aggregate({
      where: { componentId: component.id },
      _sum: { qtyChange: true },
    });

    results.push({
      component: component.name,
      unit: component.unit,
      qtyPerUnit: rule.qtyPerUnit,
      seedQty: rule.seedQty,
      onHandAfter: agg._sum.qtyChange ?? 0,
      movementId: movement.id,
    });
  }

  return NextResponse.json({ sku: sku.sku, bomRulesCreated: results.length, components: results });
}
