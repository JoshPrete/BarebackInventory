import { prisma } from "@/lib/prisma";
import { AppNav } from "@/app/_components/app-nav";
import { BrandMark } from "@/app/_components/brand-mark";
import { getShopifyConfig } from "@/lib/shopify/config";
import { fetchShopifyShopName } from "@/lib/shopify/admin";
import { SyncButton } from "@/app/integrations/sync-button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const cfg = getShopifyConfig();
  let shopName: string | null = null;
  let apiOk = false;
  if (cfg) {
    try {
      shopName = await fetchShopifyShopName();
      apiOk = shopName != null;
    } catch {
      apiOk = false;
    }
  }

  const [mappingCount, skuCount, unmappedCount, dbVariants] = await Promise.all([
    prisma.shopifyVariantMapping.count(),
    prisma.sellableSKU.count(),
    prisma.sellableSKU.count({
      where: { skuComponentRules: { none: {} } },
    }),
    // Raw SQL: read inventoryQuantity directly — bypasses stale generated client.
    prisma.$queryRaw<
      { productTitle: string; variantTitle: string; sku: string | null; inventoryQuantity: number | null; hasMappingRow: boolean }[]
    >`
      SELECT
        p."title" AS "productTitle",
        v."title" AS "variantTitle",
        v."sku",
        v."inventoryQuantity",
        (m."id" IS NOT NULL) AS "hasMappingRow"
      FROM "ShopifyVariant" v
      JOIN "ShopifyProduct" p ON p."shopifyProductGid" = v."shopifyProductGid"
      LEFT JOIN "ShopifyVariantMapping" m ON m."shopifyVariantGid" = v."shopifyVariantGid"
      ORDER BY p."title", v."title"
      LIMIT 15
    `,
  ]);

  return (
    <div className="min-h-full bg-zinc-50">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <BrandMark className="mb-1" />
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Integrations
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Shopify is the source of truth for finished products and stock.
            </p>
          </div>
          <AppNav active="/integrations" />
        </header>

        <div className="space-y-5">

          {/* Connection status */}
          <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">Shopify connection</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex flex-wrap gap-x-3">
                <dt className="font-medium text-zinc-700">Store</dt>
                <dd>
                  {cfg ? (
                    <span className="text-zinc-600">{cfg.shopDomain}</span>
                  ) : (
                    <span className="text-amber-700">Not configured — add SHOPIFY_SHOP_DOMAIN to env</span>
                  )}
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-3">
                <dt className="font-medium text-zinc-700">API</dt>
                <dd>
                  {cfg ? (
                    apiOk ? (
                      <span className="text-emerald-700">Connected — {shopName}</span>
                    ) : (
                      <span className="text-red-700">Token failed — check scopes and SHOPIFY_ADMIN_ACCESS_TOKEN</span>
                    )
                  ) : "—"}
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-3">
                <dt className="font-medium text-zinc-700">Products synced</dt>
                <dd className="text-zinc-600">{skuCount}</dd>
              </div>
              <div className="flex flex-wrap gap-x-3">
                <dt className="font-medium text-zinc-700">Linked to Shopify variant</dt>
                <dd className="text-zinc-600">{mappingCount}</dd>
              </div>
              {unmappedCount > 0 && (
                <div className="flex flex-wrap gap-x-3">
                  <dt className="font-medium text-zinc-700">Needs recipe</dt>
                  <dd className="text-amber-700">{unmappedCount} product{unmappedCount !== 1 ? "s" : ""}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Sync action */}
          <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">Sync products from Shopify</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Pulls all active products and variants from your Shopify store. Creates a product record here for each variant. Safe to run multiple times — existing records are updated, not duplicated.
            </p>
            <div className="mt-4 space-y-3">
              <SyncButton disabled={!apiOk} />
              <Link
                href="/shopify-sync"
                className="block text-xs text-zinc-400 hover:text-zinc-600 hover:underline"
              >
                Manage variant mappings →
              </Link>
            </div>
          </section>

          {/* Next steps */}
          {skuCount > 0 && unmappedCount > 0 && (
            <section className="rounded-lg border border-amber-100 bg-amber-50 p-5">
              <p className="text-sm font-semibold text-amber-900">Next step: set ingredient recipes</p>
              <p className="mt-1 text-sm text-amber-700">
                {unmappedCount} product{unmappedCount !== 1 ? "s" : ""} have no recipe yet. Production planning won&apos;t start until each product has its ingredients mapped.
              </p>
              <Link
                href="/skus"
                className="mt-3 inline-block text-sm font-medium text-amber-900 hover:underline"
              >
                Set recipes on Products page →
              </Link>
            </section>
          )}

          {skuCount > 0 && unmappedCount === 0 && (
            <section className="rounded-lg border border-emerald-100 bg-emerald-50 p-5">
              <p className="text-sm font-semibold text-emerald-800">All products have recipes</p>
              <p className="mt-1 text-sm text-emerald-700">
                Production planning is active. The dashboard will show what you can make and what to order.
              </p>
              <Link
                href="/dashboard"
                className="mt-3 inline-block text-sm font-medium text-emerald-900 hover:underline"
              >
                Go to dashboard →
              </Link>
            </section>
          )}

          {/* ── DB diagnostic ─────────────────────────────────────────────── */}
          <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">
              Stock diagnostic — DB state
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              inventoryQuantity stored in ShopifyVariant after last sync. null = never written.
              hasMappingRow = dashboard can read this variant&apos;s stock.
            </p>
            {dbVariants.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-400">No synced variants — run a sync first.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded border border-zinc-200">
                <table className="w-full text-xs">
                  <thead className="bg-zinc-50 text-zinc-600">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Product</th>
                      <th className="px-3 py-2 text-left font-medium">Variant</th>
                      <th className="px-3 py-2 text-left font-medium">SKU</th>
                      <th className="px-3 py-2 text-right font-medium">DB qty</th>
                      <th className="px-3 py-2 text-center font-medium">Mapped</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {dbVariants.map((v, i) => (
                      <tr key={i} className="hover:bg-zinc-50">
                        <td className="px-3 py-1.5 text-zinc-700">{v.productTitle}</td>
                        <td className="px-3 py-1.5 text-zinc-700">{v.variantTitle}</td>
                        <td className="px-3 py-1.5 font-mono text-zinc-500">{v.sku ?? "—"}</td>
                        <td className={`px-3 py-1.5 text-right font-mono font-semibold ${v.inventoryQuantity === null ? "text-amber-600" : v.inventoryQuantity > 0 ? "text-emerald-700" : "text-zinc-400"}`}>
                          {v.inventoryQuantity === null ? "null" : v.inventoryQuantity}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {v.hasMappingRow ? (
                            <span className="text-emerald-600">✓</span>
                          ) : (
                            <span className="text-red-500">✗</span>
                          )}
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
    </div>
  );
}
