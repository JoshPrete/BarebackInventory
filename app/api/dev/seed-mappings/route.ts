/**
 * DEV-ONLY endpoint — not for production use.
 * POST /api/dev/seed-mappings
 *
 * Accepts a JSON body: { mappings: [{ shopifySkuCode, internalSkuCode }] }
 * Looks up ShopifyVariant by shopifySkuCode (sku field) and SellableSKU by
 * internalSkuCode (sku field), then writes ShopifyVariantMapping rows.
 *
 * GET /api/dev/seed-mappings
 * Lists all SellableSKU rows so you can see valid internalSkuCode values.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available in production" }, { status: 404 });
  }

  const skus = await prisma.sellableSKU.findMany({
    select: { id: true, sku: true, name: true },
    orderBy: { sku: "asc" },
  });
  return NextResponse.json({ sellableSkus: skus });
}

interface MappingInput {
  shopifySkuCode: string;
  /** sku code of an existing SellableSKU, or include skuName to upsert it first */
  internalSkuCode: string;
  /** if set, a SellableSKU with this name is upserted before mapping */
  skuName?: string;
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available in production" }, { status: 404 });
  }

  const body = (await request.json()) as { mappings: MappingInput[] };
  const results: { shopifySkuCode: string; internalSkuCode: string; status: string; detail?: string }[] = [];

  for (const { shopifySkuCode, internalSkuCode, skuName } of body.mappings) {
    // Optionally upsert the internal SKU so this endpoint is self-contained for seeding.
    if (skuName) {
      await prisma.sellableSKU.upsert({
        where: { sku: internalSkuCode },
        create: { sku: internalSkuCode, name: skuName },
        update: { name: skuName },
      });
    }

    const [variant, sku] = await Promise.all([
      prisma.shopifyVariant.findFirst({ where: { sku: shopifySkuCode }, select: { shopifyVariantGid: true, inventoryItemGid: true } }),
      prisma.sellableSKU.findFirst({ where: { sku: internalSkuCode }, select: { id: true } }),
    ]);

    if (!variant) {
      results.push({ shopifySkuCode, internalSkuCode, status: "error", detail: `ShopifyVariant with sku="${shopifySkuCode}" not found` });
      continue;
    }
    if (!sku) {
      results.push({ shopifySkuCode, internalSkuCode, status: "error", detail: `SellableSKU with sku="${internalSkuCode}" not found — pass skuName to create it` });
      continue;
    }

    await prisma.shopifyVariantMapping.upsert({
      where: { sellableSkuId: sku.id },
      create: {
        shopifyVariantGid: variant.shopifyVariantGid,
        sellableSkuId: sku.id,
        shopifyInventoryItemGid: variant.inventoryItemGid ?? null,
      },
      update: {
        shopifyVariantGid: variant.shopifyVariantGid,
        shopifyInventoryItemGid: variant.inventoryItemGid ?? null,
      },
    });

    results.push({ shopifySkuCode, internalSkuCode, status: "mapped" });
  }

  return NextResponse.json({ results });
}
