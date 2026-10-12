import { cx } from '../lib/cx.ts';

export interface IconProps {
  /** Nombre del ícono de Material Symbols (la misma familia que usa Stitch). */
  name: string;
  filled?: boolean;
  className?: string;
}

/** Ícono decorativo. Si transmite información, acompáñelo de texto visible o aria-label en el control. */
export function Icon({ name, filled = false, className }: IconProps) {
  return (
    <span aria-hidden="true" className={cx('material-symbols-outlined select-none leading-none', filled && 'icon-fill', className)}>
      {name}
    </span>
  );
}
