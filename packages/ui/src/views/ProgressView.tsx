import { BadgeSeal } from '../components/BadgeSeal.tsx';
import { BottomNav, type NavTab } from '../components/BottomNav.tsx';
import { type Chapter, ChapterTimeline } from '../components/ChapterTimeline.tsx';
import { Icon } from '../components/Icon.tsx';
import { ProgressBar } from '../components/ProgressBar.tsx';
import { TopBar } from '../components/TopBar.tsx';
import { formatNumber } from '../lib/format.ts';

export interface BadgeView {
  id: string;
  name: string;
  icon: string;
  earned: boolean;
}

export interface StoryView {
  id: string;
  title?: string;
  unlocked: boolean;
}

/**
 * Vista pura: progreso de Ruta B (XP, insignias, coleccionables).
 * Diseño: Stitch "09 · Mi progreso". Fuentes: Guía Técnica §5.7 (XP ≠ Puntos ILC), §7 GET /profile/progress;
 * Guía Gamificación §9.2-9.3.
 */
export interface ProgressViewProps {
  level: number;
  levelName: string;
  xp: number;
  nextLevelXp: number;
  nextLevelName: string;
  chapters: Chapter[];
  badges: BadgeView[];
  stories: StoryView[];
  onOpenStory: (id: string) => void;
  onBack?: () => void;
  onNavigate: (tab: NavTab) => void;
}

export function ProgressView({
  level,
  levelName,
  xp,
  nextLevelXp,
  nextLevelName,
  chapters,
  badges,
  stories,
  onOpenStory,
  onBack,
  onNavigate,
}: ProgressViewProps) {
  const unlocked = stories.filter((s) => s.unlocked);
  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <div className="w-full max-w-md mx-auto flex flex-col min-h-dvh bg-surface-container-lowest">
        <TopBar
          onBack={onBack}
          title={<span className="font-headline-md text-headline-md text-primary">Mi progreso</span>}
          trailing={
            <span className="px-2.5 py-0.5 rounded-full bg-secondary-container font-label-sm text-[11px] uppercase text-on-secondary-container">Ruta B</span>
          }
        />
        <main className="flex-1 px-4 pt-4 pb-6 space-y-6">
          <section aria-label="Nivel" className="p-4 rounded-2xl border border-secondary/40 bg-surface-container-low space-y-2">
            <p className="font-label-sm text-label-sm uppercase text-secondary">Nivel {level}</p>
            <h2 className="font-headline-md text-headline-md text-on-surface">{levelName}</h2>
            <p className="font-numeric-xl text-[32px] leading-none text-on-surface tabular-nums">
              {formatNumber(xp)} <span className="font-label-lg text-[14px] text-secondary">XP</span>
            </p>
            <ProgressBar
              tone="secondary"
              value={xp}
              max={nextLevelXp}
              label="Progreso al siguiente nivel"
              valueText={`${formatNumber(xp)} de ${formatNumber(nextLevelXp)} XP`}
            />
            <p className="font-body-md text-[13px] text-on-surface-variant tabular-nums">
              Siguiente: {nextLevelName} · {formatNumber(nextLevelXp)} XP
            </p>
            <p className="flex items-start gap-1.5 font-body-md text-[12px] text-on-surface-variant">
              <Icon name="info" className="text-[16px]" />
              La XP reconoce lo que descubres; no se convierte en Puntos ILC.
            </p>
          </section>

          <section aria-labelledby="ruta-origen" className="space-y-3">
            <h2 id="ruta-origen" className="font-title-md text-title-md text-on-surface">
              Ruta del Origen
            </h2>
            <ChapterTimeline chapters={chapters} />
          </section>

          <section aria-labelledby="insignias" className="space-y-3">
            <h2 id="insignias" className="font-title-md text-title-md text-on-surface">
              Insignias{' '}
              <span className="text-on-surface-variant tabular-nums">
                ({badges.filter((b) => b.earned).length}/{badges.length})
              </span>
            </h2>
            <div className="grid grid-cols-3 gap-y-5 gap-x-2">
              {badges.map((b) => (
                <BadgeSeal key={b.id} name={b.name} icon={b.icon} earned={b.earned} />
              ))}
            </div>
          </section>

          <section aria-labelledby="archivo" className="space-y-3">
            <h2 id="archivo" className="font-title-md text-title-md text-on-surface">
              Archivo de los secretos{' '}
              <span className="text-on-surface-variant tabular-nums">
                ({unlocked.length}/{stories.length})
              </span>
            </h2>
            <ul className="space-y-2">
              {unlocked.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onOpenStory(s.id)}
                    className="w-full min-h-14 flex items-center gap-3 px-3.5 rounded-xl border border-tertiary/35 bg-surface-container-low text-left hover:border-tertiary/70"
                  >
                    <Icon name="auto_stories" className="text-[22px] text-tertiary" />
                    <span className="flex-1 font-headline-md italic text-[16px] text-on-surface">{s.title ?? 'Relato pendiente de aprobación de marca'}</span>
                    <Icon name="chevron_right" className="text-[20px] text-on-surface-variant" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </main>
        <BottomNav active="perfil" onNavigate={onNavigate} />
      </div>
    </div>
  );
}
