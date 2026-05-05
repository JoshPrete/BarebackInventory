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
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-800">Sync complete</p>
          <p className="mt-1 text-xs text-emerald-700">
            {result.variantsUpserted} variant{result.variantsUpserted !== 1 ? "s" : ""} synced
            {" · "}
            {result.skusCreated} new product{result.skusCreated !== 1 ? "s" : ""} created
            {result.skusUpdated > 0 && ` · ${result.skusUpdated} updated`}
          </p>
        </div>
      )}
    </div>
  );
}
