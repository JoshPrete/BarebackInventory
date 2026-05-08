"use client";

import { useTransition } from "react";
import { setSkuClassification } from "@/actions/skuActions";

export const CLASSIFICATION_OPTIONS = [
  { value: "FINISHED_PRODUCT", label: "Finished product" },
  { value: "BUNDLE", label: "Bundle / multipack" },
  { value: "RAW_COMPONENT_SOLD", label: "Component sold direct" },
  { value: "PACKAGING_ITEM", label: "Packaging / non-production" },
  { value: "IGNORED", label: "Ignore" },
] as const;

export function ClassificationSelect({
  skuId,
  currentClassification,
}: {
  skuId: string;
  currentClassification: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={currentClassification ?? ""}
      disabled={isPending}
      onChange={(e) => {
        const val = e.target.value || null;
        startTransition(() => setSkuClassification(skuId, val));
      }}
      className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-40 max-w-[180px]"
    >
      <option value="">— Unclassified —</option>
      {CLASSIFICATION_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
