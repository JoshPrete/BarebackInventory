import { PageShell } from "@/app/_components/page-shell";
import { prisma } from "@/lib/prisma";
import { shopifyAdminGraphql } from "@/lib/shopify/admin";
import { isShopifyConfigured } from "@/lib/shopify/config";
import Link from "next/link";

export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

const USAGE_DAYS = 14;
const LEAD_TIME_DAYS = 7;
const BUFFER_DAYS = 3;
const RISK_WINDOW_DAYS = 14; // show in "Coming up" if runs out within this window

// ─── Data: ingredient planning ────────────────────────────────────────────────

async function getIngredientPlanning() {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - USAGE_DAYS);

  const [ingredients, currentSums, recentSaleLines, bomRules] = await Promise.all([
    prisma.component.findMany({
      select: { id: true, name: true, unit: true, reorderPoint: true },
      orderBy: { name: "asc" },
    }),
    prisma.stockMovement.groupBy({
      by: ["componentId"],
      _sum: { qtyChange: true },
    }),
    prisma.manualSaleLine.findMany({
      where: { manualSale: { createdAt: { gte: windowStart } } },
      select: { sellableSkuId: true, quantity: true },
    }),
    prisma.sKUComponentRule.findMany({
      select: { skuId: true, componentId: true, qtyPerUnit: true },
    }),
  ]);

  const skuSoldQty = new Map<string, number>();
  for (const line of recentSaleLines) {
    skuSoldQty.set(line.sellableSkuId, (skuSoldQty.get(line.sellableSkuId) ?? 0) + line.quantity);
  }

  const dailyUsageByComponentId = new Map<string, number>();
  for (const rule of bomRules) {
    const sold = skuSoldQty.get(rule.skuId) ?? 0;
    const contribution = (sold * rule.qtyPerUnit) / USAGE_DAYS;
    dailyUsageByComponentId.set(
      rule.componentId,
      (dailyUsageByComponentId.get(rule.componentId) ?? 0) + contribution,
    );
  }

  const onHandById = new Map(currentSums.map((s) => [s.componentId, s._sum.qtyChange ?? 0]));

  return ingredients.map((c) => {
    const onHand = onHandById.get(c.id) ?? 0;
    const dailyUsage = dailyUsageByComponentId.get(c.id) ?? 0;
    const daysRemaining = dailyUsage > 0 ? onHand / dailyUsage : null;
    const isOut = onHand <= 0;

    const needsOrderNow =
      isOut ||
      (daysRemaining !== null && daysRemaining <= LEAD_TIME_DAYS);

    const isRisk =
      !needsOrderNow &&
      daysRemaining !== null &&
      daysRemaining <= RISK_WINDOW_DAYS;

    const recommendedOrderQty =
      dailyUsage > 0
        ? Math.ceil(dailyUsage * (LEAD_TIME_DAYS + BUFFER_DAYS))
        : c.reorderPoint > 0
          ? c.reorderPoint
          : 0;

    return {
      id: c.id,
      name: c.name,
      unit: c.unit,
      onHand,
      dailyUsage,
      daysRemaining,
      isOut,
      needsOrderNow,
      isRisk,
      recommendedOrderQty,
    };
  });
}

// ─── Data: production capacity ────────────────────────────────────────────────

async function getProductionCapacity() {
  const [skus, bomRules, componentSums, shopifyStock] = await Promise.all([
    prisma.sellableSKU.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.sKUComponentRule.findMany({
      select: { skuId: true, componentId: true, qtyPerUnit: true, component: { select: { name: true } } },
    }),
    prisma.stockMovement.groupBy({
      by: ["componentId"],
      _sum: { qtyChange: true },
    }),
    getShopifyFinishedStock(),
  ]);

  const componentOnHand = new Map(
    componentSums.map((s) => [s.componentId, s._sum.qtyChange ?? 0]),
  );

  const rulesBySkuId = new Map<string, { componentId: string; qtyPerUnit: number; componentName: string }[]>();
  for (const r of bomRules) {
    const list = rulesBySkuId.get(r.skuId) ?? [];
    list.push({ componentId: r.componentId, qtyPerUnit: r.qtyPerUnit, componentName: r.component.name });
    rulesBySkuId.set(r.skuId, list);
  }

  return skus.map((sku) => {
    const rules = rulesBySkuId.get(sku.id) ?? [];
    const shopifyQty = shopifyStock.get(sku.id) ?? 0;

    if (rules.length === 0) return { id: sku.id, name: sku.name, canMake: null, bottleneck: null, shopifyQty };

    let canMake = Infinity;
    let bottleneck: string | null = null;

    for (const rule of rules) {
      const stock = componentOnHand.get(rule.componentId) ?? 0;
      const possible = rule.qtyPerUnit > 0 ? Math.floor(stock / rule.qtyPerUnit) : 0;
      if (possible < canMake) {
        canMake = possible;
        bottleneck = stock <= 0 ? rule.componentName : null;
      }
    }

    return {
      id: sku.id,
      name: sku.name,
      canMake: Math.max(0, canMake === Infinity ? 0 : canMake),
      bottleneck,
      shopifyQty,
    };
  });
}

// ─── Data: Shopify finished stock ─────────────────────────────────────────────

const SHOPIFY_INVENTORY_QUERY = `
  query GetVariantInventory($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant { id inventoryQuantity }
    }
  }
`;

type InventoryNode = { id: string; inventoryQuantity: number };

async function getShopifyFinishedStock(): Promise<Map<string, number>> {
  if (!isShopifyConfigured()) return new Map();
  const mappings = await prisma.shopifyVariantMapping.findMany({
    select: { sellableSkuId: true, shopifyVariantGid: true },
  });
  if (mappings.length === 0) return new Map();
  try {
    const res = await shopifyAdminGraphql<{ nodes: Array<InventoryNode | null> }>(
      SHOPIFY_INVENTORY_QUERY,
      { ids: mappings.map((m) => m.shopifyVariantGid) },
    );
    const qtyByGid = new Map(
      (res.data?.nodes ?? [])
        .filter((n): n is InventoryNode => n !== null && "inventoryQuantity" in n)
        .map((n) => [n.id, n.inventoryQuantity ?? 0]),
    );
    return new Map(
      mappings
        .filter((m) => qtyByGid.has(m.shopifyVariantGid))
        .map((m) => [m.sellableSkuId, qtyByGid.get(m.shopifyVariantGid)!]),
    );
  } catch {
    return new Map();
  }
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function futureDay(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.floor(daysFromNow));
  return d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" });
}

function orderDeadlineDay(daysRemaining: number): string {
  // Latest day you can place the order and still receive before stockout
  const deadlineDays = Math.max(0, Math.floor(daysRemaining) - LEAD_TIME_DAYS);
  if (deadlineDays <= 0) return "today";
  if (deadlineDays === 1) return "tomorrow";
  return futureDay(deadlineDays);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const [ingredients, products] = await Promise.all([
    getIngredientPlanning(),
    getProductionCapacity(),
  ]);

  const toOrderNow = ingredients.filter((i) => i.needsOrderNow);
  const risks = ingredients.filter((i) => i.isRisk);

  const inStock = products.filter((p) => p.shopifyQty > 0).length;
  const outOfStock = products.filter((p) => p.shopifyQty <= 0).length;
  const totalCanMake = products.reduce((sum, p) => sum + (p.canMake ?? 0), 0);

  return (
    <PageShell
      active="/dashboard"
      title="What do I need to do today?"
      description={`Based on your last ${USAGE_DAYS} days of sales.`}
    >
      <div className="space-y-8">

        {/* ── Section 1: Order today ─────────────────────────────────────── */}
        <section>
          {toOrderNow.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-5">
              <p className="font-semibold text-emerald-800">Nothing to order today</p>
              {(() => {
                const closest = ingredients
                  .filter((i) => i.daysRemaining !== null && i.daysRemaining > 0)
                  .sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999))[0];
                return closest ? (
                  <p className="mt-1 text-sm text-emerald-700">
                    Your next decision point is in {Math.floor(closest.daysRemaining!)} days — {closest.name} runs out on {futureDay(closest.daysRemaining! - LEAD_TIME_DAYS)}.
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-emerald-700">Check back tomorrow.</p>
                );
              })()}
            </div>
          ) : (
            <div className="rounded-xl border-2 border-red-200 bg-white shadow-sm">
              <div className="flex items-center justify-between rounded-t-xl border-b border-red-100 bg-red-50 px-6 py-4">
                <div>
                  <h2 className="text-base font-bold text-red-900">Order today</h2>
                  <p className="text-sm text-red-700">
                    These ingredients need to be ordered now. Your supplier takes {LEAD_TIME_DAYS} days.
                  </p>
                </div>
                <Link
                  href="/receipts"
                  className="shrink-0 rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800"
                >
                  Record delivery
                </Link>
              </div>

              <ul className="divide-y divide-zinc-100">
                {toOrderNow.map((ingredient) => (
                  <li key={ingredient.id} className="px-6 py-5">
                    <div className="flex items-start justify-between gap-6">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-zinc-900">{ingredient.name}</p>

                        {ingredient.isOut ? (
                          <p className="mt-1 text-sm text-red-600 font-medium">
                            You have none left — this is blocking production right now.
                          </p>
                        ) : (
                          <p className="mt-1 text-sm text-zinc-600">
                            You have{" "}
                            <span className="font-medium text-zinc-900">
                              {ingredient.onHand % 1 === 0
                                ? ingredient.onHand
                                : ingredient.onHand.toFixed(1)}{" "}
                              {ingredient.unit}
                            </span>{" "}
                            left — runs out{" "}
                            <span className="font-medium text-red-700">
                              {Math.floor(ingredient.daysRemaining!) <= 1
                                ? "tomorrow"
                                : `in ${Math.floor(ingredient.daysRemaining!)} days`}
                            </span>{" "}
                            ({futureDay(ingredient.daysRemaining!)}).
                          </p>
                        )}

                        {ingredient.dailyUsage > 0 && (
                          <p className="mt-0.5 text-xs text-zinc-400">
                            Using ~{ingredient.dailyUsage < 1
                              ? ingredient.dailyUsage.toFixed(2)
                              : Math.ceil(ingredient.dailyUsage)} {ingredient.unit}/day based on the last {USAGE_DAYS} days
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Order now</p>
                        <p className="text-2xl font-bold text-zinc-900">
                          {ingredient.recommendedOrderQty > 0
                            ? `${ingredient.recommendedOrderQty} ${ingredient.unit}`
                            : "—"}
                        </p>
                        {!ingredient.isOut && ingredient.daysRemaining !== null && (
                          <p className="text-xs text-zinc-400">
                            Order by {orderDeadlineDay(ingredient.daysRemaining)}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* ── Section 2: What you can produce now ───────────────────────── */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            What you can make right now
          </h2>

          {totalCanMake === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white px-6 py-5">
              <p className="font-medium text-zinc-700">You can't produce anything right now.</p>
              <p className="mt-1 text-sm text-zinc-500">
                Order ingredients to unlock production.{" "}
                <Link href="/packing" className="text-zinc-700 underline">Start packing →</Link>
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-blue-100 bg-blue-50">
              <ul className="divide-y divide-blue-100">
                {products.map((p) => {
                  if (p.canMake === null) return null;
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-4 px-6 py-4">
                      <div>
                        <p className="font-medium text-zinc-900">{p.name}</p>
                        {p.canMake === 0 && p.bottleneck && (
                          <p className="text-xs text-red-600">Waiting on {p.bottleneck}</p>
                        )}
                      </div>
                      <div className="text-right">
                        {p.canMake > 0 ? (
                          <p className="text-lg font-bold text-blue-900">
                            {p.canMake} units
                          </p>
                        ) : (
                          <p className="text-sm font-medium text-zinc-400">Can't pack yet</p>
                        )}
                        <p className="text-xs text-zinc-400">
                          {p.shopifyQty} on Shopify now
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-blue-100 px-6 py-3">
                <Link
                  href="/packing"
                  className="text-sm font-semibold text-blue-800 hover:text-blue-900 hover:underline"
                >
                  Record a packing run →
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* ── Section 3: Coming up (risks) ──────────────────────────────── */}
        {risks.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Coming up — no action needed today
            </h2>
            <div className="rounded-xl border border-amber-100 bg-amber-50">
              <ul className="divide-y divide-amber-100">
                {risks
                  .sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999))
                  .map((ingredient) => (
                    <li key={ingredient.id} className="flex items-center justify-between gap-4 px-6 py-4">
                      <div>
                        <p className="font-medium text-zinc-900">{ingredient.name}</p>
                        <p className="text-sm text-zinc-600">
                          Runs out in{" "}
                          <span className="font-medium text-amber-800">
                            {Math.floor(ingredient.daysRemaining!)} days
                          </span>{" "}
                          ({futureDay(ingredient.daysRemaining!)})
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-zinc-400">Order by</p>
                        <p className="text-sm font-semibold text-amber-800">
                          {orderDeadlineDay(ingredient.daysRemaining!)}
                        </p>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          </section>
        )}

        {/* ── Section 4: Summary ────────────────────────────────────────── */}
        <section className="border-t border-zinc-200 pt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Finished goods on Shopify
          </h2>
          <div className="flex flex-wrap gap-6 text-sm text-zinc-600">
            <span>
              <span className="text-lg font-bold text-zinc-900">{inStock}</span>{" "}
              product{inStock !== 1 ? "s" : ""} in stock
            </span>
            {outOfStock > 0 && (
              <span>
                <span className="text-lg font-bold text-red-600">{outOfStock}</span>{" "}
                out of stock
              </span>
            )}
            <Link href="/skus" className="text-zinc-400 hover:text-zinc-600 hover:underline">
              View all →
            </Link>
          </div>
        </section>

      </div>
    </PageShell>
  );
}
