"use client";

import Link from "next/link";
import { useActionState } from "react";
import { recordSale, type RecordSaleState } from "@/app/sales/actions";

const initialState: RecordSaleState = {};

export type SkuPick = { id: string; name: string; sku: string };

export function SaleForm({ skus }: { skus: SkuPick[] }) {
  const [state, formAction, pending] = useActionState(recordSale, initialState);

  if (skus.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Add at least one sellable SKU before recording sales.
      </p>
    );
  }

  return (
    <form action={formAction} className="grid max-w-xl gap-4">
      <div>
        <label htmlFor="sellableSkuId" className="mb-1 block text-sm font-medium text-zinc-700">
          Sellable SKU
        </label>
        <select
          id="sellableSkuId"
          name="sellableSkuId"
          required
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          <option value="">Select SKU…</option>
          {skus.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.sku})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="quantity" className="mb-1 block text-sm font-medium text-zinc-700">
          Quantity sold
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
        <label htmlFor="orderRef" className="mb-1 block text-sm font-medium text-zinc-700">
          Order reference (optional)
        </label>
        <input
          id="orderRef"
          name="orderRef"
          type="text"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>
      <p className="text-sm text-zinc-600">
        Requires sufficient packed on hand — see{" "}
        <Link href="/packed-stock" className="font-medium text-zinc-800 underline">
          Packed stock
        </Link>
        .
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
        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-fit items-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "Recording…" : "Record sale"}
        </button>
      </div>
    </form>
  );
}
