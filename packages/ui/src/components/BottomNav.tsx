import { cx } from '../lib/cx.ts';
import { Icon } from './Icon.tsx';

export type NavTab = 'inicio' | 'jugar' | 'billetera' | 'perfil';

const TABS: ReadonlyArray<{ id: NavTab; label: string; icon: string }> = [
  { id: 'inicio', label: 'Inicio', icon: 'home' },
  { id: 'jugar', label: 'Jugar', icon: 'stadia_controller' },
  { id: 'billetera', label: 'Mi billetera', icon: 'account_balance_wallet' },
  { id: 'perfil', label: 'Perfil', icon: 'person' },
];

export interface BottomNavProps {
  active: NavTab;
  onNavigate: (tab: NavTab) => void;
}

/** Navegación inferior de la PWA (DESIGN.md: Inicio · Jugar · Mi billetera · Perfil). */
export function BottomNav({ active, onNavigate }: BottomNavProps) {
  return (
    <nav aria-label="Principal" className="sticky bottom-0 z-40 bg-surface-container-low/95 backdrop-blur-md border-t border-outline-variant pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-4">
        {TABS.map((t) => {
          const selected = t.id === active;
          return (
            <li key={t.id}>
              <button
                type="button"
                aria-current={selected ? 'page' : undefined}
                onClick={() => onNavigate(t.id)}
                className={cx('w-full min-h-16 flex flex-col items-center justify-center gap-0.5 font-label-sm text-[11px]', selected ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface')}
              >
                <span className={cx('px-4 py-0.5 rounded-full', selected && 'bg-secondary-container')}>
                  <Icon name={t.icon} filled={selected} className="text-[24px]" />
                </span>
                {t.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
