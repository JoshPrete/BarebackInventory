import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageShell } from "@/app/_components/page-shell";

export const dynamic = "force-dynamic";


export default async function PackedStockPage() {
  const [skus, packedSums, shopifyRows, categoryRows] = await Promise.all([
    prisma.sellableSKU.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true },
    }),
    prisma.packedStockMovement.groupBy({
      by: ["sellableSkuId"],
      _sum: { qtyChange: true },
    }),
    // Shopify live stock — raw SQL bypasses stale generated client
    prisma.$queryRaw<{ sellableSkuId: string; inventoryQuantity: number | null }[]>`
      SELECT m."sellableSkuId", v."inventoryQuantity"
      FROM "ShopifyVariantMapping" m
      JOIN "ShopifyVariant" v ON v."shopifyVariantGid" = m."shopifyVariantGid"
    `,
    // Category per SKU — raw SQL for same reason
    prisma.$queryRaw<{ id: string; categoryName: string | null }[]>`
      SELECT s."id", c."name" AS "categoryName"
      FROM "SellableSKU" s
      LEFT JOIN "ProductCategory" c ON c."id" = s."categoryId"
    `,
  ]);

  const onHandBySku = new Map(
    packedSums.map((s) => [s.sellableSkuId, s._sum.qtyChange ?? 0]),
  );

  const shopifyQtyBySku = new Map(
    shopifyRows.map((r) => [r.sellableSkuId, r.inventoryQuantity]),
  );

  const categoryBySku = new Map(
    categoryRows.map((r) => [r.id, r.categoryName]),
  );

  const rows = skus.map((s) => ({
    id: s.id,
    name: s.name,
    sku: s.sku,
    packedOnHand: onHandBySku.get(s.id) ?? 0,
    shopifyQty: shopifyQtyBySku.has(s.id) ? shopifyQtyBySku.get(s.id)! : null,
    categoryName: categoryBySku.get(s.id) ?? null,
  }));

  const inStockCount = rows.filter((r) => r.shopifyQty !== null && r.shopifyQty > 0).length;

  // Group by category, alphabetical order, "Uncategorised" last.
  const byCategory = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.categoryName ?? "Uncategorised";
    const group = byCategory.get(key) ?? [];
    group.push(r);
    byCategory.set(key, group);
  }
  // Within each category: in-stock sorted desc, then 0, then unmapped (null).
  for (const group of byCategory.values()) {
    group.sort((a, b) => {
      const aQ = a.shopifyQty;
      const bQ = b.shopifyQty;
      if (aQ === null && bQ === null) return a.name.localeCompare(b.name);
      if (aQ === null) return 1;
      if (bQ === null) return -1;
      if (bQ !== aQ) return bQ - aQ;
      return a.name.localeCompare(b.name);
    });
  }
  const categoryGroups = [...byCategory.entries()].sort(([a], [b]) => {
    if (a === "Uncategorised") return 1;
    if (b === "Uncategorised") return -1;
    return a.localeCompare(b);
  });

  const hasMultipleCategories = categoryGroups.length > 1;

  return (
    <PageShell
      active="/packed-stock"
      title="Ready to sell"
      description={`${inStockCount} product${inStockCount !== 1 ? "s" : ""} in stock on Shopify · sorted highest to lowest`}
    >
      <div className="space-y-6">

        {skus.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-white px-8 py-12 text-center">
            <p className="text-sm text-zinc-500">No products synced yet.</p>
          </div>
        )}

        {skus.length > 0 && categoryGroups.map(([catName, group]) => {
          const inStock = group.filter((r) => r.shopifyQty !== null && r.shopifyQty > 0);
          const outOfStock = group.filter((r) => r.shopifyQty === null || r.shopifyQty === 0);

          return (
            <section key={catName}>
              {hasMultipleCategories && (
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
                  {catName}
                </h2>
              )}

              {/* In stock */}
              {inStock.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm mb-3">
                  {!hasMultipleCategories && (
                    <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-2">
                      <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                        In stock on Shopify
                      </span>
                    </div>
                  )}
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">SKU</th>
                        <th className="px-4 py-3 text-right">Shopify stock</th>
                        <th className="px-4 py-3 text-right">Internal ledger</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {inStock.map((r) => (
                        <tr key={r.id} className="hover:bg-zinc-50/60">
                          <td className="px-4 py-3 font-medium text-zinc-900">{r.name}</td>
                          <td className="px-4 py-3 font-mono text-xs text-zinc-500">{r.sku}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-700">
                            {r.shopifyQty}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-zinc-500">
                            {r.packedOnHand}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Out of stock */}
              {outOfStock.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
                  {!hasMultipleCategories && (
                    <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-2">
                      <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                        Out of stock / not synced
                      </span>
                    </div>
                  )}
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">SKU</th>
                        <th className="px-4 py-3 text-right">Shopify stock</th>
                        <th className="px-4 py-3 text-right">Internal ledger</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {outOfStock.map((r) => (
                        <tr key={r.id} className="hover:bg-zinc-50/60">
                          <td className="px-4 py-3 font-medium text-zinc-500">{r.name}</td>
                          <td className="px-4 py-3 font-mono text-xs text-zinc-400">{r.sku}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-zinc-400">
                            {r.shopifyQty === null ? "—" : r.shopifyQty}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-zinc-400">
                            {r.packedOnHand}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}

        <p className="text-xs text-zinc-400 border-t border-zinc-100 pt-4">
          Shopify stock = live inventory quantity at last sync.
          Internal ledger = sum of packing runs minus sales recorded in this app.
          <Link href="/integrations" className="ml-1 hover:text-zinc-600 hover:underline">Sync now →</Link>
        </p>

      </div>
    </PageShell>
  );
}
