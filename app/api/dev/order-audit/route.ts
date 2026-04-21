/**
 * DEV-ONLY endpoint — not for production use.
 * GET /api/dev/order-audit
 *
 * Fetches the 10 most recent Shopify orders, cross-references them with
 * the internal DB (ManualSale), and for each order returns:
 *   - Shopify order GID + display name + timestamp
 *   - imported/not-imported status
 *   - line items with Shopify SKU → mapped internal SKU → BOM coverage
 *   - packed stock on-hand for each affected internal SKU
 *   - component stock on-hand for each BOM component
 *   - ManualSale + ManualSaleLine DB rows (if imported)
 *   - StockMovement + PackedStockMovement records written for this order
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getShopifyConfig } from "@/lib/shopify/config";
import { getAccessToken } from "@/lib/shopify/auth";

const ORDERS_PROBE = `
  query {
    orders(first: 10, sortKey: PROCESSED_AT, reverse: true) {
      edges {
        node {
          id
          name
          createdAt
          processedAt
          displayFinancialStatus
          lineItems(first: 50) {
            edges {
              node {
                id
                title
                quantity
                sku
                variant { id }
              }
            }
          }
        }
      }
    }
  }
`;

interface GqlOrdersResponse {
  data?: {
    orders: {
      edges: {
        node: {
          id: string;
          name: string;
          createdAt: string;
          processedAt: string;
          displayFinancialStatus: string;
          lineItems: {
            edges: {
              node: {
                id: string;
                title: string;
                quantity: number;
                sku: string | null;
                variant: { id: string } | null;
              };
            }[];
          };
        };
      }[];
    };
  };
  errors?: { message: string }[];
}

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available in production" }, { status: 404 });
  }

  // ── 1. Fetch orders from Shopify ──────────────────────────────────────────
  const cfg = getShopifyConfig();
  if (!cfg) {
    return NextResponse.json({ error: "Shopify not configured" }, { status: 500 });
  }
  const token = await getAccessToken(cfg);
  const res = await fetch(
    `https://${cfg.shopDomain}/admin/api/${cfg.apiVersion}/graphql.json`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query: ORDERS_PROBE }),
    },
  );
  const gql = (await res.json()) as GqlOrdersResponse;
  if (gql.errors?.length) {
    return NextResponse.json({ error: gql.errors.map((e) => e.message).join(", ") }, { status: 500 });
  }

  const shopifyOrders = gql.data?.orders.edges.map((e) => e.node) ?? [];

  // ── 2. Cross-reference with ManualSale ────────────────────────────────────
  const orderGids = shopifyOrders.map((o) => o.id);
  const importedSales = await prisma.manualSale.findMany({
    where: { orderRef: { in: orderGids } },
    select: {
      id: true,
      orderRef: true,
      createdAt: true,
      lines: {
        select: {
          id: true,
          sellableSkuId: true,
          quantity: true,
          sku: { select: { sku: true, name: true } },
          packedStockMovement: { select: { id: true, qtyChange: true, type: true } },
          stockMovements: { select: { id: true, qtyChange: true, type: true, componentId: true } },
        },
      },
    },
  });
  const saleByOrderRef = new Map(importedSales.map((s) => [s.orderRef!, s]));

  // ── 3. Load variant mappings + BOM for referenced variant GIDs ───────────
  const variantGids = shopifyOrders.flatMap((o) =>
    o.lineItems.edges.map((e) => e.node.variant?.id).filter(Boolean) as string[],
  );
  const [mappings, components] = await Promise.all([
    prisma.shopifyVariantMapping.findMany({
      where: { shopifyVariantGid: { in: variantGids } },
      select: {
        shopifyVariantGid: true,
        sellableSkuId: true,
        sellableSku: {
          select: {
            id: true,
            sku: true,
            name: true,
            skuComponentRules: {
              select: {
                qtyPerUnit: true,
                component: { select: { id: true, name: true, unit: true } },
              },
            },
          },
        },
      },
    }),
    prisma.component.findMany({ select: { id: true, name: true, unit: true } }),
  ]);
  const mappingByGid = new Map(mappings.map((m) => [m.shopifyVariantGid, m]));

  // ── 4. Stock snapshots for affected SKUs + components ────────────────────
  const affectedSkuIds = new Set(mappings.map((m) => m.sellableSkuId));
  const affectedComponentIds = new Set(
    mappings.flatMap((m) => m.sellableSku.skuComponentRules.map((r) => r.component.id)),
  );

  const [packedAggs, componentAggs] = await Promise.all([
    Promise.all(
      [...affectedSkuIds].map(async (skuId) => {
        const agg = await prisma.packedStockMovement.aggregate({
          where: { sellableSkuId: skuId },
          _sum: { qtyChange: true },
        });
        const sku = mappings.find((m) => m.sellableSkuId === skuId)?.sellableSku;
        return { skuId, skuCode: sku?.sku ?? skuId, onHand: agg._sum.qtyChange ?? 0 };
      }),
    ),
    Promise.all(
      [...affectedComponentIds].map(async (cid) => {
        const agg = await prisma.stockMovement.aggregate({
          where: { componentId: cid },
          _sum: { qtyChange: true },
        });
        const comp = components.find((c) => c.id === cid);
        return { componentId: cid, name: comp?.name ?? cid, unit: comp?.unit ?? "", onHand: agg._sum.qtyChange ?? 0 };
      }),
    ),
  ]);

  // ── 5. Build response ─────────────────────────────────────────────────────
  const orders = shopifyOrders.map((o) => {
    const sale = saleByOrderRef.get(o.id);
    const lineItems = o.lineItems.edges.map((e) => {
      const li = e.node;
      const mapping = li.variant?.id ? mappingByGid.get(li.variant.id) : undefined;
      const bomRules = mapping?.sellableSku.skuComponentRules ?? [];
      return {
        shopifyLineItemGid: li.id,
        title: li.title,
        quantity: li.quantity,
        shopifySkuCode: li.sku,
        shopifyVariantGid: li.variant?.id ?? null,
        mappedInternalSku: mapping ? { id: mapping.sellableSkuId, sku: mapping.sellableSku.sku, name: mapping.sellableSku.name } : null,
        bomCoverage: bomRules.length > 0 ? bomRules.map((r) => ({ component: r.component.name, unit: r.component.unit, qtyPerUnit: r.qtyPerUnit })) : null,
      };
    });

    return {
      shopifyOrderGid: o.id,
      displayName: o.name,
      createdAt: o.createdAt,
      processedAt: o.processedAt,
      financialStatus: o.displayFinancialStatus,
      imported: !!sale,
      internalSaleId: sale?.id ?? null,
      importedAt: sale?.createdAt ?? null,
      lineItems,
      dbLines: sale?.lines.map((l) => ({
        lineId: l.id,
        sku: l.sku.sku,
        quantity: l.quantity,
        packedMovement: l.packedStockMovement,
        componentMovements: l.stockMovements.length,
      })) ?? null,
    };
  });

  return NextResponse.json({
    shopifyOrdersFetched: shopifyOrders.length,
    orders,
    stockSnapshot: {
      packedStock: packedAggs,
      componentStock: componentAggs,
    },
  });
}
