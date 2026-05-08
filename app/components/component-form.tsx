"use client";

import { useActionState } from "react";
import { createComponent, type CreateComponentState } from "@/app/components/actions";

// Suggested types shown as datalist options — user can type anything else
const TYPE_SUGGESTIONS = [
  "Meat / Bulk",
  "Packaging",
  "Spice / Seasoning",
  "Labels",
  "Cartons",
  "Stickers",
  "Other",
];

const initialState: CreateComponentState = {};

export function ComponentForm() {
  const [state, formAction, pending] = useActionState(createComponent, initialState);

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
          placeholder="e.g. Beef silverside, 35g bags, Original spice"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>

      <div>
        <label htmlFor="type" className="mb-1 block text-sm font-medium text-zinc-700">
          Type
        </label>
        <input
          id="type"
          name="type"
          type="text"
          required
          list="type-suggestions"
          placeholder="e.g. Meat / Bulk, Packaging…"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <datalist id="type-suggestions">
          {TYPE_SUGGESTIONS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>

      <div>
        <label htmlFor="unit" className="mb-1 block text-sm font-medium text-zinc-700">
          Unit
        </label>
        <input
          id="unit"
          name="unit"
          type="text"
          required
          list="unit-suggestions"
          placeholder="e.g. kg, g, each, box"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <datalist id="unit-suggestions">
          {["kg", "g", "each", "box", "roll", "L", "ml"].map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      </div>

      <div>
        <label htmlFor="reorderPoint" className="mb-1 block text-sm font-medium text-zinc-700">
          Reorder point
        </label>
        <input
          id="reorderPoint"
          name="reorderPoint"
          type="number"
          step="any"
          required
          placeholder="Alert when stock drops below this"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>

      <div>
        <label htmlFor="reorderQty" className="mb-1 block text-sm font-medium text-zinc-700">
          Order quantity (MOQ)
        </label>
        <input
          id="reorderQty"
          name="reorderQty"
          type="number"
          step="any"
          required
          placeholder="Minimum you order at a time"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>

      <div className="flex flex-col gap-2 sm:col-span-2">
        {state.error && (
          <p className="text-sm text-red-600" role="alert">{state.error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-fit items-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Add component"}
        </button>
      </div>
    </form>
  );
}
