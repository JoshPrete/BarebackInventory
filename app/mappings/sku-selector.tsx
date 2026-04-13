"use client";

import { useRouter, useSearchParams } from "next/navigation";

export type SkuOption = { id: string; name: string; sku: string };

export function SkuSelector({ skus }: { skus: SkuOption[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("skuId") ?? "";

  return (
    <div className="max-w-xl">
      <label htmlFor="sku-select" className="mb-1 block text-sm font-medium text-zinc-700">
        Sellable SKU
      </label>
      <select
        id="sku-select"
        value={current}
        onChange={(e) => {
          const v = e.target.value;
          router.push(v ? `/mappings?skuId=${encodeURIComponent(v)}` : "/mappings");
        }}
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
      >
        <option value="">Select a SKU…</option>
        {skus.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.sku})
          </option>
        ))}
      </select>
    </div>
  );
}
