import { AppNav } from "./app-nav";
import { BrandMark } from "./brand-mark";

interface PageShellProps {
  active: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function PageShell({ active, title, description, children }: PageShellProps) {
  return (
    <div className="min-h-full bg-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <BrandMark className="mb-1" />
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
            {description && (
              <p className="mt-1 text-sm text-zinc-600">{description}</p>
            )}
          </div>
          <AppNav active={active} />
        </header>
        {children}
      </div>
    </div>
  );
}

interface PlaceholderCardProps {
  label: string;
}

export function PlaceholderCard({ label }: PlaceholderCardProps) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center shadow-sm">
      <p className="text-sm text-zinc-400">{label}</p>
    </div>
  );
}
