type BrandMarkProps = {
  className?: string;
};

/**
 * Brand header. Add `public/brand-logo.png` to show the circular logo; otherwise copy-only.
 */
export function BrandMark({ className = "" }: BrandMarkProps) {
  return (
    <div className={className}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-900">
        Bareback Biltong
      </p>
      <p className="text-[10px] text-zinc-500">Est. 2017 · Inventory</p>
    </div>
  );
}
