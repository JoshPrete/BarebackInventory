"use client";

import { useActionState, useMemo, useState } from "react";
import { recordReceipt, type ReceiptState } from "@/app/receipts/actions";

const initialState: ReceiptState = {};

export type ComponentOption = { id: string; name: string; unit: string };

type LineRow = {
  key: string;
  componentId: string;
  quantity: string;
  unitCost: string;
};

function newLine(): LineRow {
  return {
    key: typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : String(Math.random()),
    componentId: "",
    quantity: "",
    unitCost: "",
  };
}

export function ReceiptForm({ components }: { components: ComponentOption[] }) {
  const [state, formAction, pending] = useActionState(recordReceipt, initialState);
  const [lines, setLines] = useState<LineRow[]>(() => [newLine()]);

  const linesJson = useMemo(() => {
    const payload = lines.map((l) => {
      const quantity = Number(l.quantity);
      const unitCostRaw = l.unitCost.trim();
      return {
        componentId: l.componentId,
        quantity,
        unitCost:
          unitCostRaw === "" || !Number.isFinite(Number(unitCostRaw))
            ? null
            : Number(unitCostRaw),
      };
    });
    return JSON.stringify(payload);
  }, [lines]);

  if (components.length === 0) {
    return <p className="text-sm text-zinc-500">Add components first.</p>;
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex max-w-3xl flex-col gap-6">
      <input type="hidden" name="linesJson" value={linesJson} />

      <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-900">Receipt header</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label
              htmlFor="supplierName"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Supplier name
            </label>
            <input
              id="supplierName"
              name="supplierName"
              type="text"
              required
              autoComplete="organization"
              placeholder="e.g. Acme Foods"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>
          <div>
            <label
              htmlFor="invoiceRef"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Receipt / invoice #
            </label>
            <input
              id="invoiceRef"
              name="invoiceRef"
              type="text"
              placeholder="Optional"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>
          <div>
            <label
              htmlFor="receivedAt"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Received date
            </label>
            <input
              id="receivedAt"
              name="receivedAt"
              type="date"
              required
              defaultValue={today}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label
              htmlFor="receiptNote"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Note (optional)
            </label>
            <textarea
              id="receiptNote"
              name="receiptNote"
              rows={2}
              placeholder="Delivery instructions, batch notes…"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-900">Line items</h3>
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, newLine()])}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
          >
            Add another line
          </button>
        </div>

        <div className="space-y-3">
          {lines.map((line, index) => (
            <div
              key={line.key}
              className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-12 sm:items-end"
            >
              <div className="sm:col-span-5">
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  Component
                </label>
                <select
                  value={line.componentId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLines((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, componentId: v } : row,
                      ),
                    );
                  }}
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
              <div className="sm:col-span-3">
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  Quantity
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={line.quantity}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLines((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, quantity: v } : row,
                      ),
                    );
                  }}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  Unit cost (optional)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={line.unitCost}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLines((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, unitCost: v } : row,
                      ),
                    );
                  }}
                  placeholder="—"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>
              <div className="flex sm:col-span-1 sm:justify-end">
                {lines.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setLines((prev) => prev.filter((_, i) => i !== index))
                    }
                    className="text-sm text-red-700 hover:underline"
                  >
                    Remove
                  </button>
                ) : (
                  <span className="text-xs text-zinc-400 sm:pt-2">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {state.error ? (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        ) : null}
        <p className="text-xs text-zinc-500">
          Saving sends you to <strong>Stock</strong> with totals updated from movements.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save receipt"}
        </button>
      </div>
    </form>
  );
}
