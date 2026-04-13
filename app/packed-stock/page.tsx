import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** When > 0, packed on hand in (0, threshold] counts as LOW (reserved for future SellableSKU field). */
const PACKED_LOW_THRESHOLD = 0;

const nav = (
  <>
    <Link href="/" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Home
    </Link>
    <Link href="/components" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Components
    </Link>
    <Link href="/skus" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      SKUs
    </Link>
    <Link href="/sales" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Sales
    </Link>
    <Link href="/packing" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Packing
    </Link>
    <Link href="/stock" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Stock
    </Link>
    <span className="font-semibold text-zinc-900">Packed stock</span>
    <Link href="/movements" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Movements
    </Link>
  </>
);

function packableUnitsFromRules(
  rules: { componentId: string; qtyPerUnit: number }[],
  stockByComponentId: Map<string, number>,
): number {
  if (rules.length === 0) return 0;
  let minUnits = Infinity;
  for (const r of rules) {
    if (!(r.qtyPerUnit > 0)) continue;
    const stock = stockByComponentId.get(r.componentId) ?? 0;
    const units = Math.floor(stock / r.qtyPerUnit);
    minUnits = Math.min(minUnits, units);
  }
  if (minUnits === Infinity) return 0;
  return minUnits;
}

type ShelfStatus = "OUT" | "LOW" | "READY";

function shelfStatus(args: {
  packedOnHand: number;
  packableFromComponents: number | null;
  hasRules: boolean;
}): ShelfStatus {
  const { packedOnHand, packableFromComponents, hasRules } = args;
  if (packedOnHand <= 0) return "OUT";
  if (PACKED_LOW_THRESHOLD > 0 && packedOnHand <= PACKED_LOW_THRESHOLD) {
    return "LOW";
  }
  if (hasRules && packableFromComponents === 0) {
    return "LOW";
  }
  return "READY";
}

function statusBadge(status: ShelfStatus) {
  const base =
    "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums";
  switch (status) {
    case "OUT":
      return `${base} bg-red-100 text-red-800`;
    case "LOW":
      return `${base} bg-amber-100 text-amber-900`;
    default:
      return `${base} bg-emerald-100 text-emerald-900`;
  }
}

export default async function PackedStockPage() {
  const [skus, packedSums, componentSums] = await Promise.all([
    prisma.sellableSKU.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sku: true,
        skuComponentRules: {
          select: { componentId: true, qtyPerUnit: true },
        },
      },
    }),
    prisma.packedStockMovement.groupBy({
      by: ["sellableSkuId"],
      _sum: { qtyChange: true },
    }),
    prisma.stockMovement.groupBy({
      by: ["componentId"],
      _sum: { qtyChange: true },
    }),
  ]);

  const onHandBySku = new Map(
    packedSums.map((s) => [s.sellableSkuId, s._sum.qtyChange ?? 0]),
  );

  const stockByComponentId = new Map(
    componentSums.map((s) => [s.componentId, s._sum.qtyChange ?? 0]),
  );

  const rows = skus.map((s) => {
    const packedOnHand = onHandBySku.get(s.id) ?? 0;
    const hasRules = s.skuComponentRules.length > 0;
    const packableFromComponents = hasRules
      ? packableUnitsFromRules(s.skuComponentRules, stockByComponentId)
      : null;
    const totalAvailable =
      packedOnHand + (packableFromComponents ?? 0);
    const status = shelfStatus({
      packedOnHand,
      packableFromComponents,
      hasRules,
    });
    return {
      id: s.id,
      name: s.name,
      sku: s.sku,
      packedOnHand,
      packableFromComponents,
      totalAvailable,
      status,
      hasRules,
    };
  });

  return (
    <div className="min-h-full bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Packed stock</h1>
            <p className="mt-1 text-sm text-zinc-600">
              On hand from packed movements; <strong>packable</strong> is how many more units you
              could build from current{" "}
              <Link href="/stock" className="font-medium text-zinc-800 underline">
                component stock
              </Link>{" "}
              using SKU → component mappings. SKUs without mappings are omitted from packable.
            </p>
          </div>
          <nav className="flex flex-wrap gap-3 text-sm font-medium">{nav}</nav>
        </header>

        <section>
          {skus.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">
              No SKUs yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">SKU code</th>
                    <th className="px-4 py-3 text-right">Packed on hand</th>
                    <th className="px-4 py-3 text-right">Packable from components</th>
                    <th className="px-4 py-3 text-right">Total available potential</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-50/80">
                      <td className="px-4 py-3 font-medium text-zinc-900">{r.name}</td>
                      <td className="px-4 py-3 font-mono text-zinc-700">{r.sku}</td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums font-medium ${
                          r.packedOnHand < 0
                            ? "text-red-700"
                            : r.packedOnHand === 0
                              ? "text-zinc-600"
                              : "text-zinc-900"
                        }`}
                      >
                        {r.packedOnHand}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-800">
                        {r.hasRules ? (
                          r.packableFromComponents
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-zinc-900">
                        {r.totalAvailable}
                      </td>
                      <td className="px-4 py-3">
                        <span className={statusBadge(r.status)}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-4 text-xs text-zinc-500">
          Packable = min over rules of floor(component stock ÷ qty per unit). No mappings → no
          packable figure. Status <strong>LOW</strong> when packed &gt; 0 but you cannot pack another
          unit from current components, or when a future packed reorder threshold is set.
        </p>
      </div>
    </div>
  );
}
