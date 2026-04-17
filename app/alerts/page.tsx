import { PageShell, PlaceholderCard } from "@/app/_components/page-shell";

export default function AlertsPage() {
  return (
    <PageShell
      active="/alerts"
      title="Alerts"
      description="Low stock and reorder alerts. Evaluated against component reorder points."
    >
      <div className="space-y-4">
        <PlaceholderCard label="Open alerts — calls getLowStockAlerts()" />
        <PlaceholderCard label="Re-evaluate now — calls evaluateAlerts()" />
      </div>
    </PageShell>
  );
}
