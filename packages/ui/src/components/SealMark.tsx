import { cx } from '../lib/cx.ts';

export interface SealMarkProps {
  size?: 'sm' | 'lg';
  /** Texto accesible. Por defecto "Industria Licorera de Caldas". */
  label?: string;
  className?: string;
}

/** Ruta pública del logo oficial (cada app lo sirve desde `public/brand/`). */
export const BRAND_LOGO_URL = '/brand/ilc-logo.png';

/**
 * Logo oficial de la Industria Licorera de Caldas (sello "ILC"). El archivo lo entregó ILC; no se modifica ni se recolorea.
 * Nunca añadir fechas, cifras o lemas que no estén aprobados.
 */
export function SealMark({ size = 'lg', label = 'Industria Licorera de Caldas', className }: SealMarkProps) {
  return (
    <img
      src={BRAND_LOGO_URL}
      alt={label}
      width={size === 'lg' ? 80 : 24}
      height={size === 'lg' ? 80 : 24}
      className={cx('rounded-full object-contain', size === 'lg' ? 'w-20 h-20' : 'w-6 h-6', className)}
    />
  );
}
