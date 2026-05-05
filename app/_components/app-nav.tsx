import Link from "next/link";

export const PRIMARY_NAV = [
  { href: "/dashboard", label: "Home" },
  { href: "/receipts", label: "Receive" },
  { href: "/packing", label: "Pack" },
  { href: "/stock", label: "Ingredients" },
  { href: "/sales", label: "Sales" },
  { href: "/how-it-works", label: "How it works" },
] as const;

export const SECONDARY_NAV = [
  { href: "/components", label: "Raw & Packaging" },
  { href: "/skus", label: "Products" },
  { href: "/mappings", label: "SKU mappings" },
  { href: "/packed-stock", label: "Ready to Sell" },
  { href: "/reorder", label: "Reorder" },
  { href: "/movements", label: "Movements" },
  { href: "/adjustments", label: "Adjustments" },
  { href: "/integrations", label: "Integrations" },
  { href: "/warnings", label: "Warnings" },
] as const;

export const APP_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV] as const;

export function AppNav({ active }: { active: string }) {
  return (
    <nav aria-label="Main" className="space-y-2">
      {/* Primary navigation */}
      <div className="flex max-w-xl flex-wrap gap-x-1 gap-y-1 lg:max-w-none lg:justify-end">
        {PRIMARY_NAV.map(({ href, label }) => {
          const isActive = href === active;
          return (
            <Link
              key={href}
              href={href}
              className={
                isActive
                  ? "rounded-md bg-zinc-200/80 px-2.5 py-1.5 text-sm font-semibold text-zinc-900"
                  : "rounded-md px-2.5 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              }
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Secondary navigation */}
      <div className="flex max-w-xl flex-wrap gap-x-1 gap-y-0.5 lg:max-w-none lg:justify-end">
        {SECONDARY_NAV.map(({ href, label }) => {
          const isActive = href === active;
          return (
            <Link
              key={href}
              href={href}
              className={
                isActive
                  ? "rounded px-2 py-0.5 text-xs font-semibold text-zinc-600"
                  : "rounded px-2 py-0.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
              }
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
