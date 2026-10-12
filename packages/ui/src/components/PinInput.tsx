import { type ClipboardEvent, type KeyboardEvent, useId, useRef } from 'react';
import { cx } from '../lib/cx.ts';

export interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Longitud del PIN de sesión. Configurable: la Guía Técnica §5.5 permite ampliarla si hay riesgo. */
  length?: number;
  label?: string;
  /** Ayuda o intentos restantes, redactado por el contenedor. */
  hint?: string;
  error?: string;
  disabled?: boolean;
  /** Se llama cuando se completan todas las casillas. */
  onComplete?: (value: string) => void;
  /** "compact" para códigos de 6 dígitos en pantallas angostas. */
  size?: 'regular' | 'compact';
}

/**
 * PIN en casillas grandes (56px) con números tabulares, pegado y autocompletado OTP.
 * Solo captura dígitos; la validación, límites de intento y expiración son del servidor.
 */
export function PinInput({ value, onChange, length = 4, label = 'PIN del Parche', hint, error, disabled, onComplete, size = 'regular' }: PinInputProps) {
  const id = useId();
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, '').slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
    return clean;
  };

  const setAt = (index: number, digit: string) => {
    const chars = digits.slice();
    chars[index] = digit;
    return commit(chars.join(''));
  };

  const handleInput = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    if (!digit) return;
    setAt(index, digit);
    refs.current[Math.min(index + 1, length - 1)]?.focus();
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[index]) setAt(index, '');
      else if (index > 0) {
        setAt(index - 1, '');
        refs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus();
    else if (e.key === 'ArrowRight' && index < length - 1) refs.current[index + 1]?.focus();
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const clean = commit(e.clipboardData.getData('text'));
    refs.current[Math.min(clean.length, length - 1)]?.focus();
  };

  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <fieldset className="space-y-2">
      <legend className="w-full font-label-sm text-label-sm uppercase text-secondary text-center">{label}</legend>
      <div className={cx('flex justify-center', size === 'compact' ? 'gap-2' : 'gap-3')}>
        {digits.map((d, i) => (
          <input
            // biome-ignore lint/suspicious/noArrayIndexKey: posiciones fijas del PIN
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            aria-label={`Dígito ${i + 1} de ${length}`}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={1}
            disabled={disabled}
            value={d}
            onChange={(e) => handleInput(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            className={cx(
              size === 'compact' ? 'w-12 h-14 text-[26px]' : 'w-14 h-16 text-[32px]',
              'rounded-xl text-center bg-surface-container border outline-none tabular-nums',
              'font-numeric-xl text-primary transition-colors focus:border-primary focus:ring-1 focus:ring-primary',
              error ? 'border-error' : d ? 'border-primary/60' : 'border-outline-variant',
              disabled && 'opacity-60',
            )}
          />
        ))}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-center font-label-lg text-[13px] text-error">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-center font-body-md text-[13px] text-on-surface-variant">
            {hint}
          </p>
        )
      )}
    </fieldset>
  );
}
