import { cx } from '../lib/cx.ts';

export interface BrandChipProps {
  label: string;
  className?: string;
}

/** Chip de submarca. Usa las variables --color-brand-* que define el tema de submarca/campaña. */
export function BrandChip({ label, className }: BrandChipProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm normal-case tracking-wide',
        'bg-surface-container-high border border-outline-variant text-on-surface',
        className,
      )}
    >
      <span aria-hidden="true" className="w-2 h-2 rounded-full bg-brand-accent" />
      {label}
    </span>
  );
}
