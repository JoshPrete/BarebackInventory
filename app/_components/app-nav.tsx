import Link from "next/link";

export const APP_NAV = [
  { href: "/", label: "Home" },
  { href: "/components", label: "Raw & Packaging" },
  { href: "/skus", label: "SKUs" },
  { href: "/mappings", label: "SKU mappings" },
  { href: "/sales", label: "Sales" },
  { href: "/packing", label: "Run Packing" },
  { href: "/stock", label: "Raw Stock" },
  { href: "/packed-stock", label: "Ready to Sell" },
  { href: "/reorder", label: "Reorder" },
  { href: "/movements", label: "Movements" },
  { href: "/receipts", label: "Receipts" },
  { href: "/adjustments", label: "Adjustments" },
  { href: "/integrations", label: "Integrations" },
  { href: "/warnings", label: "Warnings" },
] as const;

export function AppNav({ active }: { active: string }) {
  return (
    <nav
      className="flex max-w-xl flex-wrap gap-x-3 gap-y-2 text-sm font-medium lg:max-w-none lg:justify-end"
      aria-label="Main"
    >
      {APP_NAV.map(({ href, label }) => {
        const isActive = href === active;
        return (
          <Link
            key={href}
            href={href}
            className={
              isActive
                ? "rounded-md bg-zinc-200/80 px-2 py-1 font-semibold text-zinc-900"
                : "rounded-md px-2 py-1 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
