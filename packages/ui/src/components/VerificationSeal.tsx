import { cx } from '../lib/cx.ts';
import { Icon } from './Icon.tsx';

/**
 * Estados de consulta de un código de producto (Guía Técnica §5.6).
 * La interfaz NUNCA afirma "Producto 100 % auténtico": solo informa lo que el servidor puede respaldar.
 */
export type CodeStatus = 'recognized' | 'unrecognized' | 'already_claimed' | 'needs_review';

export const CODE_STATUS_COPY: Record<CodeStatus, string> = {
  recognized: 'Código reconocido',
  unrecognized: 'Código no reconocido',
  already_claimed: 'Este código ya registra una reclamación',
  needs_review: 'Requiere verificación adicional',
};

const STYLE: Record<CodeStatus, { icon: string; ring: string; text: string; glow?: string }> = {
  recognized: {
    icon: 'check',
    ring: 'border-secondary text-secondary bg-secondary-container',
    text: 'border-secondary/40',
    glow: 'shadow-[0_0_24px_color-mix(in_srgb,var(--color-secondary)_22%,transparent)]',
  },
  unrecognized: { icon: 'close', ring: 'border-error text-error bg-error-container', text: 'border-error/40' },
  already_claimed: { icon: 'history', ring: 'border-warning text-warning bg-surface-container-high', text: 'border-warning/40' },
  needs_review: { icon: 'help', ring: 'border-warning text-warning bg-surface-container-high', text: 'border-warning/40' },
};

export interface VerificationSealProps {
  status: CodeStatus;
  /** Ej.: "Ron Viejo de Caldas Gran Reserva Especial · Lote #4092". Solo datos devueltos por el servidor. */
  productLabel?: string;
  /** Abre la explicación de qué verifica (y qué no) el código. */
  onExplain?: () => void;
  className?: string;
}

export function VerificationSeal({ status, productLabel, onExplain, className }: VerificationSealProps) {
  const s = STYLE[status];
  return (
    <section aria-live="polite" className={cx('bg-surface-container-low rounded-2xl border p-4 flex items-start gap-3.5', s.text, s.glow, className)}>
      <div className="shrink-0 mt-0.5 w-11 h-11 rounded-full border border-outline-variant flex items-center justify-center">
        <div className={cx('w-8 h-8 rounded-full border-2 flex items-center justify-center', s.ring)}>
          <Icon name={s.icon} filled className="text-[20px]" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="font-headline-md text-[19px] leading-7 font-semibold text-on-surface">{CODE_STATUS_COPY[status]}</h2>
        {productLabel && <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">{productLabel}</p>}
        {onExplain && (
          <button
            type="button"
            onClick={onExplain}
            className="inline-flex items-center gap-1 min-h-12 font-label-lg text-[13px] text-secondary underline decoration-outline underline-offset-4 hover:text-primary"
          >
            ¿Qué verifica este código?
            <Icon name="arrow_forward" className="text-[14px]" />
          </button>
        )}
      </div>
    </section>
  );
}
