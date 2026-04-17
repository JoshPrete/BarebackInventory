import { PageShell, PlaceholderCard } from "@/app/_components/page-shell";

export default function SalesLedgerPage() {
  return (
    <PageShell
      active="/sales-ledger"
      title="Sales Ledger"
      description="All sales — from Shopify orders and manual entries — with packed stock deductions."
    >
      <div className="space-y-4">
        <PlaceholderCard label="Sales ledger table — ordered by date desc" />
        <PlaceholderCard label="Record manual sale form" />
      </div>
    </PageShell>
  );
}
