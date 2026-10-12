import { cx } from '../lib/cx.ts';
import { formatNumber } from '../lib/format.ts';
import { Icon } from './Icon.tsx';

/**
 * Marcadores del Parche. Guía Técnica §5.5: el marcador del reto (XP, Ruta B / juego) y el saldo
 * comercial (Puntos ILC, Ruta A) se muestran como conceptos SEPARADOS y nunca se suman.
 */
export type ScoreKind = 'challenge' | 'commercial';

export interface ScoreCardProps {
  kind: ScoreKind;
  value: number;
  /** Unidad. Para "commercial" viene del CMS (Instrucciones §6: el nombre de la moneda es configurable). */
  unit: string;
  title: string;
  detail?: string;
}

const KIND: Record<ScoreKind, { icon: string; card: string; accent: string }> = {
  challenge: { icon: 'emoji_events', card: 'border-secondary/40 bg-surface-container-low', accent: 'text-secondary' },
  commercial: { icon: 'toll', card: 'border-primary/40 bg-surface-container', accent: 'text-primary' },
};



export function ScoreCard({ kind, value, unit, title, detail }: ScoreCardProps) {
  const k = KIND[kind];
  return (
    <section aria-label={title} className={cx('flex-1 min-w-0 rounded-2xl border p-3.5', k.card)}>
      <div className={cx('flex items-center gap-1.5', k.accent)}>
        <Icon name={k.icon} filled className="text-[18px]" />
        <h3 className="font-label-sm text-label-sm uppercase">{title}</h3>
      </div>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="font-numeric-xl text-[30px] leading-none text-on-surface tabular-nums">{formatNumber(value)}</span>
        <span className={cx('font-label-lg text-[13px]', k.accent)}>{unit}</span>
      </p>
      {detail && <p className="mt-1 font-body-md text-[13px] text-on-surface-variant">{detail}</p>}
    </section>
  );
}
