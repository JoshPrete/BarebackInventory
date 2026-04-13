import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { MappingForm } from "@/app/mappings/mapping-form";
import { SkuSelector } from "@/app/mappings/sku-selector";

export const dynamic = "force-dynamic";

export default async function MappingsPage({
  searchParams,
}: {
  searchParams: Promise<{ skuId?: string }>;
}) {
  const { skuId } = await searchParams;

  const [skus, components, rules] = await Promise.all([
    prisma.sellableSKU.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true },
    }),
    prisma.component.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true },
    }),
    skuId
      ? prisma.sKUComponentRule.findMany({
          where: { skuId },
          include: { component: true },
          orderBy: { id: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const selectedSku = skuId
    ? skus.find((s) => s.id === skuId) ?? null
    : null;

  return (
    <div className="min-h-full bg-zinc-50">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-zinc-900">SKU → component mappings</h1>
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

        <section className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-zinc-900">Choose SKU</h2>
          <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
            <SkuSelector skus={skus} />
          </Suspense>
          {selectedSku ? (
            <p className="mt-3 text-sm text-zinc-600">
              Mapping rules for <span className="font-medium">{selectedSku.name}</span>{" "}
              <span className="font-mono text-zinc-500">({selectedSku.sku})</span>
            </p>
          ) : null}
        </section>

        <section className="mb-10 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-zinc-900">Add mapping</h2>
          <MappingForm skuId={skuId ?? null} components={components} />
        </section>

        <section>
          <h2 className="mb-4 text-lg font-medium text-zinc-900">
            Current mappings
            {selectedSku ? ` — ${selectedSku.sku}` : ""}
          </h2>
          {!skuId ? (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">
              Select a SKU to view its component rules.
            </p>
          ) : rules.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">
              No mappings for this SKU yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="px-4 py-3">Component</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3 text-right">Qty / unit sold</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {rules.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-50/80">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {r.component.name}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{r.component.unit}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                        {r.qtyPerUnit}
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
