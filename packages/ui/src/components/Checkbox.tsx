import { useId } from 'react';
import { cx } from '../lib/cx.ts';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

/** Casilla con objetivo táctil de 48px (DESIGN.md: controles sobredimensionados). */
export function Checkbox({ checked, onChange, label, disabled, className }: CheckboxProps) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cx(
        'flex items-center gap-3.5 p-3 min-h-12 rounded-lg select-none border transition-colors',
        disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
        checked ? 'bg-surface-container border-primary/60' : 'bg-surface-container/50 border-outline-variant hover:border-outline',
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="w-6 h-6 shrink-0 cursor-pointer accent-primary"
      />
      <span className="font-body-md text-body-md text-on-surface font-semibold">{label}</span>
    </label>
  );
}
