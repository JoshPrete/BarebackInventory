import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageShell } from "@/app/_components/page-shell";

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

export default async function ReorderPage() {
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

  const rows = components
    .map((c) => {
      const current = stockById.get(c.id) ?? 0;
      const needed = Math.max(0, c.reorderPoint - current);
      return { ...c, current, needed, status: stockStatus(current, c.reorderPoint) };
    })
    .filter((r) => r.needed > 0)
    .sort((a, b) => b.needed - a.needed);

  return (
    <PageShell
      active="/reorder"
      title="Orders"
      description={
        rows.length === 0
          ? components.length === 0
            ? "Add components first to see reorder alerts."
            : "Nothing to order — all components are above their reorder points."
          : `${rows.length} component${rows.length !== 1 ? "s" : ""} need${rows.length === 1 ? "s" : ""} ordering`
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

        {components.length > 0 && rows.length === 0 && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4">
            <p className="text-sm font-semibold text-emerald-900">All clear</p>
            <p className="mt-0.5 text-xs text-emerald-700">
              Every component is at or above its reorder point.
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
                  <th className="px-4 py-3 text-right">Current</th>
                  <th className="px-4 py-3 text-right">Reorder pt</th>
                  <th className="px-4 py-3 text-right">Needed</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-50/60">
                    <td className="px-4 py-3 font-medium text-zinc-900">{r.name}</td>
                    <td className="px-4 py-3 text-zinc-500">{r.unit}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${r.current <= 0 ? "text-red-700" : "text-zinc-900"}`}>
                      {r.current}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-500">{r.reorderPoint}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-amber-900">{r.needed}</td>
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

      </div>
    </PageShell>
  );
}
