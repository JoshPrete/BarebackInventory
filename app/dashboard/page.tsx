import { PageShell } from "@/app/_components/page-shell";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PACKED_LOW_THRESHOLD = 5;
const TARGET_STOCK = 20;

// ─── Data layer ───────────────────────────────────────────────────────────────

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
      // Most recent SALE movement per SKU.
      prisma.packedStockMovement.groupBy({
        by: ["sellableSkuId"],
        where: { type: "SALE" },
        _max: { createdAt: true },
      }),
    ]);

  // Lookup maps.
  const packedById = new Map(
    packedSums.map((s) => [s.sellableSkuId, s._sum.qtyChange ?? 0]),
  );
  const componentOnHand = new Map(
    componentSums.map((s) => [s.componentId, s._sum.qtyChange ?? 0]),
  );
  const lastSaleById = new Map(
    lastSales.map((s) => [s.sellableSkuId, s._max.createdAt]),
  );

  // Group BOM rules by SKU.
  const rulesBySkuId = new Map<string, { componentId: string; qtyPerUnit: number }[]>();
  for (const r of bomRules) {
    const list = rulesBySkuId.get(r.skuId) ?? [];
    list.push({ componentId: r.componentId, qtyPerUnit: r.qtyPerUnit });
    rulesBySkuId.set(r.skuId, list);
  }

  return skus.map((sku) => {
    const packedOnHand = packedById.get(sku.id) ?? 0;
    const rules = rulesBySkuId.get(sku.id) ?? [];

    // Available from components = min over BOM rules of floor(componentStock / qtyPerUnit).
    // null means no BOM — can't compute.
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

type Row = Awaited<ReturnType<typeof getDashboardRows>>[number];
type FilterValue = "all" | "ready" | "low" | "out";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeAction(packed: number, fromComponents: number | null): string {
  if (packed === 0 && fromComponents !== null && fromComponents > 0)
    return `Produce ${fromComponents}`;
  if (packed < TARGET_STOCK && fromComponents !== null && fromComponents > 0)
    return `Produce ${TARGET_STOCK - packed} (up to ${fromComponents})`;
  if (packed === 0 && (fromComponents === null || fromComponents === 0))
    return "Restock components";
  return "No action";
}

function statusBadge(status: Row["status"]) {
  const base = "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums";
  switch (status) {
    case "READY":
      return <span className={`${base} bg-emerald-100 text-emerald-800`}>Ready</span>;
    case "LOW":
      return <span className={`${base} bg-amber-100 text-amber-900`}>Low</span>;
    case "OUT":
      return <span className={`${base} bg-red-100 text-red-800`}>Out</span>;
  }
}

function formatDate(d: Date | null) {
  if (!d) return <span className="text-zinc-400">—</span>;
  return (
    <span title={d.toISOString()}>
      {d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
    </span>
  );
}

function filterLink(label: string, value: FilterValue, active: FilterValue) {
  const isActive = value === active;
  return (
    <Link
      href={value === "all" ? "/dashboard" : `/dashboard?filter=${value}`}
      className={
        isActive
          ? "rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white"
          : "rounded-md px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
      }
    >
      {label}
    </Link>
  );
}

// ─── Summary counts ───────────────────────────────────────────────────────────

function SummaryBar({ rows }: { rows: Row[] }) {
  const ready = rows.filter((r) => r.status === "READY").length;
  const low = rows.filter((r) => r.status === "LOW").length;
  const out = rows.filter((r) => r.status === "OUT").length;

  return (
    <div className="grid grid-cols-3 gap-4 sm:grid-cols-3">
      <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Ready</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-emerald-700">{ready}</p>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Low</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-amber-700">{low}</p>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Out</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-red-700">{out}</p>
      </div>
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

  const allRows = await getDashboardRows();

  const rows =
    activeFilter === "all"
      ? allRows
      : allRows.filter((r) => r.status === activeFilter.toUpperCase() as Row["status"]);

  return (
    <PageShell
      active="/dashboard"
      title="Stock dashboard"
      description="Packed on-hand, component potential, and last-sale date for every sellable SKU."
    >
      <div className="space-y-6">
        {/* Quick-link cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              { label: "Component stock summary", href: "/stock",        desc: "Raw & packaging on-hand levels" },
              { label: "Packed stock on hand",    href: "/packed-stock", desc: "Ready-to-sell unit counts" },
              { label: "Open alerts",             href: "/warnings",     desc: "Low stock and BOM warnings" },
              { label: "Recent receipts",         href: "/receipts",     desc: "Latest supplier deliveries" },
              { label: "Recent sales",            href: "/sales",        desc: "Sales ledger and order history" },
              { label: "Shopify sync status",     href: "/integrations", desc: "Catalog sync and variant mappings" },
            ] as const
          ).map(({ label, href, desc }) => (
            <Link
              key={href}
              href={href}
              className="group cursor-pointer rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50"
            >
              <p className="text-sm font-semibold text-zinc-800 group-hover:text-zinc-900">{label}</p>
              <p className="mt-1 text-xs text-zinc-500">{desc}</p>
            </Link>
          ))}
        </div>

        {/* Summary counts */}
        <SummaryBar rows={allRows} />

        {/* Filter bar */}
        <div className="flex items-center gap-2">
          {filterLink("All", "all", activeFilter)}
          {filterLink("Ready", "ready", activeFilter)}
          {filterLink("Low", "low", activeFilter)}
          {filterLink("Out", "out", activeFilter)}
          {activeFilter !== "all" && (
            <span className="ml-2 text-xs text-zinc-400">
              {rows.length} of {allRows.length} SKU{allRows.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Table */}
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-400">
            No SKUs match this filter.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-600">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3 text-right">Packed on hand</th>
                  <th className="px-4 py-3 text-right">From components</th>
                  <th className="px-4 py-3 text-right">Total potential</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Last sale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-50/70">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{r.sku}</td>
                    <td className="px-4 py-3 font-medium text-zinc-900">{r.name}</td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums font-medium ${
                        r.packedOnHand <= 0
                          ? "text-red-600"
                          : r.packedOnHand < PACKED_LOW_THRESHOLD
                            ? "text-amber-700"
                            : "text-zinc-900"
                      }`}
                    >
                      {r.packedOnHand}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-600">
                      {r.availableFromComponents === null ? (
                        <span className="text-zinc-300" title="No BOM configured">—</span>
                      ) : (
                        r.availableFromComponents
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-800 font-medium">
                      {r.totalPotential}
                    </td>
                    <td className="px-4 py-3">{statusBadge(r.status)}</td>
                    <td className="px-4 py-3 text-xs text-zinc-600">
                      {computeAction(r.packedOnHand, r.availableFromComponents)}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{formatDate(r.lastSaleAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-zinc-400">
          &ldquo;From components&rdquo; = how many more packed units could be produced from current
          raw stock given each SKU&apos;s bill of materials. &ldquo;—&rdquo; means no BOM is
          configured.
        </p>
      </div>
    </PageShell>
  );
}
