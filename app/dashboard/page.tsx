import { PageShell, PlaceholderCard } from "@/app/_components/page-shell";

export default function DashboardPage() {
  return (
    <PageShell
      active="/dashboard"
      title="Dashboard"
      description="Overview of inventory health, recent activity, and pending actions."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          "Component stock summary",
          "Packed stock on hand",
          "Open alerts",
          "Recent receipts",
          "Recent sales",
          "Shopify sync status",
        ].map((label) => (
          <PlaceholderCard key={label} label={label} />
        ))}
      </div>
    </PageShell>
  );
}
