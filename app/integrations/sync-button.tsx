"use client";

import { useActionState } from "react";
import {
  syncCatalogFormAction,
  type SyncCatalogActionResult,
} from "@/actions/shopifyActions";

export function SyncButton({ disabled }: { disabled?: boolean }) {
  const [result, action, pending] = useActionState<
    SyncCatalogActionResult | null,
    FormData
  >(syncCatalogFormAction, null);

  return (
    <div className="space-y-3">
      <form action={action}>
        <button
          type="submit"
          disabled={disabled || pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
        >
          {pending ? "Syncing…" : "Sync Shopify products"}
        </button>
      </form>

      {result?.ok === false && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-800">Sync failed</p>
          <p className="mt-1 text-xs text-red-700 font-mono break-all">{result.error}</p>
          <p className="mt-2 text-xs text-red-600">
            If this mentions a scope or access error, go to your Shopify custom app and ensure{" "}
            <strong>read_products</strong> and <strong>read_inventory</strong> scopes are enabled, then reinstall the app.
          </p>
        </div>
      )}

      {result?.ok === true && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 space-y-3">
          <div>
            <p className="text-sm font-semibold text-emerald-800">Sync complete</p>
            <p className="mt-1 text-xs text-emerald-700">
              <strong>Products:</strong>{" "}
              {result.skusCreated > 0 ? `${result.skusCreated} new` : ""}
              {result.skusCreated > 0 && result.skusUpdated > 0 ? ", " : ""}
              {result.skusUpdated > 0 ? `${result.skusUpdated} updated` : ""}
              {result.skusCreated === 0 && result.skusUpdated === 0 ? "no changes" : ""}
            </p>
            <p className="mt-0.5 text-xs text-emerald-700">
              <strong>Orders (last 30 days, paid):</strong>{" "}
              {result.ordersImported} imported
              {result.ordersSkipped > 0 ? `, ${result.ordersSkipped} already recorded` : ""}
              {result.lineItemsImported > 0 ? ` · ${result.lineItemsImported} line item${result.lineItemsImported !== 1 ? "s" : ""}` : ""}
            </p>
            {result.orderErrors.length > 0 && (
              <p className="mt-1 text-xs text-amber-700">
                {result.orderErrors.length} order{result.orderErrors.length !== 1 ? "s" : ""} failed to import — check logs
              </p>
            )}
          </div>

          {result.sampleVariants.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-emerald-800 mb-1">
                Inventory from Shopify API (first {result.sampleVariants.length} variants):
              </p>
              <div className="overflow-x-auto rounded border border-emerald-200 bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-emerald-100 text-emerald-800">
                    <tr>
                      <th className="px-2 py-1 text-left font-medium">Product</th>
                      <th className="px-2 py-1 text-left font-medium">Variant</th>
                      <th className="px-2 py-1 text-left font-medium">SKU</th>
                      <th className="px-2 py-1 text-right font-medium">Shopify Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-100">
                    {result.sampleVariants.map((v) => (
                      <tr key={v.shopifyVariantGid}>
                        <td className="px-2 py-1 text-zinc-700">{v.productTitle}</td>
                        <td className="px-2 py-1 text-zinc-700">{v.variantTitle}</td>
                        <td className="px-2 py-1 font-mono text-zinc-500">{v.sku ?? "—"}</td>
                        <td className={`px-2 py-1 text-right font-mono font-semibold ${v.shopifyInventoryQty === null ? "text-amber-600" : v.shopifyInventoryQty > 0 ? "text-emerald-700" : "text-red-600"}`}>
                          {v.shopifyInventoryQty === null ? "null" : v.shopifyInventoryQty}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-xs text-emerald-600">
                null = Shopify returned no inventory data for this variant (check read_inventory scope)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
