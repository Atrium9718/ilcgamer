import { Button } from '../components/Button.tsx';
import { Icon } from '../components/Icon.tsx';
import { LegalNotice } from '../components/LegalNotice.tsx';
import { ScoreCard } from '../components/ScoreCard.tsx';
import { StatusMessage } from '../components/StatusMessage.tsx';
import { TopBar } from '../components/TopBar.tsx';

/**
 * Vista pura: resultado de una partida.
 * Diseño: Stitch "07 · Resultado de juego". Fuentes: Guía Técnica §5.4 (resultado verificado por
 * servidor), §12.2 (no afirmar lo no confirmado); Guía Gamificación §7.2 (cierre sin invitar a consumir).
 */
export type ResultState = { status: 'verifying' } | { status: 'error' } | { status: 'verified'; result: VerifiedResult };

export interface VerifiedResult {
  headline: string;
  summary: string;
  xpEarned: number;
  badgeName?: string;
  /** Puntos ILC emitidos por esta partida (0 si la campaña no los otorga). */
  pointsEarned: number;
  pointsNote?: string;
  /** Dato editorial aprobado; si falta se muestra el marcador. */
  fact?: string;
}

export interface GameResultViewProps {
  gameTitle: string;
  state: ResultState;
  currencyName?: string;
  onClose: () => void;
  onBackToParche: () => void;
  onShare: () => void;
  onPlayAgain: () => void;
  onRetry: () => void;
}

export function GameResultView({ gameTitle, state, currencyName = 'Puntos ILC', onClose, onBackToParche, onShare, onPlayAgain, onRetry }: GameResultViewProps) {
  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <div className="w-full max-w-md mx-auto flex flex-col min-h-dvh bg-surface-container-lowest">
        <TopBar
          title={gameTitle}
          trailing={
            <button type="button" aria-label="Cerrar" onClick={onClose} className="w-12 h-12 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container">
              <Icon name="close" className="text-[22px]" />
            </button>
          }
        />
        <main className="flex-1 px-4 pt-6 pb-6">
          {state.status === 'verifying' && <StatusMessage kind="pending" title="Verificando tu resultado…" />}
          {state.status === 'error' && (
            <StatusMessage
              kind="error"
              title="No pudimos confirmar el resultado"
              body="Tu partida quedó guardada. Reintenta: no se duplicará ninguna recompensa."
              action={<Button onClick={onRetry}>Reintentar</Button>}
            />
          )}
          {state.status === 'verified' && (
            <div className="space-y-5">
              <div className="flex flex-col items-center text-center gap-3">
                <span className="w-28 h-28 rounded-full p-1.5 border border-primary/50 shadow-[0_0_28px_color-mix(in_srgb,var(--color-primary)_18%,transparent)]">
                  <span className="w-full h-full rounded-full border-2 border-primary-container bg-gradient-to-b from-surface-container-high to-surface-container-low flex items-center justify-center text-primary">
                    <Icon name="explore" filled className="text-[48px]" />
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-secondary/40 font-label-sm text-[11px] uppercase text-secondary">
                  <Icon name="verified" filled className="text-[14px]" />
                  Resultado verificado
                </span>
                <h1 className="font-headline-lg text-headline-lg text-on-surface">{state.result.headline}</h1>
                <p className="font-body-lg text-body-lg text-on-surface-variant">{state.result.summary}</p>
              </div>
              <div className="flex gap-3">
                <ScoreCard kind="challenge" title="Marcador del reto" value={state.result.xpEarned} unit="XP" detail={state.result.badgeName ? `Insignia: ${state.result.badgeName}` : undefined} />
                <ScoreCard kind="commercial" title={currencyName} value={state.result.pointsEarned} unit={currencyName} detail={state.result.pointsNote} />
              </div>
              <section className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant">
                <h2 className="flex items-center gap-1.5 font-label-sm text-label-sm uppercase text-tertiary">
                  <Icon name="auto_stories" className="text-[16px]" />
                  Dato que descubriste
                </h2>
                <p className="mt-1.5 font-headline-md italic text-[17px] leading-relaxed text-on-surface">
                  {state.result.fact ?? 'Contenido editorial pendiente de aprobación de marca.'}
                </p>
              </section>
            </div>
          )}
        </main>
        {state.status === 'verified' && (
          <div className="sticky bottom-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2">
            <Button onClick={onBackToParche}>Volver al Parche</Button>
            <Button variant="secondary" leadingIcon="share" onClick={onShare} className="h-12">
              Compartir logro
            </Button>
            <Button variant="text" onClick={onPlayAgain}>
              Jugar otra partida
            </Button>
          </div>
        )}
        <LegalNotice />
      </div>
    </div>
  );
}
