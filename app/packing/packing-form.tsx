"use client";

import { useActionState } from "react";
import { submitPackingRun, type PackingState } from "@/app/packing/actions";

const initialState: PackingState = {};

export type SkuOption = { id: string; name: string; sku: string };

export function PackingForm({ skus }: { skus: SkuOption[] }) {
  const [state, formAction, pending] = useActionState(
    submitPackingRun,
    initialState,
  );

  if (skus.length === 0) {
    return <p className="text-sm text-zinc-500">Add sellable SKUs first.</p>;
  }

  return (
    <form action={formAction} className="grid max-w-xl gap-4">
      <div>
        <label
          htmlFor="sellableSkuId"
          className="mb-1 block text-sm font-medium text-zinc-700"
        >
          Sellable SKU
        </label>
        <select
          id="sellableSkuId"
          name="sellableSkuId"
          required
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          <option value="">Select…</option>
          {skus.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.sku})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          htmlFor="quantity"
          className="mb-1 block text-sm font-medium text-zinc-700"
        >
          Quantity packed
        </label>
        <input
          id="quantity"
          name="quantity"
          type="number"
          step="any"
          min="0"
          required
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>
      <div>
        <label htmlFor="note" className="mb-1 block text-sm font-medium text-zinc-700">
          Note (optional)
        </label>
        <input
          id="note"
          name="note"
          type="text"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>
      <p className="text-sm text-zinc-600">
        Consumes components per SKU mappings and increases{" "}
        <strong>packed stock</strong> for this SKU.
      </p>
      <div className="flex flex-col gap-2">
        {state.error ? (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="text-sm text-green-700" role="status">
            {state.success}
          </p>
        ) : null}
        {state.shopifyWarning ? (
          <p className="text-sm text-amber-700 rounded border border-amber-300 bg-amber-50 px-3 py-2" role="alert">
            <strong>Shopify not updated:</strong> {state.shopifyWarning} Update Shopify inventory manually for this run.
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Record packing"}
        </button>
      </div>
    </form>
  );
}
