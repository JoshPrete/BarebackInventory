import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PackingForm } from "@/app/packing/packing-form";

export const dynamic = "force-dynamic";

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
    <Link href="/stock" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Stock
    </Link>
    <Link href="/packed-stock" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Packed stock
    </Link>
    <span className="font-semibold text-zinc-900">Packing</span>
    <Link href="/movements" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Movements
    </Link>
    <Link href="/receipts" className="text-zinc-600 hover:text-zinc-900 hover:underline">
      Receipts
    </Link>
  </>
);

export default async function PackingPage() {
  const skus = await prisma.sellableSKU.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, sku: true },
  });

  return (
    <div className="min-h-full bg-zinc-50">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Packing</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Build finished goods: deduct raw/packaging components and add packed units for a SKU.
            </p>
          </div>
          <nav className="flex flex-wrap gap-3 text-sm font-medium">{nav}</nav>
        </header>

        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-zinc-900">New packing run</h2>
          <PackingForm skus={skus} />
        </section>
      </div>
    </div>
  );
}
