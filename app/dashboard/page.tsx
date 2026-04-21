import { PageShell } from "@/app/_components/page-shell";
import { prisma } from "@/lib/prisma";
import { shopifyAdminGraphql } from "@/lib/shopify/admin";
import { isShopifyConfigured } from "@/lib/shopify/config";
import Link from "next/link";

export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

const PACKED_LOW_THRESHOLD = 5;
const TARGET_STOCK = 20;
const USAGE_DAYS = 14;       // rolling window for burn-rate calculation
const LEAD_TIME_DAYS = 7;    // default supplier lead time (days)
const BUFFER_DAYS = 3;       // safety buffer added to reorder quantity
const DEFAULT_MOQ = 0;       // minimum order quantity (no minimum by default)

// ─── Data: SKU rows (unchanged) ───────────────────────────────────────────────

async function getDashboardRows() {
  const [skus, packedSums, bomRules, componentSums, lastSales] =
    await Promise.all([
      prisma.sellableSKU.findMany({
        select: { id: true, sku: true, name: true },
        orderBy: { sku: "asc" },
      }),
      prisma.packedStockMovement.groupBy({
        by: ["sellableSkuId"],
        _sum: { qtyChange: true },
      }),
      prisma.sKUComponentRule.findMany({
        select: { skuId: true, componentId: true, qtyPerUnit: true },
      }),
      prisma.stockMovement.groupBy({
        by: ["componentId"],
        _sum: { qtyChange: true },
      }),
      prisma.packedStockMovement.groupBy({
        by: ["sellableSkuId"],
        where: { type: "SALE" },
        _max: { createdAt: true },
      }),
    ]);

  const packedById = new Map(
    packedSums.map((s) => [s.sellableSkuId, s._sum.qtyChange ?? 0]),
  );
  const componentOnHand = new Map(
    componentSums.map((s) => [s.componentId, s._sum.qtyChange ?? 0]),
  );
  const lastSaleById = new Map(
    lastSales.map((s) => [s.sellableSkuId, s._max.createdAt]),
  );

  const rulesBySkuId = new Map<string, { componentId: string; qtyPerUnit: number }[]>();
  for (const r of bomRules) {
    const list = rulesBySkuId.get(r.skuId) ?? [];
    list.push({ componentId: r.componentId, qtyPerUnit: r.qtyPerUnit });
    rulesBySkuId.set(r.skuId, list);
  }

  return skus.map((sku) => {
    const packedOnHand = packedById.get(sku.id) ?? 0;
    const rules = rulesBySkuId.get(sku.id) ?? [];

    let availableFromComponents: number | null = null;
    if (rules.length > 0) {
      availableFromComponents = rules.reduce<number>((min, rule) => {
        const stock = componentOnHand.get(rule.componentId) ?? 0;
        const canMake = rule.qtyPerUnit > 0 ? Math.floor(stock / rule.qtyPerUnit) : 0;
        return Math.min(min, canMake);
      }, Infinity);
      availableFromComponents = Math.max(0, availableFromComponents as number);
    }

    const totalPotential =
      availableFromComponents !== null
        ? packedOnHand + availableFromComponents
        : packedOnHand;

    const status: "READY" | "LOW" | "OUT" =
      packedOnHand <= 0 ? "OUT"
      : packedOnHand < PACKED_LOW_THRESHOLD ? "LOW"
      : "READY";

    return {
      id: sku.id,
      sku: sku.sku,
      name: sku.name,
      packedOnHand,
      availableFromComponents,
      totalPotential,
      status,
      lastSaleAt: lastSaleById.get(sku.id) ?? null,
    };
  });
}

// ─── Data: ingredient planning ────────────────────────────────────────────────
// Burn rate = sum(skuUnitsSold × qtyPerUnit) / USAGE_DAYS, derived from
// ManualSaleLine (Shopify-imported orders) and BOM component rules.
// No schema changes — all queries use existing tables.

async function getIngredientPlanning() {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - USAGE_DAYS);

  const [ingredients, currentSums, recentSaleLines, bomRules] = await Promise.all([
    prisma.component.findMany({
      select: { id: true, name: true, unit: true, reorderPoint: true },
      orderBy: { name: "asc" },
    }),
    // Current on-hand: sum of all stock movements per ingredient.
    prisma.stockMovement.groupBy({
      by: ["componentId"],
      _sum: { qtyChange: true },
    }),
    // Recent Shopify-imported sale lines within the usage window.
    prisma.manualSaleLine.findMany({
      where: { manualSale: { createdAt: { gte: windowStart } } },
      select: { sellableSkuId: true, quantity: true },
    }),
    // BOM: ingredient qty consumed per sellable unit.
    prisma.sKUComponentRule.findMany({
      select: { skuId: true, componentId: true, qtyPerUnit: true },
    }),
  ]);

  // Total units sold per SKU in the window.
  const skuSoldQty = new Map<string, number>();
  for (const line of recentSaleLines) {
    skuSoldQty.set(line.sellableSkuId, (skuSoldQty.get(line.sellableSkuId) ?? 0) + line.quantity);
  }

  // Ingredient daily burn rate: sum(skuSales × qtyPerUnit) / USAGE_DAYS.
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

    // Days remaining: null when there is no usage data (can't extrapolate).
    const daysRemaining = dailyUsage > 0 ? onHand / dailyUsage : null;

    // Needs ordering if: within lead time window, OR physically out of stock.
    const needsOrder =
      (daysRemaining !== null && daysRemaining <= LEAD_TIME_DAYS) ||
      (onHand <= 0 && c.reorderPoint > 0);

    // Recommended qty covers lead time + buffer days at current burn rate.
    // Falls back to reorderPoint when there is no usage history.
    const recommendedOrderQty =
      dailyUsage > 0
        ? Math.max(DEFAULT_MOQ, Math.ceil(dailyUsage * (LEAD_TIME_DAYS + BUFFER_DAYS)))
        : c.reorderPoint > 0
          ? c.reorderPoint
          : 0;

    return {
      ...c,
      onHand,
      dailyUsage,
      daysRemaining,
      needsOrder,
      recommendedOrderQty,
      leadTimeDays: LEAD_TIME_DAYS,
      moq: DEFAULT_MOQ,
    };
  });
}

// ─── Data: Shopify live inventory (unchanged) ─────────────────────────────────

const INVENTORY_QUERY = `
  query GetVariantInventory($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        inventoryQuantity
      }
    }
  }
`;

type InventoryNode = { id: string; inventoryQuantity: number };
type InventoryResponse = { nodes: Array<InventoryNode | null> };

async function getShopifyInventory(): Promise<Map<string, number>> {
  if (!isShopifyConfigured()) return new Map();

  const mappings = await prisma.shopifyVariantMapping.findMany({
    select: { sellableSkuId: true, shopifyVariantGid: true },
  });
  if (mappings.length === 0) return new Map();

  try {
    const res = await shopifyAdminGraphql<InventoryResponse>(INVENTORY_QUERY, {
      ids: mappings.map((m) => m.shopifyVariantGid),
    });

    const qtyByVariantGid = new Map(
      (res.data?.nodes ?? [])
        .filter((n): n is InventoryNode => n !== null && "inventoryQuantity" in n)
        .map((n) => [n.id, n.inventoryQuantity ?? 0]),
    );

    return new Map(
      mappings
        .filter((m) => qtyByVariantGid.has(m.shopifyVariantGid))
        .map((m) => [m.sellableSkuId, qtyByVariantGid.get(m.shopifyVariantGid)!]),
    );
  } catch (err) {
    console.warn("[dashboard] Shopify inventory fetch failed — falling back to internal ledger:", err);
    return new Map();
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Row = Awaited<ReturnType<typeof getDashboardRows>>[number];
type IngredientRow = Awaited<ReturnType<typeof getIngredientPlanning>>[number];
type FilterValue = "all" | "ready" | "low" | "out";

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function StatusPill({ status }: { status: Row["status"] }) {
  const styles = { READY: "bg-emerald-100 text-emerald-800", LOW: "bg-amber-100 text-amber-900", OUT: "bg-red-100 text-red-800" };
  const labels = { READY: "Ready", LOW: "Low", OUT: "Out" };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function formatDate(d: Date | null) {
  if (!d) return <span className="text-zinc-400">—</span>;
  return <span title={d.toISOString()}>{d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</span>;
}

function computeAction(packed: number, fromComponents: number | null): string {
  if (packed === 0 && fromComponents !== null && fromComponents > 0)
    return `Pack ${fromComponents} units`;
  if (packed < TARGET_STOCK && fromComponents !== null && fromComponents > 0)
    return `Pack ${TARGET_STOCK - packed} more (up to ${fromComponents})`;
  if (packed === 0 && (fromComponents === null || fromComponents === 0))
    return "Restock ingredients";
  return "No action needed";
}

function FilterLink({ label, value, active }: { label: string; value: FilterValue; active: FilterValue }) {
  const isActive = value === active;
  return (
    <Link
      href={value === "all" ? "/dashboard" : `/dashboard?filter=${value}`}
      className={isActive
        ? "rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white"
        : "rounded-md px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"}
    >
      {label}
    </Link>
  );
}

// ─── Run-out display helper ───────────────────────────────────────────────────

function runOutLabel(daysRemaining: number | null): {
  text: string;
  sub: string | null;
  color: string;
} {
  if (daysRemaining === null) {
    return { text: "No usage data", sub: null, color: "text-zinc-400" };
  }
  if (daysRemaining <= 0) {
    return { text: "Out of stock", sub: null, color: "text-red-600" };
  }
  const days = Math.floor(daysRemaining);
  const date = new Date();
  date.setDate(date.getDate() + days);
  const dayName = date.toLocaleDateString("en-AU", { weekday: "long" });

  if (days === 0) {
    return { text: "Runs out today", sub: dayName, color: "text-red-600" };
  }
  if (days === 1) {
    return { text: "Runs out tomorrow", sub: dayName, color: "text-red-500" };
  }
  const color = days <= 3 ? "text-red-500" : days <= LEAD_TIME_DAYS ? "text-amber-600" : "text-zinc-500";
  return { text: `Runs out in ${days} days`, sub: dayName, color };
}

// ─── Order Today panel ────────────────────────────────────────────────────────
// Primary decision element. Full-width, prominent. Answers:
// "What do I need to order today to avoid stockouts?"

function OrderTodayPanel({ ingredients }: { ingredients: IngredientRow[] }) {
  const toOrder = ingredients
    .filter((c) => c.needsOrder)
    .sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999));

  if (toOrder.length === 0) {
    // Find the minimum daysRemaining across ingredients that have usage data.
    const minDays = ingredients
      .filter((c) => c.daysRemaining !== null)
      .reduce<number | null>((min, c) => {
        const d = Math.floor(c.daysRemaining!);
        return min === null || d < min ? d : min;
      }, null);

    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold text-emerald-800">
              {minDays !== null
                ? `You're fully stocked for the next ${minDays} days`
                : "You're fully stocked"}
            </p>
            <p className="text-sm text-emerald-700">No orders needed today.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-red-300 bg-white shadow-md">
      {/* Header */}
      <div className="flex items-center gap-3 rounded-t-xl border-b border-red-100 bg-red-50 px-6 py-4">
        <span className="text-2xl">🔥</span>
        <div>
          <h2 className="text-base font-bold text-red-900">Order today</h2>
          <p className="text-xs text-red-700">
            {toOrder.length} ingredient{toOrder.length !== 1 ? "s" : ""} will run out before your next delivery arrives
          </p>
        </div>
        <Link
          href="/receipts"
          className="ml-auto shrink-0 rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-800"
        >
          Record delivery
        </Link>
      </div>

      {/* Rows */}
      <ul className="divide-y divide-zinc-100">
        {toOrder.map((c) => {
          const label = runOutLabel(c.daysRemaining);
          return (
            <li key={c.id} className="flex items-center gap-4 px-6 py-4 hover:bg-zinc-50/60">
              {/* Left: name + stock */}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-zinc-900">{c.name}</p>
                <p className="text-sm text-zinc-500">
                  {c.onHand <= 0
                    ? <span className="font-medium text-red-600">None in stock</span>
                    : <>{c.onHand.toFixed(1)} {c.unit} in stock</>}
                </p>
              </div>

              {/* Middle: run-out warning */}
              <div className="hidden shrink-0 text-right sm:block">
                <p className={`text-sm font-semibold ${label.color}`}>{label.text}</p>
                {label.sub && <p className="text-xs text-zinc-400">{label.sub}</p>}
              </div>

              {/* Right: order quantity */}
              <div className="shrink-0 text-right">
                {c.recommendedOrderQty > 0 ? (
                  <>
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Order</p>
                    <p className="text-lg font-bold text-zinc-900">
                      {c.recommendedOrderQty} {c.unit}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-zinc-400">—</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Production capacity card ─────────────────────────────────────────────────

function CardProductionCapacity({ rows }: { rows: Row[] }) {
  const packable = rows
    .filter((r) => r.availableFromComponents !== null && r.availableFromComponents > 0)
    .sort((a, b) => (b.availableFromComponents ?? 0) - (a.availableFromComponents ?? 0))
    .slice(0, 4);

  const totalUnits = rows.reduce((sum, r) => sum + (r.availableFromComponents ?? 0), 0);

  return (
    <div className="flex flex-col rounded-xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">📦</span>
        <h2 className="text-sm font-semibold text-zinc-800">Production capacity</h2>
      </div>
      <div className="grow">
        {packable.length > 0 ? (
          <>
            <p className="mb-3 text-sm text-zinc-600">
              You can make{" "}
              <span className="font-semibold text-zinc-900">{totalUnits} units</span>{" "}
              from current ingredients.
            </p>
            <ul className="space-y-1.5">
              {packable.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm text-zinc-700">{r.name}</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-blue-800">
                    {r.availableFromComponents} units
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-zinc-500">No products can be packed — order ingredients first.</p>
        )}
      </div>
      <Link
        href="/packing"
        className="mt-4 inline-block rounded-lg border border-zinc-300 bg-white px-4 py-2 text-center text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
      >
        Start packing
      </Link>
    </div>
  );
}

// ─── Finished stock card ──────────────────────────────────────────────────────

function CardFinishedStock({ rows }: { rows: Row[] }) {
  const out = rows.filter((r) => r.status === "OUT").slice(0, 4);
  const low = rows.filter((r) => r.status === "LOW").slice(0, 4 - out.length);
  const issues = [...out, ...low];
  const hasIssues = issues.length > 0;

  return (
    <div className={`flex flex-col rounded-xl border p-5 shadow-sm ${hasIssues ? "border-amber-200 bg-amber-50" : "border-zinc-200 bg-white"}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">{hasIssues ? (out.length > 0 ? "🔴" : "🟡") : "🟢"}</span>
        <h2 className="text-sm font-semibold text-zinc-800">Finished stock</h2>
      </div>
      <div className="grow">
        {hasIssues ? (
          <ul className="space-y-2">
            {issues.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-medium text-zinc-900">{r.name}</span>
                <span className={`shrink-0 text-sm font-semibold tabular-nums ${r.status === "OUT" ? "text-red-600" : "text-amber-700"}`}>
                  {r.packedOnHand} in stock
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-emerald-700">✅ All products are in stock</p>
        )}
      </div>
      <Link
        href="/skus"
        className="mt-4 inline-block rounded-lg border border-zinc-300 bg-white px-4 py-2 text-center text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
      >
        View all products
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const filter = (params.filter ?? "all") as FilterValue;
  const validFilters: FilterValue[] = ["all", "ready", "low", "out"];
  const activeFilter: FilterValue = validFilters.includes(filter) ? filter : "all";

  const [allRowsRaw, ingredients, shopifyInventory] = await Promise.all([
    getDashboardRows(),
    getIngredientPlanning(),
    getShopifyInventory(),
  ]);

  // Override packedOnHand with live Shopify inventory where a mapping exists.
  const allRows = allRowsRaw.map((row) => {
    if (!shopifyInventory.has(row.id)) return row;
    const packedOnHand = shopifyInventory.get(row.id)!;
    const totalPotential =
      row.availableFromComponents !== null
        ? packedOnHand + row.availableFromComponents
        : packedOnHand;
    const status: Row["status"] =
      packedOnHand <= 0 ? "OUT"
      : packedOnHand < PACKED_LOW_THRESHOLD ? "LOW"
      : "READY";
    return { ...row, packedOnHand, totalPotential, status };
  });

  const ready = allRows.filter((r) => r.status === "READY").length;
  const low   = allRows.filter((r) => r.status === "LOW").length;
  const out   = allRows.filter((r) => r.status === "OUT").length;

  const filteredRows =
    activeFilter === "all"
      ? allRows
      : allRows.filter((r) => r.status === activeFilter.toUpperCase() as Row["status"]);

  return (
    <PageShell
      active="/dashboard"
      title="Today's overview"
      description="What ingredients to order, production capacity, and finished stock status."
    >
      <div className="space-y-8">

        {/* ── Order Today — primary decision panel ─────────────────────────── */}
        <OrderTodayPanel ingredients={ingredients} />

        {/* ── Status counts ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center">
            <p className="text-3xl font-bold tabular-nums text-emerald-700">{ready}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-emerald-600">In stock</p>
          </div>
          <div className={`rounded-xl border px-5 py-4 text-center ${low > 0 ? "border-amber-200 bg-amber-50" : "border-zinc-200 bg-zinc-50"}`}>
            <p className={`text-3xl font-bold tabular-nums ${low > 0 ? "text-amber-700" : "text-zinc-400"}`}>{low}</p>
            <p className={`mt-1 text-xs font-semibold uppercase tracking-wide ${low > 0 ? "text-amber-600" : "text-zinc-400"}`}>Running low</p>
          </div>
          <div className={`rounded-xl border px-5 py-4 text-center ${out > 0 ? "border-red-200 bg-red-50" : "border-zinc-200 bg-zinc-50"}`}>
            <p className={`text-3xl font-bold tabular-nums ${out > 0 ? "text-red-700" : "text-zinc-400"}`}>{out}</p>
            <p className={`mt-1 text-xs font-semibold uppercase tracking-wide ${out > 0 ? "text-red-600" : "text-zinc-400"}`}>Out of stock</p>
          </div>
        </div>

        {/* ── Secondary cards ───────────────────────────────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-2">
          <CardFinishedStock rows={allRows} />
          <CardProductionCapacity rows={allRows} />
        </div>

        {/* ── All products table ───────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-700">All products</h2>
            <div className="flex items-center gap-2">
              <FilterLink label="All"   value="all"   active={activeFilter} />
              <FilterLink label="Ready" value="ready" active={activeFilter} />
              <FilterLink label="Low"   value="low"   active={activeFilter} />
              <FilterLink label="Out"   value="out"   active={activeFilter} />
              {activeFilter !== "all" && (
                <span className="ml-1 text-xs text-zinc-400">
                  {filteredRows.length} of {allRows.length}
                </span>
              )}
            </div>
          </div>

          {filteredRows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-400">
              No products match this filter.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3 text-right">In stock</th>
                    <th className="px-4 py-3 text-right">Can make more</th>
                    <th className="px-4 py-3 text-right">Total available</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Suggested action</th>
                    <th className="px-4 py-3">Last sale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredRows.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-50/70">
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900">{r.name}</p>
                        <p className="font-mono text-xs text-zinc-400">{r.sku}</p>
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums font-semibold ${r.packedOnHand <= 0 ? "text-red-600" : r.packedOnHand < PACKED_LOW_THRESHOLD ? "text-amber-700" : "text-zinc-900"}`}>
                        {r.packedOnHand}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-500">
                        {r.availableFromComponents === null
                          ? <span className="text-zinc-300" title="No recipe configured">—</span>
                          : r.availableFromComponents}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-zinc-800">
                        {r.totalPotential}
                      </td>
                      <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                      <td className="px-4 py-3 text-xs text-zinc-600">
                        {computeAction(r.packedOnHand, r.availableFromComponents)}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-500">{formatDate(r.lastSaleAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-zinc-400">
            &ldquo;In stock&rdquo; = live Shopify inventory. &ldquo;Can make more&rdquo; = additional units producible from current ingredients. Burn rate based on last {USAGE_DAYS} days of sales.
          </p>
        </div>

      </div>
    </PageShell>
  );
}
