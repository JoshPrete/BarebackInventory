import { PageShell, PlaceholderCard } from "@/app/_components/page-shell";

export default function ShopifySyncPage() {
  return (
    <PageShell
      active="/shopify-sync"
      title="Shopify Sync"
      description="Sync the product catalog and orders from Shopify into internal tables."
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Adapter
          </h2>
          <p className="mt-2 text-sm text-zinc-700">
            Currently using <strong>mockShopifyAdapter</strong>. Set{" "}
            <code className="rounded bg-zinc-100 px-1 font-mono text-xs">
              SHOPIFY_ADMIN_ACCESS_TOKEN
            </code>{" "}
            and{" "}
            <code className="rounded bg-zinc-100 px-1 font-mono text-xs">
              SHOPIFY_SHOP_DOMAIN
            </code>{" "}
            to enable the live adapter.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <PlaceholderCard label="Sync catalog — trigger syncShopifyCatalog()" />
          <PlaceholderCard label="Sync orders — trigger syncShopifyOrders()" />
        </div>
        <PlaceholderCard label="Synced products table" />
        <PlaceholderCard label="Synced variants table" />
      </div>
    </PageShell>
  );
}
