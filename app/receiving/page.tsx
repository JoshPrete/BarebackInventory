import { PageShell, PlaceholderCard } from "@/app/_components/page-shell";

export default function ReceivingPage() {
  return (
    <PageShell
      active="/receiving"
      title="Receiving"
      description="Book in supplier deliveries. Creates a receipt header, lines, and raw stock movements."
    >
      <div className="space-y-4">
        <PlaceholderCard label="New receipt form — calls receiveStock()" />
        <PlaceholderCard label="Receipt history table" />
      </div>
    </PageShell>
  );
}
