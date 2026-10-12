import { cx } from '../lib/cx.ts';

export interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
  tone?: 'primary' | 'secondary';
  /** Texto accesible del valor, ej. "Capítulo 2 de 6". */
  valueText?: string;
  className?: string;
}

export function ProgressBar({ value, max, label, tone = 'primary', valueText, className }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      className={cx('h-2 w-full rounded-full bg-surface-container-highest overflow-hidden', className)}
    >
      <div
        className={cx('h-full rounded-full transition-[width] duration-500', tone === 'primary' ? 'bg-primary' : 'bg-secondary')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
