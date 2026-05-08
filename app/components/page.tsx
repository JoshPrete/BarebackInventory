import { prisma } from "@/lib/prisma";
import { PageShell } from "@/app/_components/page-shell";
import { ComponentForm } from "@/app/components/component-form";

export const dynamic = "force-dynamic";

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
  const [components, stockSums] = await Promise.all([
    prisma.component.findMany({ orderBy: { name: "asc" } }),
    prisma.stockMovement.groupBy({
      by: ["componentId"],
      _sum: { qtyChange: true },
    }),
  ]);

  const stockById = new Map(
    stockSums.map((s) => [s.componentId, s._sum.qtyChange ?? 0]),
  );

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
          : `${components.length} component${components.length !== 1 ? "s" : ""}${lowCount > 0 ? ` · ${lowCount} low or out` : ""}`
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
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-right">Reorder pt</th>
                  <th className="px-4 py-3 text-right">Order qty</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {components.map((c) => {
                  const current = stockById.get(c.id) ?? 0;
                  const status = stockStatus(current, c.reorderPoint);
                  return (
                    <tr key={c.id} className="hover:bg-zinc-50/60">
                      <td className="px-4 py-3 font-medium text-zinc-900">{c.name}</td>
                      <td className="px-4 py-3 text-zinc-500">{c.unit}</td>
                      <td className={`px-4 py-3 text-right tabular-nums font-medium ${current <= 0 ? "text-red-700" : "text-zinc-900"}`}>
                        {current}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-500">{c.reorderPoint}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-500">{c.reorderQty}</td>
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
        )}

      </div>
    </PageShell>
  );
}
