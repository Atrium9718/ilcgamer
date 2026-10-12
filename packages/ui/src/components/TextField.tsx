import { type InputHTMLAttributes, useId } from 'react';
import { cx } from '../lib/cx.ts';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  /** Muestra contador "n/max" cuando hay maxLength. */
  showCount?: boolean;
}

export function TextField({ label, value, onChange, hint, error, showCount, maxLength, className, ...rest }: TextFieldProps) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="font-label-lg text-label-lg text-on-surface">
          {label}
        </label>
        {showCount && maxLength && (
          <span className="font-label-sm text-label-sm text-on-surface-variant tabular-nums" aria-hidden="true">
            {value.length}/{maxLength}
          </span>
        )}
      </div>
      <input
        id={id}
        value={value}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        className={cx(
          'w-full h-13 px-4 rounded-xl bg-surface-container border outline-none font-body-lg text-body-lg text-on-surface',
          'placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary transition-colors',
          error ? 'border-error' : 'border-outline-variant',
        )}
        {...rest}
      />
      {hint && (
        <p id={`${id}-hint`} className="font-body-md text-[13px] text-on-surface-variant">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="font-label-lg text-[13px] text-error">
          {error}
        </p>
      )}
    </div>
  );
}
