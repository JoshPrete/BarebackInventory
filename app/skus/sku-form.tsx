"use client";

import { useActionState } from "react";
import { createSellableSKU, type CreateSkuState } from "@/app/skus/actions";

const initialState: CreateSkuState = {};

export function SkuForm() {
  const [state, formAction, pending] = useActionState(
    createSellableSKU,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-zinc-700">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="sku" className="mb-1 block text-sm font-medium text-zinc-700">
          SKU
        </label>
        <input
          id="sku"
          name="sku"
          type="text"
          required
          className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>
      <div className="flex items-center gap-2 sm:col-span-2">
        <input
          id="isBundle"
          name="isBundle"
          type="checkbox"
          value="true"
          className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
        />
        <label htmlFor="isBundle" className="text-sm font-medium text-zinc-700">
          Bundle SKU
        </label>
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        {state.error ? (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-fit items-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Create SKU"}
        </button>
      </div>
    </form>
  );
}
