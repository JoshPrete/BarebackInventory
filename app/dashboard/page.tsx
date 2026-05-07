import { PageShell } from "@/app/_components/page-shell";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

const USAGE_DAYS = 14;
const LEAD_TIME_DAYS = 7;
const BUFFER_DAYS = 3;
const RISK_WINDOW_DAYS = 14;

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
  const [skus, categoryRows, bomRules, componentSums, shopifyStock] = await Promise.all([
    prisma.sellableSKU.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // Read categoryId + name via raw SQL — categoryId may not be in stale client.
    prisma.$queryRaw<{ id: string; categoryName: string | null }[]>`
      SELECT s."id", c."name" AS "categoryName"
      FROM "SellableSKU" s
      LEFT JOIN "ProductCategory" c ON c."id" = s."categoryId"
    `,
    prisma.sKUComponentRule.findMany({
      select: { skuId: true, componentId: true, qtyPerUnit: true, component: { select: { name: true } } },
    }),
    prisma.stockMovement.groupBy({
      by: ["componentId"],
      _sum: { qtyChange: true },
    }),
    getShopifyFinishedStock(),
  ]);

  const categoryBySkuId = new Map(categoryRows.map((r) => [r.id, r.categoryName]));

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
    const shopifyQty = shopifyStock.has(sku.id) ? shopifyStock.get(sku.id)! : null;

    const categoryName = categoryBySkuId.get(sku.id) ?? null;
    if (rules.length === 0) return { id: sku.id, name: sku.name, canMake: null, bottleneck: null, shopifyQty, categoryName };

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
      categoryName: categoryBySkuId.get(sku.id) ?? null,
    };
  });
}

// ─── Data: Shopify finished stock ────────────────────────────────────────────
//
// Returns inventoryQuantity per sellableSkuId from the ShopifyVariant table,
// joined through ShopifyVariantMapping. Uses raw SQL so the query works
// regardless of whether the generated Prisma client has been regenerated.
//
// Return value:
//   null  → no Shopify mapping exists for this SKU (never synced)
//   number → Shopify inventoryQuantity at last sync (may be 0)

async function getShopifyFinishedStock(): Promise<Map<string, number | null>> {
  const rows = await prisma.$queryRaw<
    { sellableSkuId: string; inventoryQuantity: number | null }[]
  >`
    SELECT m."sellableSkuId", v."inventoryQuantity"
    FROM "ShopifyVariantMapping" m
    JOIN "ShopifyVariant" v ON v."shopifyVariantGid" = m."shopifyVariantGid"
  `;
  return new Map(rows.map((r) => [r.sellableSkuId, r.inventoryQuantity]));
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function futureDay(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.floor(daysFromNow));
  return d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" });
}

function orderDeadlineDay(daysRemaining: number): string {
  const deadlineDays = Math.max(0, Math.floor(daysRemaining) - LEAD_TIME_DAYS);
  if (deadlineDays <= 0) return "today";
  if (deadlineDays === 1) return "tomorrow";
  return futureDay(deadlineDays);
}

function fmtQty(qty: number, unit: string): string {
  return `${qty % 1 === 0 ? qty : qty.toFixed(1)} ${unit}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  // ── Setup guard ────────────────────────────────────────────────────────────
  // If no products have been synced from Shopify yet, show onboarding state
  // rather than empty/misleading planning numbers.
  const [totalSkus, mappedSkus] = await Promise.all([
    prisma.sellableSKU.count(),
    prisma.sellableSKU.count({ where: { skuComponentRules: { some: {} } } }),
  ]);

  if (totalSkus === 0) {
    return (
      <PageShell
        active="/dashboard"
        title="What do I need to do today?"
        description="Set up your products to get started."
      >
        <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-white px-8 py-14 text-center">
          <p className="text-base font-semibold text-zinc-800">No products yet</p>
          <p className="mt-2 text-sm text-zinc-500 max-w-sm mx-auto">
            Sync your Shopify store to import products, then map each product to its ingredients.
            Planning will begin automatically once recipes are set.
          </p>
          <div className="mt-6 flex flex-col items-center gap-2">
            <Link
              href="/integrations"
              className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Sync Shopify products →
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  const [ingredients, products] = await Promise.all([
    getIngredientPlanning(),
    getProductionCapacity(),
  ]);

  const toOrderNow = ingredients.filter((i) => i.needsOrderNow);
  const outNow = toOrderNow.filter((i) => i.isOut);
  const risks = ingredients
    .filter((i) => i.isRisk)
    .sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999));

  // Group products by category, sorted by Shopify qty desc within each group.
  const productsByCategory = new Map<string, typeof products>();
  for (const p of products) {
    const key = p.categoryName ?? "Uncategorised";
    const group = productsByCategory.get(key) ?? [];
    group.push(p);
    productsByCategory.set(key, group);
  }
  // Sort each group by shopifyQty desc, nulls last.
  for (const group of productsByCategory.values()) {
    group.sort((a, b) => {
      if (a.shopifyQty === null && b.shopifyQty === null) return 0;
      if (a.shopifyQty === null) return 1;
      if (b.shopifyQty === null) return -1;
      return b.shopifyQty - a.shopifyQty;
    });
  }
  // Category section order: alphabetical, "Uncategorised" last.
  const categoryGroups = [...productsByCategory.entries()].sort(([a], [b]) => {
    if (a === "Uncategorised") return 1;
    if (b === "Uncategorised") return -1;
    return a.localeCompare(b);
  });

  // ── Derive today's tasks (max 3, verb-first) ─────────────────────────────
  type Task = { label: string; detail: string; href: string; cta: string };
  const tasks: Task[] = [];

  for (const i of toOrderNow.slice(0, 2)) {
    tasks.push({
      label: `Order ${i.name}`,
      detail: i.isOut
        ? `None left — order ${i.recommendedOrderQty > 0 ? fmtQty(i.recommendedOrderQty, i.unit) : "now"}`
        : `Runs out in ~${Math.floor(i.daysRemaining!)} days — order ${i.recommendedOrderQty > 0 ? fmtQty(i.recommendedOrderQty, i.unit) : "now"}`,
      href: "/reorder",
      cta: "Mark as ordered",
    });
  }

  if (tasks.length < 3 && products.some((p) => (p.canMake ?? 0) > 0)) {
    tasks.push({
      label: "Record a packing run",
      detail: "Ingredients are ready — update your stock after packing",
      href: "/packing",
      cta: "Go to packing",
    });
  }

  // ── Summary counts ───────────────────────────────────────────────────────
  const inStockCount = products.filter((p) => p.shopifyQty !== null && p.shopifyQty > 0).length;
  const outCount = products.filter((p) => p.shopifyQty !== null && p.shopifyQty === 0).length;
  const noRecipeCount = totalSkus - mappedSkus;

  // ── ACTION NOW: single highest-priority signal ───────────────────────────
  type ActionNow =
    | { type: "blocked"; title: string; body: string }
    | { type: "order"; title: string; body: string }
    | { type: "clear"; title: string; body: string };

  let actionNow: ActionNow;
  if (outNow.length > 0) {
    const names = outNow.map((i) => i.name).join(" and ");
    actionNow = {
      type: "blocked",
      title: outNow.length === 1 ? `${names} is out` : `${outNow.length} ingredients are out`,
      body: "Production is blocked. Place an order immediately.",
    };
  } else if (toOrderNow.length > 0) {
    const urgent = toOrderNow.sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999))[0];
    actionNow = {
      type: "order",
      title: `Order ${urgent.name} today`,
      body:
        urgent.daysRemaining !== null
          ? `Runs out in ${Math.floor(urgent.daysRemaining)} days. Your supplier takes ${LEAD_TIME_DAYS} days — order now to avoid a gap.`
          : `Stock is critically low. Order now.`,
    };
  } else {
    const closest = ingredients
      .filter((i) => i.daysRemaining !== null && i.daysRemaining > 0)
      .sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999))[0];
    actionNow = {
      type: "clear",
      title: "Nothing urgent today",
      body: closest
        ? `Next decision: order ${closest.name} by ${orderDeadlineDay(closest.daysRemaining!)}.`
        : "All ingredients are stocked. Check back tomorrow.",
    };
  }

  const heroStyles = {
    blocked: "border-red-300 bg-red-600 text-white",
    order: "border-orange-200 bg-orange-50 text-zinc-900",
    clear: "border-emerald-200 bg-emerald-50 text-zinc-900",
  };
  const heroTitleStyles = {
    blocked: "text-white",
    order: "text-orange-900",
    clear: "text-emerald-900",
  };
  const heroBodyStyles = {
    blocked: "text-red-100",
    order: "text-orange-700",
    clear: "text-emerald-700",
  };

  return (
    <PageShell
      active="/dashboard"
      title="What do I need to do today?"
      description={`Based on your last ${USAGE_DAYS} days of sales.`}
    >
      <div className="space-y-6">

        {/* ── RECIPE SETUP CALLOUT (non-blocking) ─────────────────────────── */}
        {noRecipeCount > 0 && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-5 py-3">
            <p className="text-sm text-amber-800">
              <span className="font-semibold">{noRecipeCount} product{noRecipeCount !== 1 ? "s" : ""}</span> have no ingredient recipe — production planning is limited until recipes are set.
            </p>
            <Link href="/skus" className="shrink-0 text-xs font-semibold text-amber-900 hover:underline">
              Set recipes →
            </Link>
          </div>
        )}

        {/* ── ACTION NOW ─────────────────────────────────────────────────── */}
        <div className={`rounded-xl border-2 px-6 py-5 ${heroStyles[actionNow.type]}`}>
          <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${actionNow.type === "blocked" ? "text-red-200" : "text-zinc-400"}`}>
            Action now
          </p>
          <p className={`text-lg font-bold ${heroTitleStyles[actionNow.type]}`}>
            {actionNow.title}
          </p>
          <p className={`mt-1 text-sm ${heroBodyStyles[actionNow.type]}`}>
            {actionNow.body}
          </p>
        </div>

        {/* ── TODAY'S TASKS ───────────────────────────────────────────────── */}
        {tasks.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Today&apos;s tasks
            </h2>
            <ul className="space-y-2">
              {tasks.map((task) => (
                <li
                  key={task.href + task.label}
                  className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-900">{task.label}</p>
                    <p className="mt-0.5 text-sm text-zinc-500">{task.detail}</p>
                  </div>
                  <Link
                    href={task.href}
                    className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-700"
                  >
                    {task.cta}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── WHAT YOU CAN MAKE ───────────────────────────────────────────── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              What you can make
            </h2>
            <span className="text-xs text-zinc-400">Stock shown from Shopify</span>
          </div>
          <div className="space-y-3">
            {categoryGroups.map(([catName, group]) => (
              <div key={catName} className="rounded-xl border border-blue-100 bg-blue-50 divide-y divide-blue-100">
                {categoryGroups.length > 1 && (
                  <div className="px-5 py-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">
                      {catName}
                    </span>
                  </div>
                )}
                {group.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div>
                      <p className="font-medium text-zinc-900">{p.name}</p>
                      {p.canMake === null && (
                        <p className="mt-0.5 text-xs text-amber-600">No recipe set</p>
                      )}
                      {p.canMake === 0 && p.bottleneck && (
                        <p className="mt-0.5 text-xs text-red-600">Waiting on {p.bottleneck}</p>
                      )}
                      {p.canMake === 0 && !p.bottleneck && (
                        <p className="mt-0.5 text-xs text-zinc-400">No ingredients stocked</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {p.canMake !== null && p.canMake > 0 ? (
                        <p className="text-lg font-bold text-blue-900">{p.canMake} units</p>
                      ) : p.canMake !== null ? (
                        <p className="text-sm font-medium text-zinc-400">Can&apos;t pack yet</p>
                      ) : null}
                      <p className="text-xs text-zinc-400">
                        {p.shopifyQty === null ? "Unknown" : p.shopifyQty} on Shopify
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <div className="px-1 py-1">
              <Link
                href="/packing"
                className="text-sm font-semibold text-blue-700 hover:text-blue-900 hover:underline"
              >
                Record a packing run →
              </Link>
            </div>
          </div>
        </section>

        {/* ── RISKS COMING UP ─────────────────────────────────────────────── */}
        {risks.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Risks coming up
            </h2>
            <div className="rounded-xl border border-amber-100 bg-amber-50 divide-y divide-amber-100">
              {risks.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <p className="font-medium text-zinc-900">{i.name}</p>
                    <p className="mt-0.5 text-sm text-amber-800">
                      Runs out in {Math.floor(i.daysRemaining!)} days ({futureDay(i.daysRemaining!)})
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-zinc-400">Order by</p>
                    <p className="text-sm font-semibold text-amber-800">
                      {orderDeadlineDay(i.daysRemaining!)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── SUMMARY LINE ────────────────────────────────────────────────── */}
        <p className="text-xs text-zinc-400 border-t border-zinc-100 pt-4">
          {inStockCount} product{inStockCount !== 1 ? "s" : ""} in stock on Shopify
          {outCount > 0 && <> · <span className="text-red-500">{outCount} out</span></>}
          {risks.length > 0 && <> · {risks.length} ingredient{risks.length !== 1 ? "s" : ""} running low</>}
          {toOrderNow.length > 0 && <> · <span className="text-orange-600">{toOrderNow.length} need{toOrderNow.length === 1 ? "s" : ""} ordering</span></>}
          {" · "}
          <Link href="/stock" className="hover:text-zinc-600 hover:underline">View ingredients</Link>
        </p>

      </div>
    </PageShell>
  );
}
