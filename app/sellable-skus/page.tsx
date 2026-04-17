import { getStockSummaryForAllSkus } from "@/services/inventoryService";
import { AppNav } from "@/app/_components/app-nav";
import { BrandMark } from "@/app/_components/brand-mark";

export const dynamic = "force-dynamic";

export default async function SellableSkusPage() {
  const skus = await getStockSummaryForAllSkus();

  return (
    <div className="min-h-full bg-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <BrandMark className="mb-1" />
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Sellable SKUs
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              {skus.length} SKU{skus.length !== 1 ? "s" : ""} — packed stock and BOM component levels.
            </p>
          </div>
          <AppNav active="/sellable-skus" />
        </header>

        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 text-right">Packed on-hand</th>
                <th className="px-4 py-3">BOM components</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {skus.map((sku) => (
                <tr key={sku.sellableSkuId} className="align-top">
                  <td className="px-4 py-3 font-mono text-xs text-zinc-700">
                    {sku.skuCode}
                  </td>
                  <td className="px-4 py-3 text-zinc-900">{sku.skuName}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-900">
                    {sku.packedOnHand}
                  </td>
                  <td className="px-4 py-3">
                    {sku.components.length === 0 ? (
                      <span className="text-zinc-400">no BOM</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {sku.components.map((c) => (
                          <li key={c.componentId} className="text-zinc-600">
                            <span className="tabular-nums text-zinc-900">
                              {c.onHand}
                            </span>{" "}
                            {c.unit} {c.componentName}
                            <span className="ml-1 text-zinc-400">
                              ({c.qtyPerUnit}/unit)
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
