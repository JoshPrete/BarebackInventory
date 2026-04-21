/**
 * DEV-ONLY endpoint — not for production use.
 * POST /api/dev/seed-all
 *
 * One-shot: creates all remaining SellableSKU rows, ShopifyVariantMapping rows,
 * SKUComponentRule rows, Component rows, and opening StockMovement RECEIPT
 * entries for all components.
 *
 * Idempotent: safe to call multiple times (upserts throughout).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ComponentDef {
  code: string;
  type: "BILTONG_BULK" | "PACKAGING";
  unit: string;
  seedQty: number;
  reorderPoint: number;
  reorderQty: number;
}

interface SkuDef {
  internalSkuCode: string;
  name: string;
  shopifySkuCode: string;
  bom: { componentCode: string; qtyPerUnit: number }[];
}

// ─── Component master list ────────────────────────────────────────────────────

const COMPONENTS: ComponentDef[] = [
  { code: "RAW_MEAT",          type: "BILTONG_BULK", unit: "kg",   seedQty: 50,   reorderPoint: 5,   reorderQty: 50 },
  { code: "SPICE_ORIGINAL",    type: "BILTONG_BULK", unit: "unit", seedQty: 500,  reorderPoint: 50,  reorderQty: 200 },
  { code: "SPICE_CHIMI",       type: "BILTONG_BULK", unit: "unit", seedQty: 500,  reorderPoint: 50,  reorderQty: 200 },
  { code: "SPICE_SALTVINEGAR", type: "BILTONG_BULK", unit: "unit", seedQty: 500,  reorderPoint: 50,  reorderQty: 200 },
  { code: "SPICE_SMOKE",       type: "BILTONG_BULK", unit: "unit", seedQty: 500,  reorderPoint: 50,  reorderQty: 200 },
  { code: "SPICE_SMOKECHILLI", type: "BILTONG_BULK", unit: "unit", seedQty: 500,  reorderPoint: 50,  reorderQty: 200 },
  { code: "PACKAGING_35G",     type: "PACKAGING",    unit: "unit", seedQty: 5000, reorderPoint: 500, reorderQty: 2000 },
  { code: "PACKAGING_1KG",     type: "PACKAGING",    unit: "unit", seedQty: 500,  reorderPoint: 50,  reorderQty: 200 },
  { code: "PACKAGING_SAMPLE",  type: "PACKAGING",    unit: "unit", seedQty: 200,  reorderPoint: 20,  reorderQty: 100 },
];

// ─── SKU + BOM definitions ────────────────────────────────────────────────────
// Mapping: Shopify SKU → internal SKU + BOM
// BOX 10×35g: BOM covers one 35g unit (the Shopify qty already reflects units sold)
// Single 35g:  BOM same as box unit
// 1KG bag:     0.035 kg × ~28 (1 kg finished = ~35g raw) → 1.0 kg raw, 10 spice, 1 packaging
// Sample 10pk: 0.35 kg raw (10 × 35g), 2 spice mix, 1 sample packaging

const SKUS: SkuDef[] = [
  // ── Already mapped — add BOM only ─────────────────────────────────────────
  {
    internalSkuCode: "CHIMI-35G",
    name: "Chimichurri Biltong 35g",
    shopifySkuCode: "BOX-CHIMI-10X35G",
    bom: [
      { componentCode: "RAW_MEAT",      qtyPerUnit: 0.035 },
      { componentCode: "SPICE_CHIMI",   qtyPerUnit: 1 },
      { componentCode: "PACKAGING_35G", qtyPerUnit: 1 },
    ],
  },
  {
    internalSkuCode: "SALTVINEGAR-35G",
    name: "Salt & Vinegar Biltong 35g",
    shopifySkuCode: "BOX-SALTVINEGAR-10X35G",
    bom: [
      { componentCode: "RAW_MEAT",          qtyPerUnit: 0.035 },
      { componentCode: "SPICE_SALTVINEGAR", qtyPerUnit: 1 },
      { componentCode: "PACKAGING_35G",     qtyPerUnit: 1 },
    ],
  },
  // ── New box SKUs ───────────────────────────────────────────────────────────
  {
    internalSkuCode: "SMOKE-35G",
    name: "Smoke Biltong 35g",
    shopifySkuCode: "BOX-SMOKE-10X35G",
    bom: [
      { componentCode: "RAW_MEAT",      qtyPerUnit: 0.035 },
      { componentCode: "SPICE_SMOKE",   qtyPerUnit: 1 },
      { componentCode: "PACKAGING_35G", qtyPerUnit: 1 },
    ],
  },
  {
    internalSkuCode: "SMOKECHILLI-35G",
    name: "Smoke Chilli Biltong 35g",
    shopifySkuCode: "BOX-SMOKECHILLI-10X35G",
    bom: [
      { componentCode: "RAW_MEAT",          qtyPerUnit: 0.035 },
      { componentCode: "SPICE_SMOKECHILLI", qtyPerUnit: 1 },
      { componentCode: "PACKAGING_35G",     qtyPerUnit: 1 },
    ],
  },
  // ── Individual 35g singles ─────────────────────────────────────────────────
  {
    internalSkuCode: "ORIG-SINGLE-35G",
    name: "Original Biltong 35g Single",
    shopifySkuCode: "ORIG-35G",
    bom: [
      { componentCode: "RAW_MEAT",      qtyPerUnit: 0.035 },
      { componentCode: "SPICE_ORIGINAL", qtyPerUnit: 1 },
      { componentCode: "PACKAGING_35G", qtyPerUnit: 1 },
    ],
  },
  {
    internalSkuCode: "CHIMI-SINGLE-35G",
    name: "Chimichurri Biltong 35g Single",
    shopifySkuCode: "CHIMI-35G",
    bom: [
      { componentCode: "RAW_MEAT",      qtyPerUnit: 0.035 },
      { componentCode: "SPICE_CHIMI",   qtyPerUnit: 1 },
      { componentCode: "PACKAGING_35G", qtyPerUnit: 1 },
    ],
  },
  {
    internalSkuCode: "SALTVINEGAR-SINGLE-35G",
    name: "Salt & Vinegar Biltong 35g Single",
    shopifySkuCode: "SALTVINEGAR-35G",
    bom: [
      { componentCode: "RAW_MEAT",          qtyPerUnit: 0.035 },
      { componentCode: "SPICE_SALTVINEGAR", qtyPerUnit: 1 },
      { componentCode: "PACKAGING_35G",     qtyPerUnit: 1 },
    ],
  },
  {
    internalSkuCode: "SMOKE-SINGLE-35G",
    name: "Smoke Biltong 35g Single",
    shopifySkuCode: "SMOKE-35G",
    bom: [
      { componentCode: "RAW_MEAT",      qtyPerUnit: 0.035 },
      { componentCode: "SPICE_SMOKE",   qtyPerUnit: 1 },
      { componentCode: "PACKAGING_35G", qtyPerUnit: 1 },
    ],
  },
  {
    internalSkuCode: "SMOKECHILLI-SINGLE-35G",
    name: "Smoke Chilli Biltong 35g Single",
    shopifySkuCode: "SMOKECHILLI-35G",
    bom: [
      { componentCode: "RAW_MEAT",          qtyPerUnit: 0.035 },
      { componentCode: "SPICE_SMOKECHILLI", qtyPerUnit: 1 },
      { componentCode: "PACKAGING_35G",     qtyPerUnit: 1 },
    ],
  },
  // ── 1KG bags ──────────────────────────────────────────────────────────────
  {
    internalSkuCode: "ORIG-1KG",
    name: "Original Biltong 1kg",
    shopifySkuCode: "ORIG-1KG",
    bom: [
      { componentCode: "RAW_MEAT",       qtyPerUnit: 1.0 },
      { componentCode: "SPICE_ORIGINAL", qtyPerUnit: 10 },
      { componentCode: "PACKAGING_1KG",  qtyPerUnit: 1 },
    ],
  },
  {
    internalSkuCode: "CHIMI-1KG",
    name: "Chimichurri Biltong 1kg",
    shopifySkuCode: "CHIMI-1KG",
    bom: [
      { componentCode: "RAW_MEAT",     qtyPerUnit: 1.0 },
      { componentCode: "SPICE_CHIMI",  qtyPerUnit: 10 },
      { componentCode: "PACKAGING_1KG", qtyPerUnit: 1 },
    ],
  },
  {
    internalSkuCode: "SALTVINEGAR-1KG",
    name: "Salt & Vinegar Biltong 1kg",
    shopifySkuCode: "SALTVINEGAR-1KG",
    bom: [
      { componentCode: "RAW_MEAT",          qtyPerUnit: 1.0 },
      { componentCode: "SPICE_SALTVINEGAR", qtyPerUnit: 10 },
      { componentCode: "PACKAGING_1KG",     qtyPerUnit: 1 },
    ],
  },
  {
    internalSkuCode: "SMOKE-1KG",
    name: "Smoke Biltong 1kg",
    shopifySkuCode: "SMOKE-1KG",
    bom: [
      { componentCode: "RAW_MEAT",     qtyPerUnit: 1.0 },
      { componentCode: "SPICE_SMOKE",  qtyPerUnit: 10 },
      { componentCode: "PACKAGING_1KG", qtyPerUnit: 1 },
    ],
  },
  {
    internalSkuCode: "SMOKECHILLI-1KG",
    name: "Smoke Chilli Biltong 1kg",
    shopifySkuCode: "SMOKECHILLI-1KG",
    bom: [
      { componentCode: "RAW_MEAT",          qtyPerUnit: 1.0 },
      { componentCode: "SPICE_SMOKECHILLI", qtyPerUnit: 10 },
      { componentCode: "PACKAGING_1KG",     qtyPerUnit: 1 },
    ],
  },
  // ── Sample pack ────────────────────────────────────────────────────────────
  {
    internalSkuCode: "SAMPLE-10PACK",
    name: "Sample Pack 10×35g",
    shopifySkuCode: "SAMPLE-10X35G",
    bom: [
      { componentCode: "RAW_MEAT",        qtyPerUnit: 0.35 },
      { componentCode: "SPICE_ORIGINAL",  qtyPerUnit: 2 },
      { componentCode: "SPICE_CHIMI",     qtyPerUnit: 2 },
      { componentCode: "SPICE_SMOKE",     qtyPerUnit: 2 },
      { componentCode: "PACKAGING_SAMPLE", qtyPerUnit: 1 },
    ],
  },
];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available in production" }, { status: 404 });
  }

  // 1. Upsert all components (find-or-create by code, used as name).
  const componentIdByCode = new Map<string, string>();
  const componentResults: { code: string; status: string; onHand: number }[] = [];

  for (const def of COMPONENTS) {
    let component = await prisma.component.findFirst({ where: { name: def.code } });
    if (!component) {
      component = await prisma.component.create({
        data: {
          name: def.code,
          type: def.type,
          unit: def.unit,
          reorderPoint: def.reorderPoint,
          reorderQty: def.reorderQty,
        },
      });
      // Seed opening stock for newly created components only.
      await prisma.stockMovement.create({
        data: {
          componentId: component.id,
          type: "RECEIPT",
          qtyChange: def.seedQty,
          sourceType: "dev_seed",
          note: `Dev seed — opening stock for ${def.code}`,
        },
      });
    }
    componentIdByCode.set(def.code, component.id);

    const agg = await prisma.stockMovement.aggregate({
      where: { componentId: component.id },
      _sum: { qtyChange: true },
    });
    componentResults.push({
      code: def.code,
      status: component ? "existed" : "created",
      onHand: agg._sum.qtyChange ?? 0,
    });
  }

  // 2. Upsert all internal SKUs, map Shopify variants, create BOM rules.
  const skuResults: {
    internalSkuCode: string;
    shopifySkuCode: string;
    skuStatus: string;
    mappingStatus: string;
    bomRules: number;
  }[] = [];

  for (const def of SKUS) {
    // Upsert SellableSKU.
    const existingSku = await prisma.sellableSKU.findFirst({
      where: { sku: def.internalSkuCode },
    });
    const sku = existingSku ?? await prisma.sellableSKU.create({
      data: { sku: def.internalSkuCode, name: def.name },
    });
    const skuStatus = existingSku ? "existed" : "created";

    // Find Shopify variant.
    const shopifyVariant = await prisma.shopifyVariant.findFirst({
      where: { sku: def.shopifySkuCode },
      select: { shopifyVariantGid: true, inventoryItemGid: true },
    });

    let mappingStatus = "skipped — shopify variant not found";
    if (shopifyVariant) {
      await prisma.shopifyVariantMapping.upsert({
        where: { sellableSkuId: sku.id },
        create: {
          shopifyVariantGid: shopifyVariant.shopifyVariantGid,
          sellableSkuId: sku.id,
          shopifyInventoryItemGid: shopifyVariant.inventoryItemGid ?? null,
        },
        update: {
          shopifyVariantGid: shopifyVariant.shopifyVariantGid,
          shopifyInventoryItemGid: shopifyVariant.inventoryItemGid ?? null,
        },
      });
      mappingStatus = "mapped";
    }

    // Upsert BOM rules.
    for (const bomEntry of def.bom) {
      const componentId = componentIdByCode.get(bomEntry.componentCode);
      if (!componentId) continue;
      await prisma.sKUComponentRule.upsert({
        where: { skuId_componentId: { skuId: sku.id, componentId } },
        create: { skuId: sku.id, componentId, qtyPerUnit: bomEntry.qtyPerUnit },
        update: { qtyPerUnit: bomEntry.qtyPerUnit },
      });
    }

    skuResults.push({
      internalSkuCode: def.internalSkuCode,
      shopifySkuCode: def.shopifySkuCode,
      skuStatus,
      mappingStatus,
      bomRules: def.bom.length,
    });
  }

  // 3. Summary counts.
  const [totalSkus, totalMappings, totalBomRules] = await Promise.all([
    prisma.sellableSKU.count(),
    prisma.shopifyVariantMapping.count(),
    prisma.sKUComponentRule.count(),
  ]);

  return NextResponse.json({
    components: componentResults,
    skus: skuResults,
    totals: { totalSkus, totalMappings, totalBomRules },
  });
}
