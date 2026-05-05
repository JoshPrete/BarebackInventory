"use client";

import { useActionState } from "react";
import {
  syncCatalogFormAction,
  type SyncCatalogActionResult,
} from "@/actions/shopifyActions";

export function SkuSyncButton({ label = "Sync Shopify products", variant = "primary" }: {
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const [result, action, pending] = useActionState<
    SyncCatalogActionResult | null,
    FormData
  >(syncCatalogFormAction, null);

  return (
    <div className="space-y-2">
      <form action={action}>
        <button
          type="submit"
          disabled={pending}
          className={
            variant === "primary"
              ? "rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
              : "rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          }
        >
          {pending ? "Syncing…" : label}
        </button>
      </form>

      {result?.ok === false && (
        <p className="text-xs text-red-600">Sync failed: {result.error}</p>
      )}
      {result?.ok === true && (
        <p className="text-xs text-emerald-700">
          Done — {result.skusCreated} new, {result.skusUpdated} updated
        </p>
      )}
    </div>
  );
}
