import { useId } from 'react';
import { cx } from '../lib/cx.ts';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: string;
}

export interface SegmentedControlProps<T extends string> {
  label: string;
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Muestra la etiqueta visible; si es false, solo para lectores de pantalla. */
  showLabel?: boolean;
}

/** Selector de opciones excluyentes (radiogroup accesible) con objetivos de 48px. */
export function SegmentedControl<T extends string>({ label, options, value, onChange, showLabel = true }: SegmentedControlProps<T>) {
  const id = useId();
  return (
    <fieldset className="space-y-1.5">
      <legend className={cx('font-label-lg text-label-lg text-on-surface', !showLabel && 'sr-only')}>{label}</legend>
      <div className="grid gap-1 p-1 rounded-xl bg-surface-container-low border border-outline-variant" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <label
              key={o.value}
              className={cx(
                'flex items-center justify-center gap-1.5 min-h-12 px-2 rounded-lg cursor-pointer text-center font-label-lg text-[14px] transition-colors',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary',
                selected ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant hover:text-on-surface',
              )}
            >
              <input type="radio" name={id} value={o.value} checked={selected} onChange={() => onChange(o.value)} className="sr-only" />
              {o.icon && <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{o.icon}</span>}
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
