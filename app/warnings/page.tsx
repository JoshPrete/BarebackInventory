import { AppNav } from "@/app/_components/app-nav";
import { getWarnings } from "@/services/warningsService";
import type { SkuWarning, ComponentWarning } from "@/services/warningsService";

export const dynamic = "force-dynamic";

// ─── Badge helpers ─────────────────────────────────────────────────────────────

function criticalBadge() {
  return (
    <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
      Critical
    </span>
  );
}

function warningBadge() {
  return (
    <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
      Warning
    </span>
  );
}

// ─── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  badge,
  children,
  empty,
}: {
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
  empty?: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        {badge}
      </div>
      <p className="text-sm text-zinc-500">{subtitle}</p>
      {children ?? (
        <p className="rounded-lg border border-dashed border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-400">
          {empty ?? "No issues"}
        </p>
      )}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function WarningsPage() {
  const { noPackedStock, lowPackedStock, missingBom, belowReorderPoint, nearNegative } =
    await getWarnings();

  const totalWarnings =
    noPackedStock.length +
    lowPackedStock.length +
    missingBom.length +
    belowReorderPoint.length +
    nearNegative.length;

  return (
    <div className="min-h-full bg-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Warnings</h1>
            <p className="mt-1 text-sm text-zinc-600">
              {totalWarnings === 0
                ? "All inventory looks healthy."
                : `${totalWarnings} issue${totalWarnings !== 1 ? "s" : ""} detected across SKUs and components.`}
            </p>
          </div>
          <AppNav active="/warnings" />
        </header>

        <div className="space-y-10">
          {/* ── No packed stock ─────────────────────────────────────────────── */}
          <Section
            title="No packed stock"
            subtitle="Sellable SKUs with zero or negative on-hand packed units — cannot fulfil any orders."
            badge={noPackedStock.length > 0 ? criticalBadge() : undefined}
            empty="All SKUs have packed stock."
          >
            {noPackedStock.length > 0 && (
              <SkuTable rows={noPackedStock} highlight="red" />
            )}
          </Section>

          {/* ── Low packed stock ────────────────────────────────────────────── */}
          <Section
            title="Low packed stock"
            subtitle="Sellable SKUs with packed on-hand above zero but below the low-stock threshold (5 units)."
            badge={lowPackedStock.length > 0 ? warningBadge() : undefined}
            empty="No SKUs are running low."
          >
            {lowPackedStock.length > 0 && (
              <SkuTable rows={lowPackedStock} highlight="amber" />
            )}
          </Section>

          {/* ── Missing BOM ─────────────────────────────────────────────────── */}
          <Section
            title="Missing bill of materials"
            subtitle="Sellable SKUs with no component rules — component stock will not be deducted when these are sold."
            badge={missingBom.length > 0 ? warningBadge() : undefined}
            empty="All SKUs have at least one BOM rule."
          >
            {missingBom.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-600">
                    <tr>
                      <th className="px-4 py-3">SKU code</th>
                      <th className="px-4 py-3">Name</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {missingBom.map((s) => (
                      <tr key={s.sellableSkuId} className="hover:bg-zinc-50/80">
                        <td className="px-4 py-3 font-mono text-xs text-zinc-700">{s.skuCode}</td>
                        <td className="px-4 py-3 text-zinc-900">{s.skuName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* ── Below reorder point ─────────────────────────────────────────── */}
          <Section
            title="Components below reorder point"
            subtitle="Component on-hand is below the configured reorder point — time to reorder."
            badge={belowReorderPoint.length > 0 ? warningBadge() : undefined}
            empty="All components are above their reorder point."
          >
            {belowReorderPoint.length > 0 && (
              <ComponentTable rows={belowReorderPoint} highlight="amber" />
            )}
          </Section>

          {/* ── Near-negative / out ─────────────────────────────────────────── */}
          <Section
            title="Near-negative component stock"
            subtitle="Component on-hand is at or below zero — immediate risk of over-deduction."
            badge={nearNegative.length > 0 ? criticalBadge() : undefined}
            empty="No components are at or below zero."
          >
            {nearNegative.length > 0 && (
              <ComponentTable rows={nearNegative} highlight="red" />
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-tables ────────────────────────────────────────────────────────────────

function SkuTable({
  rows,
  highlight,
}: {
  rows: SkuWarning[];
  highlight: "red" | "amber";
}) {
  const qtyClass =
    highlight === "red"
      ? "text-red-700 font-semibold"
      : "text-amber-800 font-semibold";

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-600">
          <tr>
            <th className="px-4 py-3">SKU code</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3 text-right">On hand</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((r) => (
            <tr key={r.sellableSkuId} className="hover:bg-zinc-50/80">
              <td className="px-4 py-3 font-mono text-xs text-zinc-700">{r.skuCode}</td>
              <td className="px-4 py-3 text-zinc-900">{r.skuName}</td>
              <td className={`px-4 py-3 text-right tabular-nums ${qtyClass}`}>{r.onHand}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComponentTable({
  rows,
  highlight,
}: {
  rows: ComponentWarning[];
  highlight: "red" | "amber";
}) {
  const qtyClass =
    highlight === "red"
      ? "text-red-700 font-semibold"
      : "text-amber-800 font-semibold";

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-600">
          <tr>
            <th className="px-4 py-3">Component</th>
            <th className="px-4 py-3">Unit</th>
            <th className="px-4 py-3 text-right">On hand</th>
            <th className="px-4 py-3 text-right">Reorder point</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((r) => (
            <tr key={r.componentId} className="hover:bg-zinc-50/80">
              <td className="px-4 py-3 text-zinc-900">{r.name}</td>
              <td className="px-4 py-3 text-zinc-600">{r.unit}</td>
              <td className={`px-4 py-3 text-right tabular-nums ${qtyClass}`}>{r.onHand}</td>
              <td className="px-4 py-3 text-right tabular-nums text-zinc-700">{r.reorderPoint}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
