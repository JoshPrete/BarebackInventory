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
    <Link href="/packing" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Packing
    </Link>
    <Link href="/packed-stock" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Packed stock
    </Link>
    <span className="font-semibold text-zinc-900">Stock</span>
    <Link href="/reorder" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Reorder
    </Link>
    <Link href="/receipts" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Receipts
    </Link>
    <Link href="/adjustments" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Adjustments
    </Link>
  </>
);

export default async function StockPage() {
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

  return (
    <div className="min-h-full bg-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Stock</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Current levels from all stock movements (receipts, sales, adjustments).
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
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="px-4 py-3">Component</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3 text-right">Current stock</th>
                    <th className="px-4 py-3 text-right">Reorder pt</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {components.map((c) => {
                    const current = stockByComponentId.get(c.id) ?? 0;
                    const status = stockStatus(current, c.reorderPoint);
                    return (
                      <tr key={c.id} className="hover:bg-zinc-50/80">
                        <td className="px-4 py-3 font-medium text-zinc-900">
                          {c.name}
                        </td>
                        <td className="px-4 py-3 text-zinc-700">{c.type}</td>
                        <td className="px-4 py-3 text-zinc-700">{c.unit}</td>
                        <td
                          className={`px-4 py-3 text-right tabular-nums font-medium ${
                            current < 0
                              ? "text-red-700"
                              : current === 0
                                ? "text-zinc-600"
                                : "text-zinc-900"
                          }`}
                        >
                          {current}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                          {c.reorderPoint}
                        </td>
                        <td className="px-4 py-3">
                          <span className={statusBadge(status)}>{status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
