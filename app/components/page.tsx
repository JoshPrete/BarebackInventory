import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ComponentForm } from "@/app/components/component-form";

export const dynamic = "force-dynamic";

export default async function ComponentsPage() {
  const [components, stockSums] = await Promise.all([
    prisma.component.findMany({
      orderBy: { createdAt: "desc" },
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
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-zinc-900">Components</h1>
          <nav className="flex flex-wrap gap-3 text-sm font-medium">
            <Link href="/" className="text-zinc-600 hover:text-zinc-900 hover:underline">
              Home
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
            <Link href="/receipts" className="text-zinc-600 hover:text-zinc-900 hover:underline">
              Receipts
            </Link>
            <Link href="/adjustments" className="text-zinc-600 hover:text-zinc-900 hover:underline">
              Adjustments
            </Link>
          </nav>
        </header>

        <section className="mb-10 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-zinc-900">New component</h2>
          <ComponentForm />
        </section>

        <section>
          <h2 className="mb-4 text-lg font-medium text-zinc-900">All components</h2>
          {components.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">
              No components yet. Add one above.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3 text-right">Stock</th>
                    <th className="px-4 py-3 text-right">Reorder pt</th>
                    <th className="px-4 py-3 text-right">Reorder qty</th>
                    <th className="px-4 py-3 text-zinc-500">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {components.map((c) => (
                    <tr key={c.id} className="hover:bg-zinc-50/80">
                      <td className="px-4 py-3 font-medium text-zinc-900">{c.name}</td>
                      <td className="px-4 py-3 text-zinc-700">{c.type}</td>
                      <td className="px-4 py-3 text-zinc-700">{c.unit}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-zinc-900">
                        {stockByComponentId.get(c.id) ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                        {c.reorderPoint}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                        {c.reorderQty}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {c.createdAt.toISOString().slice(0, 10)}
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
