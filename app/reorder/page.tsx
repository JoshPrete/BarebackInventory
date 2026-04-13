import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function stockStatus(
  current: number,
  reorderPoint: number,
): "OUT" | "LOW" | "OK" {
  if (current <= 0) return "OUT";
  if (current <= reorderPoint) return "LOW";
  return "OK";
}

function statusBadge(status: "OUT" | "LOW" | "OK") {
  const base =
    "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums";
  switch (status) {
    case "OUT":
      return `${base} bg-red-100 text-red-800`;
    case "LOW":
      return `${base} bg-amber-100 text-amber-900`;
    default:
      return `${base} bg-emerald-100 text-emerald-900`;
  }
}

const nav = (
  <>
    <Link href="/" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Home
    </Link>
    <Link href="/components" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Components
    </Link>
    <Link href="/skus" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      SKUs
    </Link>
    <Link href="/mappings" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Mappings
    </Link>
    <Link href="/sales" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Sales
    </Link>
    <Link href="/movements" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Movements
    </Link>
    <Link href="/stock" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Stock
    </Link>
    <span className="font-semibold text-zinc-900">Reorder</span>
    <Link href="/receipts" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Receipts
    </Link>
    <Link href="/adjustments" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Adjustments
    </Link>
  </>
);

export default async function ReorderPage() {
  const [components, stockSums] = await Promise.all([
    prisma.component.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.stockMovement.groupBy({
      by: ["componentId"],
      _sum: { qtyChange: true },
    }),
  ]);

  const stockByComponentId = new Map(
    stockSums.map((s) => [s.componentId, s._sum.qtyChange ?? 0]),
  );

  const rows = components
    .map((c) => {
      const current = stockByComponentId.get(c.id) ?? 0;
      const neededQty = Math.max(0, c.reorderPoint - current);
      const status = stockStatus(current, c.reorderPoint);
      return {
        id: c.id,
        name: c.name,
        type: c.type,
        unit: c.unit,
        current,
        reorderPoint: c.reorderPoint,
        neededQty,
        status,
      };
    })
    .filter((r) => r.neededQty > 0)
    .sort((a, b) => b.neededQty - a.neededQty);

  return (
    <div className="min-h-full bg-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Reorder</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Components below reorder point. Needed qty = max(0, reorder point − current stock).
            </p>
          </div>
          <nav className="flex flex-wrap gap-3 text-sm font-medium">{nav}</nav>
        </header>

        <section>
          {components.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">
              No components yet. Add components under{" "}
              <Link href="/components" className="font-medium text-zinc-700 underline">
                Components
              </Link>
              .
            </p>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
              <p className="text-center text-sm font-medium text-zinc-900">
                No shortages right now
              </p>
              <p className="mt-2 text-center text-sm text-zinc-600">
                Every component is at or above its reorder point. This page is working; there are
                simply no items to reorder at the moment. Check{" "}
                <Link href="/stock" className="font-medium text-zinc-800 underline">
                  Stock
                </Link>{" "}
                for full levels.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="px-4 py-3">Component</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3 text-right">Current stock</th>
                    <th className="px-4 py-3 text-right">Reorder pt</th>
                    <th className="px-4 py-3 text-right">Needed qty</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-50/80">
                      <td className="px-4 py-3 font-medium text-zinc-900">{r.name}</td>
                      <td className="px-4 py-3 text-zinc-700">{r.type}</td>
                      <td className="px-4 py-3 text-zinc-700">{r.unit}</td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums font-medium ${
                          r.current < 0
                            ? "text-red-700"
                            : r.current === 0
                              ? "text-zinc-600"
                              : "text-zinc-900"
                        }`}
                      >
                        {r.current}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                        {r.reorderPoint}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-amber-900">
                        {r.neededQty}
                      </td>
                      <td className="px-4 py-3">
                        <span className={statusBadge(r.status)}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
