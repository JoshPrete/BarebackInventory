import { prisma } from "@/lib/prisma";
import { AppNav } from "@/app/_components/app-nav";
import { BrandMark } from "@/app/_components/brand-mark";
import { getShopifyConfig } from "@/lib/shopify/config";
import { fetchShopifyShopName } from "@/lib/shopify/admin";

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

  const mappingCount = await prisma.shopifyVariantMapping.count();

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
              Connect external systems to this inventory app. Shopify is supported first.
            </p>
          </div>
          <AppNav active="/integrations" />
        </header>

        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-medium text-zinc-900">Shopify</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Use a{" "}
            <strong className="font-medium text-zinc-800">Custom app</strong> in your Shopify
            admin (or a dev store) and add the variables below to{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">.env</code>.
            Required Admin API scopes for future inventory and order sync typically include{" "}
            <code className="rounded bg-zinc-100 px-1 font-mono text-xs">
              read_products
            </code>
            ,{" "}
            <code className="rounded bg-zinc-100 px-1 font-mono text-xs">
              read_inventory
            </code>
            ,{" "}
            <code className="rounded bg-zinc-100 px-1 font-mono text-xs">
              write_inventory
            </code>
            , and for orders{" "}
            <code className="rounded bg-zinc-100 px-1 font-mono text-xs">read_orders</code> /{" "}
            <code className="rounded bg-zinc-100 px-1 font-mono text-xs">write_orders</code>{" "}
            depending on your workflow.
          </p>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-medium text-zinc-700">Connection</dt>
              <dd className="text-zinc-600">
                {cfg ? (
                  <>
                    <span className="text-emerald-800">Environment configured</span>
                    <span className="text-zinc-500"> · {cfg.shopDomain}</span>
                  </>
                ) : (
                  <span className="text-amber-800">Not configured</span>
                )}
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-medium text-zinc-700">Admin API</dt>
              <dd className="text-zinc-600">
                {cfg ? (
                  apiOk ? (
                    <span className="text-emerald-800">Reachable — {shopName}</span>
                  ) : (
                    <span className="text-red-700">
                      Token failed (check scopes and SHOPIFY_ADMIN_ACCESS_TOKEN)
                    </span>
                  )
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-medium text-zinc-700">SKU ↔ variant links</dt>
              <dd className="text-zinc-600">
                {mappingCount} row{mappingCount === 1 ? "" : "s"} in{" "}
                <code className="rounded bg-zinc-100 px-1 font-mono text-xs">
                  ShopifyVariantMapping
                </code>
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-sm text-zinc-600">
            <strong className="font-medium text-zinc-800">Next steps (implementation):</strong>{" "}
            map each internal sellable SKU to a Shopify variant GID, push/pull inventory levels, and
            optionally consume Shopify orders into the same{" "}
            <code className="rounded bg-zinc-100 px-1 font-mono text-xs">recordManualSale</code>{" "}
            path with <code className="rounded bg-zinc-100 px-1 font-mono text-xs">sourceType</code>{" "}
            <code className="rounded bg-zinc-100 px-1 font-mono text-xs">shopify_order</code>. Health
            check:{" "}
            <code className="rounded bg-zinc-100 px-1 font-mono text-xs">
              GET /api/integrations/shopify/health
            </code>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
