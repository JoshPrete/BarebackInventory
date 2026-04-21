/**
 * DEV-ONLY endpoint — not for production use.
 * POST /api/dev/simulate-order
 *
 * Simulates a single-line Shopify order for a given Shopify SKU and qty.
 * Creates real ManualSale + ManualSaleLine rows, then runs packed and component
 * stock deductions through the same path as a live order import.
 *
 * Body: { shopifySkuCode: string, qty: number }
 *
 * Returns: internal SKU used, BOM breakdown, stock before/after, movements created.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  deductPackedStock,
  deductComponentStock,
  getStockSnapshotForSku,
} from "@/services/inventoryService";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available in production" }, { status: 404 });
  }

  const body = (await request.json()) as { shopifySkuCode: string; qty: number };
  const { shopifySkuCode, qty } = body;

  if (!shopifySkuCode || typeof qty !== "number" || qty <= 0) {
    return NextResponse.json(
      { error: "shopifySkuCode (string) and qty (positive number) are required" },
      { status: 400 },
    );
  }

  // ── 1. Resolve Shopify variant → internal SKU ─────────────────────────────
  const variant = await prisma.shopifyVariant.findFirst({
    where: { sku: shopifySkuCode },
    select: { shopifyVariantGid: true },
  });
  if (!variant) {
    return NextResponse.json(
      { error: `ShopifyVariant with sku="${shopifySkuCode}" not found` },
      { status: 404 },
    );
  }

  const mapping = await prisma.shopifyVariantMapping.findFirst({
    where: { shopifyVariantGid: variant.shopifyVariantGid },
    select: { sellableSkuId: true },
  });
  if (!mapping) {
    return NextResponse.json(
      { error: `No ShopifyVariantMapping for variant GID ${variant.shopifyVariantGid}` },
      { status: 404 },
    );
  }

  const sellableSku = await prisma.sellableSKU.findUniqueOrThrow({
    where: { id: mapping.sellableSkuId },
    select: { id: true, sku: true, name: true },
  });

  // ── 2. Load BOM ───────────────────────────────────────────────────────────
  const bomRules = await prisma.sKUComponentRule.findMany({
    where: { skuId: sellableSku.id },
    select: {
      componentId: true,
      qtyPerUnit: true,
      component: { select: { name: true, unit: true } },
    },
  });

  // ── 3. Stock before ───────────────────────────────────────────────────────
  const snapshotBefore = await getStockSnapshotForSku(sellableSku.id);

  // ── 4. Create ManualSale + ManualSaleLine (real rows, idempotency-safe) ───
  const orderRef = `sim-${Date.now()}`;
  const sale = await prisma.manualSale.create({
    data: {
      orderRef,
      lines: {
        create: {
          sellableSkuId: sellableSku.id,
          quantity: qty,
        },
      },
    },
    select: {
      id: true,
      lines: { select: { id: true } },
    },
  });
  const saleId = sale.id;
  const lineId = sale.lines[0].id;

  // ── 5. Deduct packed stock ────────────────────────────────────────────────
  const packedResult = await deductPackedStock(
    sellableSku.id,
    qty,
    saleId,
    lineId,
    orderRef,
  );

  // ── 6. Deduct component stock ─────────────────────────────────────────────
  const componentResult = await deductComponentStock(
    sellableSku.id,
    qty,
    saleId,
    lineId,
    orderRef,
  );

  // ── 7. Stock after ────────────────────────────────────────────────────────
  const snapshotAfter = await getStockSnapshotForSku(sellableSku.id);

  // ── 8. Build response ─────────────────────────────────────────────────────
  return NextResponse.json({
    orderRef,
    internalSku: { id: sellableSku.id, sku: sellableSku.sku, name: sellableSku.name },
    qty,
    bom: bomRules.map((r) => ({
      component: r.component.name,
      unit: r.component.unit,
      qtyPerUnit: r.qtyPerUnit,
      requiredQty: qty * r.qtyPerUnit,
    })),
    packedStock: {
      before: snapshotBefore.packedOnHand,
      after: snapshotAfter.packedOnHand,
      deducted: packedResult.deducted,
      warning: packedResult.warning,
      alreadyApplied: packedResult.alreadyApplied,
    },
    componentStock: snapshotBefore.components.map((c) => {
      const after = snapshotAfter.components.find((a) => a.componentId === c.componentId);
      return {
        component: c.componentName,
        unit: c.unit,
        before: c.onHand,
        after: after?.onHand ?? c.onHand,
        deducted: c.onHand - (after?.onHand ?? c.onHand),
      };
    }),
    warnings: componentResult.warnings,
    movementsCreated: {
      packedStockMovements: packedResult.alreadyApplied ? 0 : packedResult.deducted > 0 ? 1 : 0,
      componentStockMovements: componentResult.componentsDeducted,
    },
  });
}
