import { AppNav } from "@/app/_components/app-nav";
import { BrandMark } from "@/app/_components/brand-mark";

export default function Home() {
  return (
    <div className="min-h-full bg-zinc-50">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <BrandMark className="mb-2" />
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
              Bareback Biltong — inventory
            </h1>
            <p className="mt-2 text-base leading-relaxed text-zinc-600">
              Internal tool for raw & packaging, packing runs, and ready-to-sell stock. Use the nav to
              jump to daily tasks.
            </p>
          </div>
          <AppNav active="/" />
        </header>

        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Typical flow
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-700">
            <li>
              <strong className="font-medium text-zinc-900">Receipts</strong> — book in supplier
              goods into raw stock.
            </li>
            <li>
              <strong className="font-medium text-zinc-900">Run Packing</strong> — consume
              components and add finished units.
            </li>
            <li>
              <strong className="font-medium text-zinc-900">Sales</strong> — ship from ready-to-sell
              on hand.
            </li>
          </ol>
        </section>
      </div>
    </div>
  );
}
