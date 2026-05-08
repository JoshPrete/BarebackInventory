import Link from "next/link";
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

  // Fetch all SKUs with classification via raw SQL
  const [allSkuRows, components, sourceRows] = await Promise.all([
    prisma.$queryRaw<{ id: string; name: string; sku: string; classification: string | null }[]>`
      SELECT "id", "name", "sku", "classification" FROM "SellableSKU" ORDER BY "name"
    `,
    prisma.component.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true, type: true },
    }),
    // sourceSkuId may not be in the stale Prisma client — read via raw SQL
    prisma.$queryRaw<{ id: string; sourceSkuId: string | null }[]>`
      SELECT "id", "sourceSkuId" FROM "Component"
    `,
  ]);

  const sourceById = new Map(sourceRows.map((r) => [r.id, r.sourceSkuId]));

  // Components with fromShopify flag for the picker
  const componentOptions = components.map((c) => ({
    ...c,
    fromShopify: sourceById.get(c.id) !== null && sourceById.get(c.id) !== undefined,
  }));

  // For the SKU selector: only show FINISHED_PRODUCT and BUNDLE (plannable products).
  // Unclassified products are included so users can still map recipes before classifying.
  const EXCLUDED_FROM_RECIPES = new Set(["PACKAGING_ITEM", "RAW_COMPONENT_SOLD", "IGNORED"]);
  const plannableSkus = allSkuRows.filter(
    (s) => !EXCLUDED_FROM_RECIPES.has(s.classification ?? ""),
  );

  // Fetch rules for selected SKU
  const rules = skuId
    ? await prisma.sKUComponentRule.findMany({
        where: { skuId },
        include: { component: true },
        orderBy: { id: "asc" },
      })
    : [];

  const selectedSku = skuId ? plannableSkus.find((s) => s.id === skuId) ?? null : null;

  const mappedCount = plannableSkus.filter(
    (s) => rules.length > 0 && s.id === skuId ? true : false, // approximation — count below
  ).length;
  // Accurate count: SKUs that have at least one rule
  const skuIdsWithRules = await prisma.sKUComponentRule
    .findMany({ select: { skuId: true }, distinct: ["skuId"] })
    .then((r) => new Set(r.map((x) => x.skuId)));

  const plannableMapped = plannableSkus.filter((s) => skuIdsWithRules.has(s.id)).length;
  const plannableUnmapped = plannableSkus.length - plannableMapped;

  // Group components by type for the "available ingredients" panel
  const ORDER = ["Packaging", "Ingredient"];
  const byType = new Map<string, typeof componentOptions>();
  for (const c of componentOptions) {
    const key = c.type || "Other";
    const list = byType.get(key) ?? [];
    list.push(c);
    byType.set(key, list);
  }
  const typeGroups = [...byType.entries()].sort(([a], [b]) => {
    const ai = ORDER.indexOf(a);
    const bi = ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  const hasNoComponents = components.length === 0;
  const hasNoPlannableSkus = plannableSkus.length === 0;

  return (
    <PageShell
      active="/mappings"
      title="Recipes"
      description={
        plannableSkus.length === 0
          ? "Classify products first, then map each finished product to its ingredients."
          : `${plannableMapped} of ${plannableSkus.length} product${plannableSkus.length !== 1 ? "s" : ""} mapped · ${plannableUnmapped} still need${plannableUnmapped === 1 ? "s" : ""} a recipe`
      }
    >
      <div className="space-y-8">

        {/* Setup guides */}
        {hasNoPlannableSkus && (
          <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-white px-8 py-12 text-center">
            <p className="text-sm font-medium text-zinc-700">No finished products yet</p>
            <p className="mt-1 text-sm text-zinc-500">
              On the{" "}
              <Link href="/skus" className="font-medium text-zinc-700 underline">Products</Link>
              {" "}page, classify each Shopify product as a Finished product or Bundle to start building recipes.
            </p>
          </div>
        )}

        {!hasNoPlannableSkus && hasNoComponents && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-sm font-semibold text-amber-900">No ingredients available yet</p>
            <p className="mt-0.5 text-xs text-amber-700">
              Classify Shopify products as Packaging or Component to auto-create ingredients,
              or{" "}
              <Link href="/components" className="font-medium text-amber-900 underline">
                add them manually on the Components page.
              </Link>
            </p>
          </div>
        )}

        {/* ── Recipe editor ───────────────────────────────────────────── */}
        {!hasNoPlannableSkus && (
          <div className="rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-zinc-100 bg-zinc-50 px-5 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                Recipe editor
              </h2>
            </div>
            <div className="p-5 space-y-6">

              {/* Product selector */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-700">Select product</p>
                <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
                  <SkuSelector skus={plannableSkus} />
                </Suspense>
                {selectedSku && (
                  <p className="text-xs text-zinc-500">
                    Editing recipe for <span className="font-medium text-zinc-800">{selectedSku.name}</span>
                    {" "}<span className="font-mono">{selectedSku.sku}</span>
                    {selectedSku.classification === "BUNDLE" && (
                      <span className="ml-2 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">Bundle</span>
                    )}
                  </p>
                )}
              </div>

              {/* Current recipe */}
              {skuId && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-zinc-700">
                    Current recipe
                    {rules.length > 0 && (
                      <span className="ml-2 text-xs font-normal text-zinc-400">{rules.length} ingredient{rules.length !== 1 ? "s" : ""}</span>
                    )}
                  </p>
                  {rules.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-zinc-200 px-4 py-6 text-center">
                      <p className="text-sm text-zinc-400">No ingredients yet — add one below.</p>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-zinc-200">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          <tr>
                            <th className="px-4 py-2">Ingredient</th>
                            <th className="px-4 py-2">Type</th>
                            <th className="px-4 py-2">Unit</th>
                            <th className="px-4 py-2 text-right">Qty per unit sold</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {rules.map((r) => (
                            <tr key={r.id} className="hover:bg-zinc-50/60">
                              <td className="px-4 py-2 font-medium text-zinc-900">{r.component.name}</td>
                              <td className="px-4 py-2 text-xs text-zinc-400">{r.component.type}</td>
                              <td className="px-4 py-2 text-zinc-500">{r.component.unit}</td>
                              <td className="px-4 py-2 text-right tabular-nums text-zinc-700">{r.qtyPerUnit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Add ingredient form */}
              {skuId && !hasNoComponents && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-zinc-700">Add ingredient</p>
                  <MappingForm skuId={skuId} components={componentOptions} />
                </div>
              )}

            </div>
          </div>
        )}

        {/* ── Available ingredients panel ─────────────────────────────── */}
        {components.length > 0 && (
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Available ingredients
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {typeGroups.map(([typeName, items]) => {
                const fromShopify = items.filter((c) => c.fromShopify);
                const manual = items.filter((c) => !c.fromShopify);
                return (
                  <div key={typeName} className="rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden">
                    <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-2 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                        {typeName}
                      </span>
                      <span className="text-xs text-zinc-400">{items.length}</span>
                    </div>
                    <ul className="divide-y divide-zinc-50 text-sm">
                      {fromShopify.length > 0 && (
                        <>
                          {fromShopify.map((c) => (
                            <li key={c.id} className="flex items-center justify-between px-4 py-2.5">
                              <span className="font-medium text-zinc-800">{c.name}</span>
                              <span className="flex items-center gap-2 text-xs text-zinc-400">
                                {c.unit}
                                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-600 font-medium">
                                  Shopify
                                </span>
                              </span>
                            </li>
                          ))}
                        </>
                      )}
                      {manual.map((c) => (
                        <li key={c.id} className="flex items-center justify-between px-4 py-2.5">
                          <span className="font-medium text-zinc-800">{c.name}</span>
                          <span className="text-xs text-zinc-400">{c.unit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-zinc-400">
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-600 font-medium">Shopify</span>
              {" "}= auto-created when you classified that product as Packaging or Component on the{" "}
              <Link href="/skus" className="hover:underline">Products page.</Link>
              {" "}
              <Link href="/components" className="hover:underline">Add more on the Components page →</Link>
            </p>
          </div>
        )}

      </div>
    </PageShell>
  );
}
