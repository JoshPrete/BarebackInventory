import { PageShell } from "@/app/_components/page-shell";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PACKED_LOW_THRESHOLD = 5;
const TARGET_STOCK = 20;
const PLANNING_DAYS = 7;       // horizon for "order today" calculation
const USAGE_WINDOW_DAYS = 30;  // rolling window for daily-usage estimate

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
      packedOnHand <= 0
        ? "OUT"
        : packedOnHand < PACKED_LOW_THRESHOLD
          ? "LOW"
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
// Computes daily usage (rolling 30-day average from SALE movements) and
// projects forward PLANNING_DAYS days to derive order quantities.

async function getIngredientPlanning() {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - USAGE_WINDOW_DAYS);

  const [ingredients, currentSums, saleSums] = await Promise.all([
    prisma.component.findMany({
      select: { id: true, name: true, unit: true, reorderPoint: true },
      orderBy: { name: "asc" },
    }),
    // Total on-hand (all movement types).
    prisma.stockMovement.groupBy({
      by: ["componentId"],
      _sum: { qtyChange: true },
    }),
    // Usage over the past USAGE_WINDOW_DAYS days (SALE movements are negative qtyChange).
    prisma.stockMovement.groupBy({
      by: ["componentId"],
      where: { type: "SALE", createdAt: { gte: windowStart } },
      _sum: { qtyChange: true },
    }),
  ]);

  const onHandById = new Map(currentSums.map((s) => [s.componentId, s._sum.qtyChange ?? 0]));
  // SALE qtyChange is negative — abs gives units consumed.
  const usedById = new Map(saleSums.map((s) => [s.componentId, Math.abs(s._sum.qtyChange ?? 0)]));

  return ingredients.map((c) => {
    const onHand = onHandById.get(c.id) ?? 0;
    const totalUsed = usedById.get(c.id) ?? 0;
    const dailyUsage = totalUsed / USAGE_WINDOW_DAYS;

    // Days remaining before stockout (null = no usage history → can't estimate).
    const daysRemaining =
      dailyUsage > 0 ? Math.floor(onHand / dailyUsage) : null;

    // How much is needed for the next PLANNING_DAYS days.
    const required = dailyUsage * PLANNING_DAYS;
    // Order quantity = gap between what's needed and what's on hand.
    const orderQty = Math.max(0, Math.ceil(required - onHand));

    return { ...c, onHand, dailyUsage, daysRemaining, required, orderQty };
  });
}

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
    return `Pack ${TARGET_STOCK - packed} more (up to ${fromComponents} available)`;
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

// ─── Card A: Critical risk ────────────────────────────────────────────────────
// Ingredients likely to run out within PLANNING_DAYS days.

function CardCriticalRisk({ ingredients }: { ingredients: IngredientRow[] }) {
  const critical = ingredients
    .filter((c) => c.daysRemaining !== null && c.daysRemaining < PLANNING_DAYS)
    .sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999))
    .slice(0, 3);

  // Also flag anything already at or below zero with no usage history.
  const outNoHistory = ingredients
    .filter((c) => c.onHand <= 0 && c.daysRemaining === null)
    .slice(0, 3 - critical.length);

  const all = [...critical, ...outNoHistory];
  const hasRisk = all.length > 0;

  return (
    <div className={`flex flex-col rounded-xl border p-5 shadow-sm ${hasRisk ? "border-red-200 bg-red-50" : "border-zinc-200 bg-white"}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">{hasRisk ? "🔴" : "🟢"}</span>
        <h2 className="text-sm font-semibold text-zinc-800">Critical risk</h2>
      </div>

      <div className="grow">
        {hasRisk ? (
          <ul className="space-y-2.5">
            {all.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3">
                <span className="truncate text-sm font-medium text-zinc-900">{c.name}</span>
                <span className="shrink-0 text-right text-xs font-semibold text-red-700">
                  {c.daysRemaining !== null
                    ? c.daysRemaining <= 0
                      ? "Out now"
                      : `${c.daysRemaining}d left`
                    : "Out — no history"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-emerald-700">✅ All ingredients are in a safe range</p>
        )}
      </div>

      <Link
        href="/stock"
        className="mt-4 inline-block rounded-lg border border-zinc-300 bg-white px-4 py-2 text-center text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
      >
        Review ingredient stock
      </Link>
    </div>
  );
}

// ─── Card B: Order today ──────────────────────────────────────────────────────
// Top ingredients to order based on 7-day projected shortfall.

function CardOrderToday({ ingredients }: { ingredients: IngredientRow[] }) {
  const toOrder = ingredients
    .filter((c) => c.orderQty > 0)
    .sort((a, b) => b.orderQty - a.orderQty)
    .slice(0, 3);

  const hasOrders = toOrder.length > 0;

  return (
    <div className={`flex flex-col rounded-xl border p-5 shadow-sm ${hasOrders ? "border-amber-200 bg-amber-50" : "border-zinc-200 bg-white"}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">{hasOrders ? "🛒" : "🟢"}</span>
        <h2 className="text-sm font-semibold text-zinc-800">Order today</h2>
        {hasOrders && (
          <span className="ml-auto text-xs text-zinc-500">next {PLANNING_DAYS} days</span>
        )}
      </div>

      <div className="grow">
        {hasOrders ? (
          <ul className="space-y-3">
            {toOrder.map((c) => (
              <li key={c.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium text-zinc-900">{c.name}</span>
                  <span className="shrink-0 text-xs text-zinc-500 tabular-nums">
                    {c.onHand} {c.unit} on hand
                  </span>
                </div>
                <p className="mt-0.5 text-sm font-semibold text-amber-800">
                  You need {c.orderQty} more {c.unit}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-emerald-700">✅ You have enough stock for the next {PLANNING_DAYS} days</p>
        )}
      </div>

      <Link
        href="/receipts"
        className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-center text-xs font-semibold text-white transition-colors hover:bg-zinc-700"
      >
        Record a delivery
      </Link>
    </div>
  );
}

// ─── Card C: Production capacity ──────────────────────────────────────────────
// Passive view: how many units can be produced right now.

function CardProductionCapacity({ rows }: { rows: Row[] }) {
  const packable = rows
    .filter((r) => r.availableFromComponents !== null && r.availableFromComponents > 0)
    .sort((a, b) => (b.availableFromComponents ?? 0) - (a.availableFromComponents ?? 0))
    .slice(0, 3);

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
            <p className="mb-2 text-sm text-zinc-600">
              You can produce{" "}
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
          <p className="text-sm text-zinc-500">
            No products can be packed right now — order ingredients first.
          </p>
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

  const [allRows, ingredients] = await Promise.all([
    getDashboardRows(),
    getIngredientPlanning(),
  ]);

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
      description="What to order, what's at risk, and what you can produce."
    >
      <div className="space-y-8">

        {/* ── Status counts ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center">
            <p className="text-3xl font-bold tabular-nums text-emerald-700">{ready}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-emerald-600">Ready to sell</p>
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

        {/* ── Action cards ─────────────────────────────────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-3">
          <CardCriticalRisk ingredients={ingredients} />
          <CardOrderToday ingredients={ingredients} />
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
                    <th className="px-4 py-3 text-right">Ready to sell</th>
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
            &ldquo;Can make more&rdquo; = additional units producible from current ingredient stock.
            &ldquo;Days left&rdquo; estimates are based on a {USAGE_WINDOW_DAYS}-day rolling usage average.
          </p>
        </div>

      </div>
    </PageShell>
  );
}
