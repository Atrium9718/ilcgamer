import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx.ts';
import { Icon } from './Icon.tsx';

export type ButtonVariant = 'primary' | 'secondary' | 'text';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Ícono de Material Symbols antes del texto. */
  leadingIcon?: string;
  /** Ícono de Material Symbols después del texto. */
  trailingIcon?: string;
  /** Muestra un estado de espera y bloquea dobles toques (operaciones con efecto económico). */
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'h-14 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg shadow-lg hover:bg-primary-container disabled:bg-surface-container-high disabled:text-outline disabled:shadow-none',
  secondary:
    'h-13 rounded-xl border border-primary/50 bg-transparent text-on-surface font-label-lg text-label-lg hover:bg-surface-container disabled:border-outline-variant disabled:text-outline',
  text: 'min-h-12 px-3 text-on-surface-variant font-label-lg text-label-lg hover:text-primary disabled:text-outline',
};

export function Button({
  variant = 'primary',
  leadingIcon,
  trailingIcon,
  loading = false,
  fullWidth = true,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANTS[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Icon name="progress_activity" className="animate-spin text-[22px]" />
      ) : (
        leadingIcon && <Icon name={leadingIcon} filled className="text-[22px]" />
      )}
      <span>{children}</span>
      {trailingIcon && !loading && <Icon name={trailingIcon} className="text-[20px]" />}
    </button>
  );
}
