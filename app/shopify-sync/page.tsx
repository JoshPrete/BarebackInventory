import { PageShell } from "@/app/_components/page-shell";
import {
  mapVariantFormAction,
} from "@/actions/shopifyActions";
import { SyncButton } from "@/app/integrations/sync-button";
import {
  getVariantMappingQueue,
  type VariantMappingRow,
} from "@/services/shopifyService";
import { listSellableSkus } from "@/services/bomService";
import { isShopifyConfigured } from "@/lib/shopify/config";

export const dynamic = "force-dynamic";

export default async function ShopifySyncPage() {
  const [variants, skus] = await Promise.all([
    getVariantMappingQueue(),
    listSellableSkus(),
  ]);

  const configured = isShopifyConfigured();
  const unmapped = variants.filter((v) => !v.mappedSkuId).length;
  const mapped = variants.length - unmapped;

  return (
    <PageShell
      active="/shopify-sync"
      title="Shopify Sync"
      description={`${variants.length} variant${variants.length !== 1 ? "s" : ""} synced — ${mapped} mapped, ${unmapped} unmapped.`}
    >
      <div className="space-y-6">

        {/* Adapter status + sync button */}
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Adapter
            </p>
            <p className="mt-0.5 text-sm text-zinc-700">
              {configured ? (
                <>
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-green-500" />
                  Live Shopify adapter (credentials detected)
                </>
              ) : (
                <>
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-400" />
                  Mock adapter — set{" "}
                  <code className="rounded bg-zinc-100 px-1 font-mono text-xs">
                    SHOPIFY_ADMIN_ACCESS_TOKEN
                  </code>{" "}
                  +{" "}
                  <code className="rounded bg-zinc-100 px-1 font-mono text-xs">
                    SHOPIFY_SHOP_DOMAIN
                  </code>{" "}
                  to use live data
                </>
              )}
            </p>
          </div>
          <SyncButton />
        </div>

        {/* Variant mapping queue */}
        {variants.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center shadow-sm">
            <p className="text-sm text-zinc-400">
              No variants synced yet. Click &ldquo;Sync catalog&rdquo; to import from Shopify.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Variant</th>
                  <th className="px-4 py-3">Shopify SKU</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Internal SKU</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {variants.map((v) => (
                  <VariantRow key={v.shopifyVariantGid} variant={v} skus={skus} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}

// ─── Row component ────────────────────────────────────────────────────────────

interface SkuOption {
  id: string;
  sku: string;
  name: string;
}

function VariantRow({
  variant: v,
  skus,
}: {
  variant: VariantMappingRow;
  skus: SkuOption[];
}) {
  const isMapped = !!v.mappedSkuId;

  return (
    <tr className="align-middle">
      <td className="px-4 py-3 text-zinc-900">{v.productTitle}</td>
      <td className="px-4 py-3 text-zinc-700">{v.variantTitle}</td>
      <td className="px-4 py-3 font-mono text-xs text-zinc-500">
        {v.sku ?? <span className="text-zinc-400">—</span>}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
        ${v.price}
      </td>
      <td className="px-4 py-3">
        {isMapped ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
            mapped
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            unmapped
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-zinc-700">
        {isMapped ? (
          <span className="font-mono text-xs">
            {v.mappedSkuCode}{" "}
            <span className="font-sans text-zinc-400">{v.mappedSkuName}</span>
          </span>
        ) : (
          <span className="text-zinc-400">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <form action={mapVariantFormAction} className="flex items-center gap-2">
          <input type="hidden" name="shopifyVariantGid" value={v.shopifyVariantGid} />
          <select
            name="sellableSkuId"
            defaultValue={v.mappedSkuId ?? ""}
            className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <option value="" disabled>
              Select SKU…
            </option>
            {skus.map((s) => (
              <option key={s.id} value={s.id}>
                {s.sku} — {s.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded bg-zinc-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-1"
          >
            {isMapped ? "Remap" : "Map"}
          </button>
        </form>
      </td>
    </tr>
  );
}
