import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { PageShell } from "@/app/_components/page-shell";
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

  const selectedSku = skuId ? skus.find((s) => s.id === skuId) ?? null : null;
  const mappedCount = await prisma.sellableSKU.count({
    where: { skuComponentRules: { some: {} } },
  });
  const unmappedCount = skus.length - mappedCount;

  return (
    <PageShell
      active="/mappings"
      title="Recipes"
      description={
        skus.length === 0
          ? "Sync products first, then map each one to its ingredients."
          : `${mappedCount} mapped · ${unmappedCount} need${unmappedCount !== 1 ? "" : "s"} a recipe`
      }
    >
      <div className="space-y-6">

        {skus.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-white px-8 py-12 text-center">
            <p className="text-sm font-medium text-zinc-700">No products yet</p>
            <p className="mt-1 text-sm text-zinc-500">
              Sync from Shopify on the Products page, then come back to map recipes.
            </p>
          </div>
        )}

        {components.length === 0 && skus.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-sm font-semibold text-amber-900">No components yet</p>
            <p className="mt-0.5 text-xs text-amber-700">
              Add your ingredients on the Components page before mapping recipes.
            </p>
          </div>
        )}

        {skus.length > 0 && (
          <>
            <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-semibold text-zinc-800">Select product</h2>
              <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
                <SkuSelector skus={skus} />
              </Suspense>
              {selectedSku && (
                <p className="text-sm text-zinc-600">
                  Recipe for <span className="font-medium">{selectedSku.name}</span>{" "}
                  <span className="font-mono text-xs text-zinc-400">{selectedSku.sku}</span>
                </p>
              )}
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-zinc-800">Add ingredient</h2>
              <MappingForm skuId={skuId ?? null} components={components} />
            </div>

            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
                Current recipe{selectedSku ? ` — ${selectedSku.name}` : ""}
              </h2>
              {!skuId ? (
                <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-white px-8 py-10 text-center">
                  <p className="text-sm text-zinc-500">Select a product above to view or edit its recipe.</p>
                </div>
              ) : rules.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-white px-8 py-10 text-center">
                  <p className="text-sm text-zinc-500">No ingredients mapped yet — add one above.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-4 py-3">Ingredient</th>
                        <th className="px-4 py-3">Unit</th>
                        <th className="px-4 py-3 text-right">Qty per unit sold</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {rules.map((r) => (
                        <tr key={r.id} className="hover:bg-zinc-50/60">
                          <td className="px-4 py-3 font-medium text-zinc-900">{r.component.name}</td>
                          <td className="px-4 py-3 text-zinc-500">{r.component.unit}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-zinc-700">{r.qtyPerUnit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </PageShell>
  );
}
