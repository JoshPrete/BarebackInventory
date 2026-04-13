"use client";

import { useActionState } from "react";
import {
  createSkuComponentRule,
  type CreateMappingState,
} from "@/app/mappings/actions";

const initialState: CreateMappingState = {};

export type ComponentOption = { id: string; name: string; unit: string };

export function MappingForm({
  skuId,
  components,
}: {
  skuId: string | null;
  components: ComponentOption[];
}) {
  const [state, formAction, pending] = useActionState(
    createSkuComponentRule,
    initialState,
  );

  if (!skuId) {
    return (
      <p className="text-sm text-zinc-500">
        Choose a SKU above to add component mappings.
      </p>
    );
  }

  return (
    <form action={formAction} className="grid max-w-xl gap-4">
      <input type="hidden" name="skuId" value={skuId} />
      <div>
        <label htmlFor="componentId" className="mb-1 block text-sm font-medium text-zinc-700">
          Component
        </label>
        <select
          id="componentId"
          name="componentId"
          required
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          <option value="">Select component…</option>
          {components.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.unit})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="qtyPerUnit" className="mb-1 block text-sm font-medium text-zinc-700">
          Qty per unit sold
        </label>
        <input
          id="qtyPerUnit"
          name="qtyPerUnit"
          type="number"
          step="any"
          required
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>
      <div className="flex flex-col gap-2">
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
          {pending ? "Saving…" : "Add mapping"}
        </button>
      </div>
    </form>
  );
}
