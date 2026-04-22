import { PageShell } from "@/app/_components/page-shell";

export default function HowItWorksPage() {
  return (
    <PageShell
      active="/how-it-works"
      title="How this system works"
      description="Everything you need to know in under 30 seconds."
    >
      <div className="mx-auto max-w-2xl space-y-10">

        {/* ── Section 1: Daily workflow ────────────────────────────────── */}
        <section>
          <h2 className="mb-4 text-base font-semibold text-zinc-900">Your daily routine</h2>
          <ol className="space-y-4">
            {[
              {
                step: "1",
                title: "Check what to order",
                body: "Open the dashboard every morning. If anything needs ordering, it will be at the top — with the exact quantity and why.",
              },
              {
                step: "2",
                title: "Record deliveries when they arrive",
                body: "Go to Receipts and log what came in. This updates your ingredient stock automatically.",
              },
              {
                step: "3",
                title: "Run packing and record it here",
                body: "After every packing session, go to Run Packing, enter the product and how many units you made. This deducts ingredients and updates your Shopify stock.",
              },
            ].map(({ step, title, body }) => (
              <li key={step} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-bold text-white">
                  {step}
                </span>
                <div>
                  <p className="font-semibold text-zinc-900">{title}</p>
                  <p className="mt-0.5 text-sm text-zinc-600">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <hr className="border-zinc-200" />

        {/* ── Section 2: What the system does automatically ─────────── */}
        <section>
          <h2 className="mb-4 text-base font-semibold text-zinc-900">What happens automatically</h2>
          <ul className="space-y-3">
            {[
              {
                icon: "📉",
                text: "When you record a packing run, ingredients are deducted automatically based on your recipes.",
              },
              {
                icon: "🛍️",
                text: "When a sale comes through Shopify, it is recorded here automatically within minutes.",
              },
              {
                icon: "📦",
                text: "When you pack finished goods, Shopify stock is updated automatically — you do not need to touch Shopify.",
              },
              {
                icon: "⚠️",
                text: "Reorder calculations update daily. The dashboard tells you exactly when you will run out and how much to order.",
              },
            ].map(({ icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="mt-0.5 text-lg leading-none">{icon}</span>
                <p className="text-sm text-zinc-700">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <hr className="border-zinc-200" />

        {/* ── Section 3: What you need to do ───────────────────────── */}
        <section>
          <h2 className="mb-4 text-base font-semibold text-zinc-900">What you need to do</h2>
          <ul className="space-y-3">
            {[
              "Record every delivery in Receipts as soon as it arrives.",
              "Record every packing session in Run Packing before the end of the day.",
              "Check the dashboard each morning to see if anything needs ordering.",
              "If something looks wrong, check Receipts and Run Packing history first.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                <p className="text-sm text-zinc-700">{item}</p>
              </li>
            ))}
          </ul>
        </section>

        <hr className="border-zinc-200" />

        {/* ── Section 4: What not to do ─────────────────────────────── */}
        <section>
          <h2 className="mb-4 text-base font-semibold text-zinc-900">What not to do</h2>
          <ul className="space-y-3">
            {[
              {
                dont: "Don't adjust stock directly in Shopify.",
                why: "Shopify stock is managed by this app. Manual changes in Shopify will be out of sync with your ingredient records.",
              },
              {
                dont: "Don't skip recording a packing run.",
                why: "If you pack without recording it, your ingredient levels will be wrong and the dashboard will give bad ordering advice.",
              },
              {
                dont: "Don't record deliveries in Shopify.",
                why: "Deliveries go in Receipts here. That is how ingredients get added back to your stock.",
              },
            ].map(({ dont, why }) => (
              <li key={dont} className="rounded-lg border border-red-100 bg-red-50 px-4 py-3">
                <p className="text-sm font-semibold text-red-800">{dont}</p>
                <p className="mt-0.5 text-sm text-red-700">{why}</p>
              </li>
            ))}
          </ul>
        </section>

        <hr className="border-zinc-200" />

        {/* ── Section 5: Mental model ───────────────────────────────── */}
        <section>
          <h2 className="mb-4 text-base font-semibold text-zinc-900">Simple mental model</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Shopify</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">What you can sell</p>
              <p className="mt-1 text-sm text-zinc-600">
                Stock levels, online orders, what customers see.
                This app keeps it up to date — you don't need to touch it.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">This app</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">What you can make</p>
              <p className="mt-1 text-sm text-zinc-600">
                Ingredients, packing runs, ordering decisions.
                If it's not recorded here, the system doesn't know about it.
              </p>
            </div>
          </div>
        </section>

      </div>
    </PageShell>
  );
}
