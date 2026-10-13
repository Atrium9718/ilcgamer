import type { ReactNode } from 'react';
import { Icon } from '../components/Icon.tsx';
import { SealMark } from '../components/SealMark.tsx';
import { cx } from '../lib/cx.ts';

export type ConsoleSection =
  | 'mi-actividad'
  | 'mi-comercio'
  | 'campanas'
  | 'juegos'
  | 'fiesta'
  | 'recompensas'
  | 'eventos'
  | 'smart-tags'
  | 'comercios'
  | 'economia'
  | 'analitica'
  | 'contactos'
  | 'auditoria';

const NAV: ReadonlyArray<{ id: ConsoleSection; label: string; icon: string }> = [
  { id: 'mi-actividad', label: 'Mi actividad', icon: 'monitoring' },
  { id: 'mi-comercio', label: 'Mi establecimiento', icon: 'storefront' },
  { id: 'campanas', label: 'Campañas', icon: 'campaign' },
  { id: 'juegos', label: 'Juegos', icon: 'sports_esports' },
  { id: 'fiesta', label: 'Juegos de fiesta', icon: 'groups' },
  { id: 'recompensas', label: 'Recompensas', icon: 'redeem' },
  { id: 'eventos', label: 'Eventos', icon: 'celebration' },
  { id: 'smart-tags', label: 'Smart Tags', icon: 'qr_code_2' },
  { id: 'comercios', label: 'Comercios', icon: 'storefront' },
  { id: 'economia', label: 'Economía', icon: 'account_balance_wallet' },
  { id: 'analitica', label: 'Analítica', icon: 'query_stats' },
  { id: 'contactos', label: 'Contactos', icon: 'contacts' },
  { id: 'auditoria', label: 'Auditoría', icon: 'shield' },
];

export interface ConsoleLayoutProps {
  active: ConsoleSection;
  userAlias: string;
  roleLabel: string;
  onNavigate: (section: ConsoleSection) => void;
  onLogout: () => void;
  /** Secciones disponibles para esta persona (según su rol y lo construido); el resto aparece como "Próximamente". */
  sections?: ConsoleSection[];
  /** Secciones que existen pero no corresponden al rol de esta persona: se muestran como "Sin acceso". */
  restricted?: ConsoleSection[];
  /** Si se indica, solo se muestran estas secciones (Staff y Comercio ven únicamente lo suyo). */
  only?: ConsoleSection[];
  /** Migas de pan: último elemento = página actual. */
  breadcrumbs?: Array<{ label: string; onSelect?: () => void }>;
  children: ReactNode;
}

/**
 * Marco de la consola (escritorio). Diseño: Stitch "16/17 · Consola". Tema claro con barra lateral verde
 * bosque; las secciones de pasos posteriores aparecen deshabilitadas con la etiqueta "Próximamente".
 */
export function ConsoleLayout({
  active,
  userAlias,
  roleLabel,
  onNavigate,
  onLogout,
  sections = ['campanas'],
  restricted = [],
  only,
  breadcrumbs = [],
  children,
}: ConsoleLayoutProps) {
  return (
    <div className="min-h-dvh flex bg-surface text-on-surface">
      <aside className="w-64 shrink-0 bg-inverse-surface text-inverse-on-surface flex flex-col">
        <div className="flex items-center gap-3 px-5 h-20 border-b border-white/10">
          <SealMark size="lg" className="w-10 h-10 shrink-0" />
          <div>
            <p className="font-headline-md text-[20px] leading-6 text-inverse-on-surface">Consola</p>
            <p className="font-label-sm text-[10px] uppercase tracking-widest text-inverse-primary">Gobernanza y CMS</p>
          </div>
        </div>
        <nav aria-label="Secciones" className="flex-1 py-4">
          <ul className="space-y-1 px-3">
            {NAV.filter((item) => (only ? only.includes(item.id) : item.id !== 'mi-actividad' && item.id !== 'mi-comercio')).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={!sections.includes(item.id)}
                  aria-current={active === item.id ? 'page' : undefined}
                  onClick={() => onNavigate(item.id)}
                  className={cx(
                    'w-full min-h-11 flex items-center gap-3 px-3 rounded-lg text-left font-label-lg text-[14px] transition-colors',
                    active === item.id
                      ? 'bg-inverse-primary text-inverse-surface'
                      : 'text-inverse-on-surface/85 hover:bg-white/5 disabled:hover:bg-transparent',
                    !sections.includes(item.id) && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  <Icon name={item.icon} className="text-[20px]" />
                  <span className="flex-1">{item.label}</span>
                  {!sections.includes(item.id) && (
                    <span className="font-label-sm text-[9px] uppercase tracking-wide">{restricted.includes(item.id) ? 'Sin acceso' : 'Próximamente'}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="px-5 py-4 border-t border-white/10 flex items-center gap-3">
          <span aria-hidden="true" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center font-label-lg text-[13px]">
            {userAlias.slice(0, 2).toUpperCase()}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-label-lg text-[14px] truncate">{userAlias}</p>
            <p className="font-body-md text-[12px] text-inverse-on-surface/85 truncate">{roleLabel}</p>
          </div>
          <button
            type="button"
            aria-label="Cerrar sesión"
            onClick={onLogout}
            className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-white/10"
          >
            <Icon name="logout" className="text-[20px]" />
          </button>
        </div>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 px-8 flex items-center justify-between border-b border-outline-variant bg-surface-container-low">
          <nav aria-label="Migas de pan">
            <ol className="flex items-center gap-2 font-body-md text-[13px] text-on-surface-variant">
              {breadcrumbs.map((b, i) => (
                <li key={b.label} className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden="true">/</span>}
                  {b.onSelect && i < breadcrumbs.length - 1 ? (
                    <button type="button" onClick={b.onSelect} className="hover:text-primary underline-offset-4 hover:underline">
                      {b.label}
                    </button>
                  ) : (
                    <span aria-current={i === breadcrumbs.length - 1 ? 'page' : undefined} className="text-on-surface">
                      {b.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          <p className="font-label-sm text-[11px] text-on-surface-variant">Ley 30 de 1986 · Habeas Data (Ley 1581 de 2012)</p>
        </header>
        <main className="flex-1 px-8 py-6 max-w-[1280px] w-full">{children}</main>
      </div>
    </div>
  );
}
