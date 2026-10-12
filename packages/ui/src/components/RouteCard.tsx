import { cx } from '../lib/cx.ts';
import { Icon } from './Icon.tsx';

export type Route = 'A' | 'B';

export interface RouteCardProps {
  /** A = activación comercial (Puntos ILC). B = exploración y experiencia (XP/insignias). */
  route: Route;
  title: string;
  description: string;
  /** Etiqueta destacada, ej. "+500 Puntos ILC" (Ruta A) o "Aventura y relatos" (Ruta B). */
  badge?: string;
  footerLabel: string;
  footerIcon?: string;
  onSelect: () => void;
}

const ROUTE_STYLE: Record<Route, { card: string; dot: string; title: string; badge: string }> = {
  A: {
    card: 'bg-surface-container border-primary/35 hover:border-primary/70',
    dot: 'bg-primary',
    title: 'text-primary',
    badge: 'bg-surface-container-high border-primary/40 text-primary',
  },
  B: {
    card: 'bg-surface-container-low border-secondary/35 hover:border-secondary/70',
    dot: 'bg-secondary',
    title: 'text-secondary',
    badge: 'bg-secondary-container border-secondary/40 text-on-secondary-container',
  },
};

/** Tarjeta de elección de ruta. Las dos rutas se distinguen siempre por color, ícono y texto (no solo color). */
export function RouteCard({ route, title, description, badge, footerLabel, footerIcon = 'arrow_forward', onSelect }: RouteCardProps) {
  const s = ROUTE_STYLE[route];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cx('group w-full text-left rounded-2xl p-4 border transition-all duration-200 active:scale-[0.99]', s.card)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span aria-hidden="true" className={cx('w-2 h-2 rounded-full', s.dot)} />
            <span className={cx('font-title-md text-title-md', s.title)}>{title}</span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant">{description}</p>
        </div>
        {badge && (
          <span className={cx('shrink-0 px-2.5 py-1 rounded-xl border font-label-sm text-[12px] normal-case whitespace-nowrap tabular-nums', s.badge)}>
            {badge}
          </span>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-outline-variant flex items-center justify-between">
        <span className="font-label-sm text-label-sm uppercase text-on-surface-variant">{footerLabel}</span>
        <Icon name={footerIcon} className={cx('text-[18px] transition-transform duration-150 group-hover:translate-x-1', s.title)} />
      </div>
    </button>
  );
}
