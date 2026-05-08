"use client";

import { useActionState } from "react";
import { createSkuComponentRule, type CreateMappingState } from "@/app/mappings/actions";

const initialState: CreateMappingState = {};

export type ComponentOption = {
  id: string;
  name: string;
  unit: string;
  type: string;
  fromShopify: boolean;
};

// Groups components by type for the <optgroup> picker.
function groupByType(components: ComponentOption[]) {
  const groups = new Map<string, ComponentOption[]>();
  for (const c of components) {
    const key = c.type || "Other";
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }
  // Order: Packaging, Ingredient, then everything else alphabetically
  const order = ["Packaging", "Ingredient"];
  return [...groups.entries()].sort(([a], [b]) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });
}

export function MappingForm({
  skuId,
  components,
}: {
  skuId: string | null;
  components: ComponentOption[];
}) {
  const [state, formAction, pending] = useActionState(createSkuComponentRule, initialState);

  if (!skuId) {
    return (
      <p className="text-sm text-zinc-500">
        Select a product above to add ingredients to its recipe.
      </p>
    );
  }

  const grouped = groupByType(components);

  return (
    <form action={formAction} className="grid max-w-xl gap-4">
      <input type="hidden" name="skuId" value={skuId} />
      <div>
        <label htmlFor="componentId" className="mb-1 block text-sm font-medium text-zinc-700">
          Ingredient
        </label>
        <select
          id="componentId"
          name="componentId"
          required
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          <option value="">Select ingredient…</option>
          {grouped.map(([groupName, items]) => (
            <optgroup key={groupName} label={groupName}>
              {items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.unit}){c.fromShopify ? " ↳ Shopify" : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="qtyPerUnit" className="mb-1 block text-sm font-medium text-zinc-700">
          Qty used per unit sold
        </label>
        <input
          id="qtyPerUnit"
          name="qtyPerUnit"
          type="number"
          step="any"
          required
          placeholder="e.g. 350 (grams of meat per bag)"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>
      <div className="flex flex-col gap-2">
        {state.error && (
          <p className="text-sm text-red-600" role="alert">{state.error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-fit items-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Add to recipe"}
        </button>
      </div>
    </form>
  );
}
