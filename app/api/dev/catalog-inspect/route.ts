/**
 * DEV-ONLY endpoint — not for production use.
 * GET /api/dev/catalog-inspect
 *
 * Returns counts of synced ShopifyProduct/ShopifyVariant rows and the first 5
 * variants with their mapping status. Used for post-sync validation only.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available in production" }, { status: 404 });
  }

  try {
    const [productCount, variantCount, variants, mappings] = await Promise.all([
      prisma.shopifyProduct.count(),
      prisma.shopifyVariant.count(),
      prisma.shopifyVariant.findMany({
        orderBy: [{ shopifyProductGid: "asc" }, { title: "asc" }],
        select: {
          shopifyVariantGid: true,
          title: true,
          sku: true,
          price: true,
          product: { select: { title: true } },
        },
      }),
      prisma.shopifyVariantMapping.findMany({
        select: {
          shopifyVariantGid: true,
          sellableSku: { select: { sku: true, name: true } },
        },
      }),
    ]);

    const mappingByGid = new Map(mappings.map((m) => [m.shopifyVariantGid, m.sellableSku]));

    return NextResponse.json({
      productCount,
      variantCount,
      variants: variants.map((v) => ({
        productTitle: v.product.title,
        variantTitle: v.title,
        shopifyVariantGid: v.shopifyVariantGid,
        shopifySkuCode: v.sku,
        mappedSku: mappingByGid.get(v.shopifyVariantGid) ?? null,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
