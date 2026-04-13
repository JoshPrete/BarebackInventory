import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function componentTypeBadge(type: string) {
  const base = "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold";
  switch (type) {
    case "SALE":
      return `${base} bg-red-100 text-red-800`;
    case "RECEIPT":
      return `${base} bg-emerald-100 text-emerald-900`;
    case "ADJUSTMENT":
      return `${base} bg-amber-100 text-amber-900`;
    default:
      return `${base} bg-zinc-100 text-zinc-800`;
  }
}

function packedTypeBadge(type: string) {
  const base = "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold";
  switch (type) {
    case "SALE":
      return `${base} bg-red-100 text-red-800`;
    case "PACK":
      return `${base} bg-sky-100 text-sky-900`;
    case "ADJUSTMENT":
      return `${base} bg-amber-100 text-amber-900`;
    default:
      return `${base} bg-zinc-100 text-zinc-800`;
  }
}

function referenceCell(
  note: string | null,
  type: string,
  orderRef: string | null | undefined,
) {
  if (note && note.trim()) return note;
  if (type === "SALE" && orderRef) return `Order: ${orderRef}`;
  return "—";
}

export default async function MovementsPage() {
  const [movements, packedMovements] = await Promise.all([
    prisma.stockMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        component: { select: { name: true, unit: true } },
        manualSale: { select: { orderRef: true } },
      },
    }),
    prisma.packedStockMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        sellableSku: { select: { name: true, sku: true } },
        manualSale: { select: { orderRef: true } },
      },
    }),
  ]);

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
      <Link href="/mappings" className="text-zinc-600 hover:text-zinc-900 hover:underline">
        Mappings
      </Link>
      <Link href="/sales" className="text-zinc-600 hover:text-zinc-900 hover:underline">
        Sales
      </Link>
      <Link href="/packing" className="text-zinc-600 hover:text-zinc-900 hover:underline">
        Packing
      </Link>
      <Link href="/packed-stock" className="text-zinc-600 hover:text-zinc-900 hover:underline">
        Packed stock
      </Link>
      <Link href="/stock" className="text-zinc-600 hover:text-zinc-900 hover:underline">
        Stock
      </Link>
      <Link href="/receipts" className="text-zinc-600 hover:text-zinc-900 hover:underline">
        Receipts
      </Link>
      <Link href="/adjustments" className="text-zinc-600 hover:text-zinc-900 hover:underline">
        Adjustments
      </Link>
    </>
  );

  return (
    <div className="min-h-full bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-zinc-900">Stock movements</h1>
          <nav className="flex flex-wrap gap-3 text-sm font-medium">{nav}</nav>
        </header>

        <p className="mb-6 text-sm text-zinc-600">
          <strong>Components</strong> (raw / packaging):{" "}
          <span className={componentTypeBadge("SALE")}>SALE</span>{" "}
          <span className={`${componentTypeBadge("RECEIPT")} ml-2`}>RECEIPT</span>{" "}
          <span className={`${componentTypeBadge("ADJUSTMENT")} ml-2`}>ADJUSTMENT</span>
          <span className="mx-3 text-zinc-400">|</span>
          <strong>Packed</strong> (finished SKU units):{" "}
          <span className={packedTypeBadge("PACK")}>PACK</span>{" "}
          <span className={`${packedTypeBadge("SALE")} ml-2`}>SALE</span>{" "}
          <span className={`${packedTypeBadge("ADJUSTMENT")} ml-2`}>ADJUSTMENT</span>
        </p>

        <section className="mb-10">
          <h2 className="mb-3 text-lg font-medium text-zinc-900">Component movements</h2>
          {movements.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">
              No component movements yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Component</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Qty change</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Note / reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-zinc-50/80">
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                        {m.createdAt.toISOString().slice(0, 19).replace("T", " ")}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {m.component.name}
                        <span className="ml-1 font-normal text-zinc-500">({m.component.unit})</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={componentTypeBadge(m.type)}>{m.type}</span>
                      </td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums font-medium ${
                          m.qtyChange < 0
                            ? "text-red-700"
                            : m.qtyChange > 0
                              ? "text-green-700"
                              : "text-zinc-700"
                        }`}
                      >
                        {m.qtyChange > 0 ? "+" : ""}
                        {m.qtyChange}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-600">{m.sourceType}</td>
                      <td className="max-w-[280px] px-4 py-3 text-zinc-700">
                        {referenceCell(m.note, m.type, m.manualSale?.orderRef)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-medium text-zinc-900">Packed stock movements</h2>
          {packedMovements.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">
              No packed movements yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Qty change</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Note / reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {packedMovements.map((m) => (
                    <tr key={m.id} className="hover:bg-zinc-50/80">
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                        {m.createdAt.toISOString().slice(0, 19).replace("T", " ")}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {m.sellableSku.name}{" "}
                        <span className="font-mono font-normal text-zinc-600">
                          ({m.sellableSku.sku})
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={packedTypeBadge(m.type)}>{m.type}</span>
                      </td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums font-medium ${
                          m.qtyChange < 0
                            ? "text-red-700"
                            : m.qtyChange > 0
                              ? "text-green-700"
                              : "text-zinc-700"
                        }`}
                      >
                        {m.qtyChange > 0 ? "+" : ""}
                        {m.qtyChange}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-600">{m.sourceType}</td>
                      <td className="max-w-[280px] px-4 py-3 text-zinc-700">
                        {referenceCell(m.note, m.type, m.manualSale?.orderRef)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
