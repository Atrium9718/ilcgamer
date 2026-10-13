import { BottomNav, type NavTab } from '../components/BottomNav.tsx';
import { ExperienceCard, GameTile } from '../components/GameTile.tsx';
import { Icon } from '../components/Icon.tsx';
import { TopBar } from '../components/TopBar.tsx';

export interface QuickGame {
  id: string;
  title: string;
  icon: string;
  minutes: number;
  players: string;
}

export interface Experience {
  id: string;
  title: string;
  subtitle: string;
  imageUrl?: string;
  progress?: { current: number; total: number };
  tag?: string;
}

/**
 * Vista pura: catálogo de juegos (pestaña Jugar).
 * Diseño: Stitch "06 · Catálogo de juegos". Fuentes: Instrucciones §13; Guía Técnica §5.4.
 * Regla: como máximo 2 experiencias de Ruta B visibles por usuario y contexto de campaña.
 * El servidor ya entrega la lista segmentada; la vista además corta en 2 como salvaguarda.
 */
export const MAX_ROUTE_B_EXPERIENCES = 2;

export interface GamesCatalogViewProps {
  campaignLabel?: string;
  quickGames: QuickGame[];
  experiences: Experience[];
  onSelectGame: (id: string) => void;
  onSelectExperience: (id: string) => void;
  /** Entrada a «Eventos y concursos» (p. ej. el concurso de disfraces de la feria). */
  onOpenEvents?: () => void;
  activeTab?: NavTab;
  onNavigate: (tab: NavTab) => void;
}

export function GamesCatalogView({
  campaignLabel,
  quickGames,
  experiences,
  onSelectGame,
  onSelectExperience,
  onOpenEvents,
  activeTab = 'jugar',
  onNavigate,
}: GamesCatalogViewProps) {
  const visible = experiences.slice(0, MAX_ROUTE_B_EXPERIENCES);
  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <div className="w-full max-w-md mx-auto flex flex-col min-h-dvh bg-surface-container-lowest">
        <TopBar
          title={<span className="font-headline-md text-headline-md text-primary">Jugar</span>}
          trailing={
            campaignLabel && (
              <span className="px-2.5 py-0.5 rounded-full border border-tertiary/40 font-label-sm text-[11px] text-tertiary whitespace-nowrap">
                Campaña: {campaignLabel}
              </span>
            )
          }
        />
        <main className="flex-1 px-4 pt-4 pb-6 space-y-7">
          <section aria-labelledby="ruta-a" className="space-y-3">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h2 id="ruta-a" className="flex items-center gap-2 font-title-md text-title-md text-primary">
                  <span aria-hidden="true" className="w-2 h-2 rounded-full bg-primary" />
                  Ruta A · Juegos rápidos
                </h2>
                <span className="px-2 py-0.5 rounded-full border border-primary/40 font-label-sm text-[11px] text-primary whitespace-nowrap">
                  +Marcador del Parche
                </span>
              </div>
              <p className="font-body-md text-[13px] text-on-surface-variant">Partidas cortas para tu Parche</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {quickGames.map((g) => (
                <GameTile key={g.id} title={g.title} icon={g.icon} minutes={g.minutes} players={g.players} onSelect={() => onSelectGame(g.id)} />
              ))}
            </div>
          </section>

          {visible.length > 0 && (
            <section aria-labelledby="ruta-b" className="space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h2 id="ruta-b" className="flex items-center gap-2 font-title-md text-title-md text-secondary">
                    <span aria-hidden="true" className="w-2 h-2 rounded-full bg-secondary" />
                    Ruta B · Experiencias
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-secondary-container font-label-sm text-[11px] text-on-secondary-container whitespace-nowrap">
                    +XP e insignias
                  </span>
                </div>
                <p className="font-body-md text-[13px] text-on-surface-variant">
                  Tienes {visible.length} {visible.length === 1 ? 'experiencia disponible' : 'experiencias disponibles'} en esta campaña
                </p>
              </div>
              <div className="space-y-3">
                {visible.map((e) => (
                  <ExperienceCard
                    key={e.id}
                    title={e.title}
                    subtitle={e.subtitle}
                    imageUrl={e.imageUrl}
                    progress={e.progress}
                    tag={e.tag}
                    ctaLabel={e.progress ? 'Continuar' : 'Empezar'}
                    onSelect={() => onSelectExperience(e.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {onOpenEvents && (
            <button
              type="button"
              onClick={onOpenEvents}
              className="w-full min-h-14 rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 flex items-center gap-3 text-left active:scale-[0.99]"
            >
              <Icon name="celebration" className="text-[28px] text-primary" />
              <span className="flex-1">
                <span className="block font-label-lg text-label-lg text-on-surface">Eventos y concursos</span>
                <span className="block font-body-md text-[13px] text-on-surface-variant">Disfraces, votaciones y premios de la feria</span>
              </span>
              <Icon name="chevron_right" className="text-[24px] text-on-surface-variant" />
            </button>
          )}

          <p className="flex items-start gap-2 font-body-md text-[13px] text-on-surface-variant">
            <Icon name="lock" className="text-[18px]" />
            Otras experiencias se habilitan según tu campaña y ubicación.
          </p>
        </main>
        <BottomNav active={activeTab} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
