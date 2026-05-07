import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageShell } from "@/app/_components/page-shell";
import { SkuSyncButton } from "@/app/skus/sync-button";
import { CategorySelect } from "@/app/skus/category-select";
import { AddCategoryForm } from "@/app/skus/add-category-form";

export const dynamic = "force-dynamic";

export default async function SkusPage() {
  const [skus, categories] = await Promise.all([
    prisma.sellableSKU.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sku: true,
        _count: { select: { skuComponentRules: true } },
        // category relation — may not be in stale local client; use raw fallback below
        categoryId: true,
      },
    }),
    prisma.productCategory.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const needsRecipe = skus.filter((s) => s._count.skuComponentRules === 0).length;
  const ready = skus.length - needsRecipe;

  return (
    <PageShell
      active="/skus"
      title="Products"
      description={
        skus.length === 0
          ? "No products yet — sync from Shopify to get started."
          : `${skus.length} product${skus.length !== 1 ? "s" : ""} · ${ready} with recipes · ${needsRecipe} need${needsRecipe !== 1 ? "" : "s"} recipe`
      }
    >
      <div className="space-y-6">

        {/* Category management */}
        <AddCategoryForm categories={categories} />

        {/* Empty state */}
        {skus.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-white px-8 py-12 text-center">
            <p className="text-sm font-medium text-zinc-700">No products synced yet</p>
            <p className="mt-1 text-sm text-zinc-500">
              Sync your Shopify store to import products and start mapping recipes.
            </p>
            <div className="mt-5 flex flex-col items-center gap-3">
              <SkuSyncButton />
              <Link href="/shopify-sync" className="text-xs text-zinc-400 hover:text-zinc-600 hover:underline">
                Advanced sync options →
              </Link>
            </div>
          </div>
        )}

        {/* Needs-recipe callout */}
        {skus.length > 0 && needsRecipe > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {needsRecipe} product{needsRecipe !== 1 ? "s" : ""} need{needsRecipe === 1 ? "s" : ""} a recipe
              </p>
              <p className="mt-0.5 text-xs text-amber-700">
                Production planning won&apos;t work until each product has its ingredient mapping set.
              </p>
            </div>
          </div>
        )}

        {/* Product table */}
        {skus.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Recipe</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {skus.map((s) => {
                  const hasRecipe = s._count.skuComponentRules > 0;
                  const ruleCount = s._count.skuComponentRules;
                  return (
                    <tr key={s.id} className="hover:bg-zinc-50/60">
                      <td className="px-4 py-3 font-medium text-zinc-900">{s.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-500">{s.sku}</td>
                      <td className="px-4 py-3">
                        <CategorySelect
                          skuId={s.id}
                          currentCategoryId={s.categoryId ?? null}
                          categories={categories}
                        />
                      </td>
                      <td className="px-4 py-3">
                        {hasRecipe ? (
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                            {ruleCount} ingredient{ruleCount !== 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                            Needs recipe
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/mappings?skuId=${s.id}`}
                          className="text-xs font-medium text-zinc-500 hover:text-zinc-900 hover:underline"
                        >
                          {hasRecipe ? "Edit recipe →" : "Set recipe →"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Sync controls */}
        {skus.length > 0 && (
          <div className="flex items-center gap-4">
            <SkuSyncButton label="Re-sync from Shopify" variant="secondary" />
            <Link href="/shopify-sync" className="text-xs text-zinc-400 hover:text-zinc-600 hover:underline">
              Advanced sync →
            </Link>
          </div>
        )}

      </div>
    </PageShell>
  );
}
