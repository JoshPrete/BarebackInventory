import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ReceiptForm } from "@/app/receipts/receipt-form";

export const dynamic = "force-dynamic";

const navLinks = (
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
    <Link href="/movements" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Movements
    </Link>
    <Link href="/stock" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Stock
    </Link>
    <Link href="/adjustments" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Adjustments
    </Link>
  </>
);

export default async function ReceiptsPage() {
  const [components, recentReceipts] = await Promise.all([
    prisma.component.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true },
    }),
    prisma.receipt.findMany({
      orderBy: { receivedAt: "desc" },
      take: 20,
      include: {
        lines: {
          include: {
            component: { select: { name: true, unit: true } },
          },
          orderBy: { id: "asc" },
        },
      },
    }),
  ]);

  return (
    <div className="min-h-full bg-zinc-50">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Receive stock</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Multi-line goods receipt; inventory updates from stock movements.
            </p>
          </div>
          <nav className="flex flex-wrap gap-3 text-sm font-medium">{navLinks}</nav>
        </header>

        <section className="mb-10 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-zinc-900">New receipt</h2>
          <ReceiptForm components={components} />
        </section>

        <section>
          <h2 className="mb-4 text-lg font-medium text-zinc-900">Recent receipts</h2>
          {recentReceipts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">
              No receipts recorded yet.
            </p>
          ) : (
            <div className="space-y-4">
              {recentReceipts.map((r) => (
                <div
                  key={r.id}
                  className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-100 bg-zinc-50 px-4 py-3">
                    <div className="text-sm">
                      <span className="font-medium text-zinc-900">{r.supplierName}</span>
                      {r.invoiceRef ? (
                        <span className="ml-2 font-mono text-xs text-zinc-600">
                          #{r.invoiceRef}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-zinc-500">
                      Received{" "}
                      <span className="font-medium text-zinc-700">
                        {r.receivedAt.toISOString().slice(0, 10)}
                      </span>
                      <span className="mx-2">·</span>
                      {r.lines.length} line{r.lines.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  {r.note ? (
                    <p className="border-b border-zinc-100 px-4 py-2 text-sm text-zinc-600">
                      {r.note}
                    </p>
                  ) : null}
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-zinc-100 bg-white text-xs font-medium uppercase tracking-wide text-zinc-600">
                      <tr>
                        <th className="px-4 py-2">Component</th>
                        <th className="px-4 py-2 text-right">Qty</th>
                        <th className="px-4 py-2 text-right">Unit cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {r.lines.map((line) => (
                        <tr key={line.id} className="hover:bg-zinc-50/80">
                          <td className="px-4 py-2 font-medium text-zinc-900">
                            {line.component.name}{" "}
                            <span className="font-normal text-zinc-500">
                              ({line.component.unit})
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-green-700">
                            +{line.quantity}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-zinc-700">
                            {line.unitCost != null ? line.unitCost : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
