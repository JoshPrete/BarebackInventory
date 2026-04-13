import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SkuForm } from "@/app/skus/sku-form";

export const dynamic = "force-dynamic";

export default async function SkusPage() {
  const skus = await prisma.sellableSKU.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-full bg-zinc-50">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-zinc-900">Sellable SKUs</h1>
          <nav className="flex flex-wrap gap-3 text-sm font-medium">
            <Link href="/" className="text-zinc-600 hover:text-zinc-900 hover:underline">
              Home
            </Link>
            <Link href="/components" className="text-zinc-600 hover:text-zinc-900 hover:underline">
              Components
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
          <h2 className="mb-4 text-lg font-medium text-zinc-900">New SKU</h2>
          <SkuForm />
        </section>

        <section>
          <h2 className="mb-4 text-lg font-medium text-zinc-900">All SKUs</h2>
          {skus.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">
              No SKUs yet. Add one above.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Bundle</th>
                    <th className="px-4 py-3 text-zinc-500">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {skus.map((s) => (
                    <tr key={s.id} className="hover:bg-zinc-50/80">
                      <td className="px-4 py-3 font-medium text-zinc-900">{s.name}</td>
                      <td className="px-4 py-3 font-mono text-zinc-700">{s.sku}</td>
                      <td className="px-4 py-3 text-zinc-700">{s.isBundle ? "Yes" : "No"}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {s.createdAt.toISOString().slice(0, 10)}
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
