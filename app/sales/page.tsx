import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SaleForm } from "@/app/sales/sale-form";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const skus = await prisma.sellableSKU.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, sku: true },
  });

  const recentSales = await prisma.manualSale.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    include: {
      lines: {
        include: { sku: { select: { name: true, sku: true } } },
      },
    },
  });

  return (
    <div className="min-h-full bg-zinc-50">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-zinc-900">Record sale</h1>
          <nav className="flex flex-wrap gap-3 text-sm font-medium">
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
            <Link href="/packing" className="text-zinc-600 hover:text-zinc-900 hover:underline">
              Packing
            </Link>
            <Link href="/packed-stock" className="text-zinc-600 hover:text-zinc-900 hover:underline">
              Packed stock
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
          <h2 className="mb-4 text-lg font-medium text-zinc-900">New sale</h2>
          <p className="mb-4 text-sm text-zinc-600">
            Sales deduct <strong>packed stock</strong> only (finished units). Use{" "}
            <Link href="/packing" className="font-medium text-zinc-800 underline">
              Packing
            </Link>{" "}
            to consume components and build packed inventory first.
          </p>
          <SaleForm skus={skus} />
        </section>

        <section>
          <h2 className="mb-4 text-lg font-medium text-zinc-900">Recent manual sales</h2>
          {recentSales.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">
              No sales recorded yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Order ref</th>
                    <th className="px-4 py-3">SKU line</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {recentSales.map((sale) =>
                    sale.lines.map((line) => (
                      <tr key={line.id} className="hover:bg-zinc-50/80">
                        <td className="px-4 py-3 text-zinc-500">
                          {sale.createdAt.toISOString().slice(0, 19).replace("T", " ")}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-700">
                          {sale.orderRef ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-zinc-900">
                          {line.sku.name}{" "}
                          <span className="font-mono text-zinc-600">({line.sku.sku})</span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{line.quantity}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
