"use client";

import { useTransition } from "react";
import { setSkuCategory } from "@/actions/skuActions";
import type { ProductCategory } from "@/lib/skuCategories";

export function CategorySelect({
  skuId,
  currentCategoryId,
  categories,
}: {
  skuId: string;
  currentCategoryId: string | null;
  categories: ProductCategory[];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={currentCategoryId ?? ""}
      disabled={isPending}
      onChange={(e) => {
        const val = e.target.value || null;
        startTransition(() => setSkuCategory(skuId, val));
      }}
      className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-40 max-w-[140px]"
    >
      <option value="">— Uncategorised —</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
