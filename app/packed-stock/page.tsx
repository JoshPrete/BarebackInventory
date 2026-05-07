import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageShell } from "@/app/_components/page-shell";

export const dynamic = "force-dynamic";


export default async function PackedStockPage() {
  const [skus, packedSums, shopifyRows] = await Promise.all([
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
  ]);

  const onHandBySku = new Map(
    packedSums.map((s) => [s.sellableSkuId, s._sum.qtyChange ?? 0]),
  );

  const shopifyQtyBySku = new Map(
    shopifyRows.map((r) => [r.sellableSkuId, r.inventoryQuantity]),
  );

  const rows = skus.map((s) => ({
    id: s.id,
    name: s.name,
    sku: s.sku,
    packedOnHand: onHandBySku.get(s.id) ?? 0,
    shopifyQty: shopifyQtyBySku.has(s.id) ? shopifyQtyBySku.get(s.id)! : null,
  }));

  // Split: in stock on Shopify vs out of stock / unmapped
  const inStock = rows
    .filter((r) => r.shopifyQty !== null && r.shopifyQty > 0)
    .sort((a, b) => (b.shopifyQty ?? 0) - (a.shopifyQty ?? 0));
  const outOfStock = rows
    .filter((r) => r.shopifyQty === null || r.shopifyQty === 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <PageShell
      active="/packed-stock"
      title="Ready to sell"
      description={`${inStock.length} product${inStock.length !== 1 ? "s" : ""} in stock on Shopify · sorted highest to lowest`}
    >
      <div className="space-y-6">

        {skus.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-white px-8 py-12 text-center">
            <p className="text-sm text-zinc-500">No products synced yet.</p>
          </div>
        )}

        {/* ── IN STOCK ───────────────────────────────────────────────────── */}
        {inStock.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
              In stock on Shopify
            </h2>
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
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
          </section>
        )}

        {/* ── OUT OF STOCK ───────────────────────────────────────────────── */}
        {outOfStock.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Out of stock / not synced
            </h2>
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
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
          </section>
        )}

        <p className="text-xs text-zinc-400 border-t border-zinc-100 pt-4">
          Shopify stock = live inventory quantity at last sync.
          Internal ledger = sum of packing runs minus sales recorded in this app.
          <Link href="/integrations" className="ml-1 hover:text-zinc-600 hover:underline">Sync now →</Link>
        </p>

      </div>
    </PageShell>
  );
}
