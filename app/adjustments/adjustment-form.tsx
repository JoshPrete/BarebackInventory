"use client";

import { useActionState } from "react";
import { recordAdjustment, type AdjustmentState } from "@/app/adjustments/actions";
import type { ComponentOption } from "@/app/receipts/receipt-form";

const initialState: AdjustmentState = {};

export function AdjustmentForm({ components }: { components: ComponentOption[] }) {
  const [state, formAction, pending] = useActionState(recordAdjustment, initialState);

  if (components.length === 0) {
    return <p className="text-sm text-zinc-500">Add components first.</p>;
  }

  return (
    <form action={formAction} className="grid max-w-xl gap-4">
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
          <option value="">Select…</option>
          {components.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.unit})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="direction" className="mb-1 block text-sm font-medium text-zinc-700">
          Direction
        </label>
        <select
          id="direction"
          name="direction"
          required
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          <option value="increase">Increase stock</option>
          <option value="decrease">Decrease stock</option>
        </select>
      </div>
      <div>
        <label htmlFor="quantity" className="mb-1 block text-sm font-medium text-zinc-700">
          Quantity
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
        <label htmlFor="reason" className="mb-1 block text-sm font-medium text-zinc-700">
          Reason / note <span className="font-normal text-zinc-500">(optional)</span>
        </label>
        <textarea
          id="reason"
          name="reason"
          rows={3}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>
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
          className="inline-flex w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Record adjustment"}
        </button>
      </div>
    </form>
  );
}
