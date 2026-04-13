import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdjustmentForm } from "@/app/adjustments/adjustment-form";

export const dynamic = "force-dynamic";

const navLinks = (
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
    <Link href="/receipts" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Receipts
    </Link>
    <Link href="/movements" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Movements
    </Link>
  </>
);

export default async function AdjustmentsPage() {
  const [components, recent] = await Promise.all([
    prisma.component.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true },
    }),
    prisma.stockMovement.findMany({
      where: { type: "ADJUSTMENT", sourceType: "manual_adjustment" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { component: { select: { name: true, unit: true } } },
    }),
  ]);

  return (
    <div className="min-h-full bg-zinc-50">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-zinc-900">Manual adjustment</h1>
          <nav className="flex flex-wrap gap-3 text-sm font-medium">{navLinks}</nav>
        </header>

        <section className="mb-10 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-zinc-900">New adjustment</h2>
          <AdjustmentForm components={components} />
        </section>

        <section>
          <h2 className="mb-4 text-lg font-medium text-zinc-900">Recent adjustments</h2>
          {recent.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">
              No manual adjustments yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Component</th>
                    <th className="px-4 py-3 text-right">Qty change</th>
                    <th className="px-4 py-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {recent.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-50/80">
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                        {r.createdAt.toISOString().slice(0, 19).replace("T", " ")}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {r.component.name}{" "}
                        <span className="font-normal text-zinc-500">({r.component.unit})</span>
                      </td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums font-medium ${
                          r.qtyChange < 0 ? "text-red-700" : "text-green-700"
                        }`}
                      >
                        {r.qtyChange > 0 ? "+" : ""}
                        {r.qtyChange}
                      </td>
                      <td className="max-w-md px-4 py-3 text-zinc-700">{r.note ?? "—"}</td>
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
