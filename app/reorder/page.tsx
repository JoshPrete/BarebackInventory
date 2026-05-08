import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageShell } from "@/app/_components/page-shell";

export const dynamic = "force-dynamic";

const USAGE_DAYS = 14;
const LEAD_TIME_DAYS = 7;

function stockStatus(current: number, reorderPoint: number): "OUT" | "LOW" | "OK" {
  if (current <= 0) return "OUT";
  if (current <= reorderPoint) return "LOW";
  return "OK";
}

const STATUS_STYLES = {
  OUT: "bg-red-100 text-red-800",
  LOW: "bg-amber-100 text-amber-900",
  OK: "bg-emerald-100 text-emerald-900",
};

function fmtQty(n: number, unit: string) {
  return `${n % 1 === 0 ? n : n.toFixed(1)} ${unit}`;
}

export default async function ReorderPage() {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - USAGE_DAYS);

  const [components, stockSums, bomRules, recentSaleLines] = await Promise.all([
    prisma.component.findMany({ orderBy: { name: "asc" } }),
    prisma.stockMovement.groupBy({
      by: ["componentId"],
      _sum: { qtyChange: true },
    }),
    prisma.sKUComponentRule.findMany({
      select: { componentId: true, skuId: true, qtyPerUnit: true },
    }),
    prisma.manualSaleLine.findMany({
      where: { manualSale: { createdAt: { gte: windowStart } } },
      select: { sellableSkuId: true, quantity: true },
    }),
  ]);

  const stockById = new Map(
    stockSums.map((s) => [s.componentId, s._sum.qtyChange ?? 0]),
  );

  const soldBySku = new Map<string, number>();
  for (const line of recentSaleLines) {
    soldBySku.set(line.sellableSkuId, (soldBySku.get(line.sellableSkuId) ?? 0) + line.quantity);
  }

  const dailyUsageById = new Map<string, number>();
  const productCountById = new Map<string, number>();
  for (const rule of bomRules) {
    const sold = soldBySku.get(rule.skuId) ?? 0;
    const contribution = (sold * rule.qtyPerUnit) / USAGE_DAYS;
    dailyUsageById.set(rule.componentId, (dailyUsageById.get(rule.componentId) ?? 0) + contribution);
    productCountById.set(rule.componentId, (productCountById.get(rule.componentId) ?? 0) + 1);
  }

  const rows = components
    .map((c) => {
      const current = stockById.get(c.id) ?? 0;
      const status = stockStatus(current, c.reorderPoint);
      const dailyUse = dailyUsageById.get(c.id) ?? 0;
      const daysLeft = dailyUse > 0 ? current / dailyUse : null;
      // Suggested order qty: at least MOQ, rounded up to cover lead time + buffer
      const suggestedQty = Math.max(
        c.reorderQty,
        dailyUse > 0 ? Math.ceil(dailyUse * (LEAD_TIME_DAYS + 7)) : c.reorderQty,
      );
      const productCount = productCountById.get(c.id) ?? 0;
      return { ...c, current, status, dailyUse, daysLeft, suggestedQty, productCount };
    })
    // Show anything below reorder point OR with fewer days left than lead time
    .filter((r) => {
      if (r.status === "OUT" || r.status === "LOW") return true;
      if (r.daysLeft !== null && r.daysLeft <= LEAD_TIME_DAYS) return true;
      return false;
    })
    .sort((a, b) => {
      // Sort: OUT first, then by days left ascending (most urgent first)
      if (a.status === "OUT" && b.status !== "OUT") return -1;
      if (b.status === "OUT" && a.status !== "OUT") return 1;
      const aD = a.daysLeft ?? 999;
      const bD = b.daysLeft ?? 999;
      return aD - bD;
    });

  const allClear = components.length > 0 && rows.length === 0;

  return (
    <PageShell
      active="/reorder"
      title="Orders"
      description={
        rows.length === 0
          ? components.length === 0
            ? "Add components first to see reorder alerts."
            : "Nothing urgent — all components are above their reorder points."
          : `${rows.length} component${rows.length !== 1 ? "s" : ""} need${rows.length === 1 ? "s" : ""} attention`
      }
    >
      <div className="space-y-6">

        {components.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-white px-8 py-12 text-center">
            <p className="text-sm font-medium text-zinc-700">No components yet</p>
            <p className="mt-1 text-sm text-zinc-500">
              Add ingredients on the{" "}
              <Link href="/components" className="font-medium text-zinc-700 underline">
                Components
              </Link>{" "}
              page, then set reorder points to see alerts here.
            </p>
          </div>
        )}

        {allClear && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4">
            <p className="text-sm font-semibold text-emerald-900">All clear</p>
            <p className="mt-0.5 text-xs text-emerald-700">
              Every component is above its reorder point and has sufficient days of stock.
            </p>
          </div>
        )}

        {rows.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Component</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3 text-center">Used by</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-right">Daily use</th>
                  <th className="px-4 py-3 text-right">Days left</th>
                  <th className="px-4 py-3 text-right">Suggested order</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-50/60">
                    <td className="px-4 py-3 font-medium text-zinc-900">{r.name}</td>
                    <td className="px-4 py-3 text-zinc-500">{r.unit}</td>
                    <td className="px-4 py-3 text-center">
                      {r.productCount > 0 ? (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${r.productCount > 1 ? "bg-blue-50 text-blue-700" : "bg-zinc-100 text-zinc-600"}`}>
                          {r.productCount}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-300">—</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${r.current <= 0 ? "text-red-700" : "text-zinc-900"}`}>
                      {r.current % 1 === 0 ? r.current : r.current.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-500">
                      {r.dailyUse > 0 ? `${r.dailyUse.toFixed(1)} / day` : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums font-semibold ${r.daysLeft === null ? "text-zinc-400" : r.daysLeft <= 3 ? "text-red-600" : r.daysLeft <= LEAD_TIME_DAYS ? "text-amber-600" : "text-zinc-700"}`}>
                      {r.daysLeft === null ? "—" : `${Math.floor(r.daysLeft)}d`}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-zinc-800">
                      {fmtQty(r.suggestedQty, r.unit)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > 0 && (
          <p className="text-xs text-zinc-400">
            Daily use is aggregated across all products that share each component, estimated from the last {USAGE_DAYS} days of sales.
            Suggested order = max(MOQ, enough to cover {LEAD_TIME_DAYS + 7} days at current rate).
          </p>
        )}

      </div>
    </PageShell>
  );
}
