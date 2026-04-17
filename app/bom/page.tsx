import { PageShell, PlaceholderCard } from "@/app/_components/page-shell";

export default function BomPage() {
  return (
    <PageShell
      active="/bom"
      title="BOM / SKU Component Rules"
      description="Define which components (and what quantities) are consumed to produce one unit of each sellable SKU."
    >
      <div className="space-y-4">
        <PlaceholderCard label="Add SKU component rule — calls createSkuComponentRule()" />
        <PlaceholderCard label="Rules table: SKU → component → qty per unit" />
      </div>
    </PageShell>
  );
}
