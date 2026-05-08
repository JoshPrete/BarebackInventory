import { prisma } from "@/lib/prisma";
import { PageShell } from "@/app/_components/page-shell";
import { ComponentForm } from "@/app/components/component-form";

export const dynamic = "force-dynamic";

const USAGE_DAYS = 14;

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

export default async function ComponentsPage() {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - USAGE_DAYS);

  const [components, stockSums, bomRules, recentSaleLines] = await Promise.all([
    prisma.component.findMany({ orderBy: { name: "asc" } }),
    prisma.stockMovement.groupBy({
      by: ["componentId"],
      _sum: { qtyChange: true },
    }),
    // Which SKUs use each component, and how much per unit sold
    prisma.sKUComponentRule.findMany({
      select: { componentId: true, skuId: true, qtyPerUnit: true },
    }),
    // Recent sales to estimate consumption rate
    prisma.manualSaleLine.findMany({
      where: { manualSale: { createdAt: { gte: windowStart } } },
      select: { sellableSkuId: true, quantity: true },
    }),
  ]);

  // Current stock per component
  const stockById = new Map(
    stockSums.map((s) => [s.componentId, s._sum.qtyChange ?? 0]),
  );

  // Units sold per SKU in the window
  const soldBySku = new Map<string, number>();
  for (const line of recentSaleLines) {
    soldBySku.set(line.sellableSkuId, (soldBySku.get(line.sellableSkuId) ?? 0) + line.quantity);
  }

  // Per component: daily consumption (sum across all SKUs that use it) + product count
  const dailyUsageById = new Map<string, number>();
  const productCountById = new Map<string, number>();
  for (const rule of bomRules) {
    const sold = soldBySku.get(rule.skuId) ?? 0;
    const contribution = (sold * rule.qtyPerUnit) / USAGE_DAYS;
    dailyUsageById.set(rule.componentId, (dailyUsageById.get(rule.componentId) ?? 0) + contribution);
    productCountById.set(rule.componentId, (productCountById.get(rule.componentId) ?? 0) + 1);
  }

  const lowCount = components.filter((c) => {
    const s = stockStatus(stockById.get(c.id) ?? 0, c.reorderPoint);
    return s === "OUT" || s === "LOW";
  }).length;

  return (
    <PageShell
      active="/components"
      title="Components"
      description={
        components.length === 0
          ? "Add the raw inputs your products consume."
          : `${components.length} component${components.length !== 1 ? "s" : ""}${lowCount > 0 ? ` · ${lowCount} low or out` : " · all stocked"}`
      }
    >
      <div className="space-y-8">

        {/* Add form */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-sm font-semibold text-zinc-800">Add component</h2>
          <ComponentForm />
        </div>

        {/* Table */}
        {components.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-white px-8 py-12 text-center">
            <p className="text-sm font-medium text-zinc-700">No components yet</p>
            <p className="mt-1 text-sm text-zinc-500">
              Add the raw ingredients, packaging, and consumables your products use.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3 text-right">Stock</th>
                    <th className="px-4 py-3 text-right">Reorder pt</th>
                    <th className="px-4 py-3 text-right">MOQ</th>
                    <th className="px-4 py-3 text-right">Daily use</th>
                    <th className="px-4 py-3 text-center">Used by</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {components.map((c) => {
                    const current = stockById.get(c.id) ?? 0;
                    const status = stockStatus(current, c.reorderPoint);
                    const dailyUse = dailyUsageById.get(c.id) ?? 0;
                    const productCount = productCountById.get(c.id) ?? 0;
                    const daysLeft = dailyUse > 0 ? Math.floor(current / dailyUse) : null;
                    return (
                      <tr key={c.id} className="hover:bg-zinc-50/60">
                        <td className="px-4 py-3 font-medium text-zinc-900">{c.name}</td>
                        <td className="px-4 py-3 text-zinc-500">{c.type}</td>
                        <td className="px-4 py-3 text-zinc-500">{c.unit}</td>
                        <td className={`px-4 py-3 text-right tabular-nums font-medium ${current <= 0 ? "text-red-700" : "text-zinc-900"}`}>
                          {current % 1 === 0 ? current : current.toFixed(1)}
                          {daysLeft !== null && (
                            <span className={`ml-1 text-xs font-normal ${daysLeft <= 7 ? "text-red-500" : daysLeft <= 14 ? "text-amber-500" : "text-zinc-400"}`}>
                              ({daysLeft}d)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-500">{c.reorderPoint}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-500">{c.reorderQty}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-500">
                          {dailyUse > 0
                            ? `${dailyUse % 1 === 0 ? dailyUse : dailyUse.toFixed(1)} / day`
                            : <span className="text-zinc-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {productCount > 0 ? (
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${productCount > 1 ? "bg-blue-50 text-blue-700" : "bg-zinc-100 text-zinc-600"}`}>
                              {productCount} product{productCount !== 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-300">unused</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-zinc-400">
              Daily use and days remaining are estimated from the last {USAGE_DAYS} days of recorded sales.
              Components used by multiple products deplete faster as all product sales draw from the same pool.
            </p>
          </>
        )}

      </div>
    </PageShell>
  );
}
