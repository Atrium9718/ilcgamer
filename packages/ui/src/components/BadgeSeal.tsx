import { cx } from '../lib/cx.ts';
import { Icon } from './Icon.tsx';

export interface BadgeSealProps {
  name: string;
  icon: string;
  earned: boolean;
  size?: 'md' | 'lg';
}

/** Insignia con el motivo de sello de doble anillo (DESIGN.md › Shapes). */
export function BadgeSeal({ name, icon, earned, size = 'md' }: BadgeSealProps) {
  const lg = size === 'lg';
  return (
    <figure className="flex flex-col items-center gap-1.5 text-center">
      <span
        className={cx(
          'rounded-full p-1 border flex items-center justify-center',
          lg ? 'w-28 h-28' : 'w-18 h-18',
          earned ? 'border-primary/60 shadow-[0_0_20px_color-mix(in_srgb,var(--color-secondary)_20%,transparent)]' : 'border-outline-variant',
        )}
      >
        <span className={cx('w-full h-full rounded-full border-2 flex items-center justify-center', earned ? 'border-secondary bg-secondary-container text-secondary' : 'border-outline-variant bg-surface-container text-outline')}>
          <Icon name={earned ? icon : 'lock'} filled={earned} className={lg ? 'text-[44px]' : 'text-[28px]'} />
        </span>
      </span>
      <figcaption className={cx('font-label-lg text-[12px] leading-4', earned ? 'text-on-surface' : 'text-on-surface-variant')}>
        {name}
        {!earned && <span className="sr-only"> (bloqueada)</span>}
      </figcaption>
    </figure>
  );
}
