import { useId } from 'react';
import { cx } from '../lib/cx.ts';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

/** Interruptor accesible (role="switch") con objetivo táctil de 48px. */
export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <label htmlFor={id} className="font-title-md text-[16px] text-on-surface">
          {label}
        </label>
        {description && (
          <p id={`${id}-desc`} className="mt-0.5 font-body-md text-[13px] text-on-surface-variant">
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="shrink-0 w-14 h-12 flex items-center justify-center disabled:opacity-50"
      >
        <span
          className={cx(
            'relative w-12 h-7 rounded-full border transition-colors',
            checked ? 'bg-secondary border-secondary' : 'bg-surface-container-highest border-outline',
          )}
        >
          <span
            aria-hidden="true"
            className={cx(
              'absolute top-0.5 w-5.5 h-5.5 rounded-full transition-all',
              checked ? 'left-[1.375rem] bg-on-secondary' : 'left-0.5 bg-on-surface-variant',
            )}
          />
        </span>
        <span className="sr-only">{checked ? 'Activado' : 'Desactivado'}</span>
      </button>
    </div>
  );
}
