import Link from "next/link";

export const APP_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/skus", label: "Products" },
  { href: "/components", label: "Components" },
  { href: "/mappings", label: "Recipes" },
  { href: "/reorder", label: "Orders" },
  { href: "/how-it-works", label: "How it works" },
] as const;

export function AppNav({ active }: { active: string }) {
  return (
    <nav aria-label="Main">
      <div className="flex max-w-xl flex-wrap gap-x-1 gap-y-1 lg:max-w-none lg:justify-end">
        {APP_NAV.map(({ href, label }) => {
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
    </nav>
  );
}
