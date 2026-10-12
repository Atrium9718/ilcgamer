import { cx } from '../lib/cx.ts';

export interface SealMarkProps {
  size?: 'sm' | 'lg';
  /** Texto accesible. Por defecto "Industria Licorera de Caldas". */
  label?: string;
  className?: string;
}

/**
 * Marcador del sello institucional (doble anillo dorado con "ILC").
 * NO es el logo oficial: se reemplaza por el activo aprobado cuando ILC lo entregue.
 * Nunca añadir fechas, cifras o lemas que no estén aprobados.
 */
export function SealMark({ size = 'lg', label = 'Industria Licorera de Caldas', className }: SealMarkProps) {
  const lg = size === 'lg';
  return (
    <div
      role="img"
      aria-label={label}
      className={cx(
        'rounded-full flex items-center justify-center border border-primary/40 bg-surface-container-low',
        lg ? 'w-20 h-20 p-1 shadow-[0_0_24px_color-mix(in_srgb,var(--color-primary-container)_20%,transparent)]' : 'w-6 h-6',
        className,
      )}
    >
      <div
        className={cx(
          'w-full h-full rounded-full flex items-center justify-center',
          lg && 'border border-primary-container/40 bg-gradient-to-b from-surface-container-high to-surface-container-low',
        )}
      >
        <span aria-hidden="true" className={cx('font-headline text-primary font-bold leading-none', lg ? 'text-2xl tracking-widest' : 'text-[11px] tracking-tighter')}>
          ILC
        </span>
      </div>
    </div>
  );
}
