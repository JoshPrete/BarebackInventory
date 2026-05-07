"use client";

import { useState, useTransition } from "react";
import { createCategory, deleteCategory } from "@/actions/skuActions";
import type { ProductCategory } from "@/lib/skuCategories";

export function AddCategoryForm({
  categories,
}: {
  categories: ProductCategory[];
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createCategory(name.trim());
      if ("error" in result) {
        setError(result.error);
      } else {
        setName("");
      }
    });
  }

  function handleDelete(id: string, catName: string) {
    if (!confirm(`Delete category "${catName}"? Products in this category will become uncategorised.`)) return;
    startTransition(() => deleteCategory(id));
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
      <h2 className="text-sm font-semibold text-zinc-800">Manage categories</h2>

      {/* Existing categories */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700"
            >
              {c.name}
              <button
                onClick={() => handleDelete(c.id, c.name)}
                disabled={isPending}
                className="text-zinc-400 hover:text-red-500 disabled:opacity-40 leading-none"
                aria-label={`Delete ${c.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {categories.length === 0 && (
        <p className="text-xs text-zinc-400">No categories yet — add one below.</p>
      )}

      {/* Add new */}
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
          placeholder="e.g. Ready to Sell, Component, Merch…"
          disabled={isPending}
          className="flex-1 rounded border border-zinc-200 px-3 py-1.5 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-40"
        />
        <button
          onClick={handleCreate}
          disabled={isPending || !name.trim()}
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
