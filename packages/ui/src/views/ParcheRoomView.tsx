import { Button } from '../components/Button.tsx';
import { EnergyMeter } from '../components/EnergyMeter.tsx';
import { Icon } from '../components/Icon.tsx';
import { InviteCard } from '../components/InviteCard.tsx';
import { LegalNotice } from '../components/LegalNotice.tsx';
import { type Participant, ParticipantList } from '../components/ParticipantList.tsx';
import { ScoreCard } from '../components/ScoreCard.tsx';
import { OfflineBanner } from '../components/StatusMessage.tsx';
import { cx } from '../lib/cx.ts';

export type ConnectionState = 'live' | 'reconnecting' | 'offline';

export interface GameEntry {
  id: string;
  title: string;
  subtitle: string;
  route: 'A' | 'B';
  icon: string;
}

/**
 * Vista pura: sala en vivo de El Parche.
 * Diseño: Stitch "05 · Sala del Parche" (design/stitch-exports/05-sala-parche).
 * Fuentes: Instrucciones §3.2, §5 paso 5, §6.2-B; Guía Técnica §5.5, §5.7, §8; Guía Gamificación §9.1.
 *
 * Reglas visibles:
 * - Marcador del reto (XP) y Puntos ILC de la mesa SEPARADOS; nunca una cifra combinada.
 * - Relojes distintos: energía de la sesión ≠ vigencia del saldo.
 * - Solo alias; sin rankings personales ni métricas de consumo; sin incentivos a abrir otra botella.
 */
export interface ParcheRoomViewProps {
  name: string;
  connection: ConnectionState;
  pin: string;
  isHost: boolean;
  energy: { remainingSeconds: number; totalSeconds: number };
  challenge: { xp: number; completed: number };
  /** Ausente si la sesión nació en Ruta B sin activación comercial. */
  commercial?: { points: number; activatedCodes: number };
  /** Nombre de la moneda comercial desde el CMS (Instrucciones §6, por defecto "Puntos ILC"). */
  currencyName?: string;
  /** Multiplicador vigente de la campaña, ej. "x1,5 · Feria de Manizales". */
  multiplierLabel?: string;
  participants: Participant[];
  selfId?: string;
  games: GameEntry[];
  /** Texto de cierre de sesión calculado por el servidor, ej. "6:00 a. m.". */
  sessionEndsAt: string;
  canActivateCode: boolean;
  onShowQr: () => void;
  onShare?: () => void;
  onPlayGame: (gameId: string) => void;
  onChooseGame: () => void;
  onActivateCode: () => void;
  onOpenMenu: () => void;
}

const CONNECTION: Record<ConnectionState, { label: string; dot: string; text: string }> = {
  live: { label: 'En vivo', dot: 'bg-secondary', text: 'text-secondary' },
  reconnecting: { label: 'Reconectando', dot: 'bg-warning animate-pulse', text: 'text-warning' },
  offline: { label: 'Sin conexión', dot: 'bg-outline', text: 'text-on-surface-variant' },
};

export function ParcheRoomView({
  name,
  connection,
  pin,
  isHost,
  energy,
  challenge,
  commercial,
  currencyName = 'Puntos ILC',
  multiplierLabel,
  participants,
  selfId,
  games,
  sessionEndsAt,
  canActivateCode,
  onShowQr,
  onShare,
  onPlayGame,
  onChooseGame,
  onActivateCode,
  onOpenMenu,
}: ParcheRoomViewProps) {
  const c = CONNECTION[connection];
  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <div className="w-full max-w-md mx-auto flex flex-col min-h-dvh bg-surface-container-lowest">
        <header className="sticky top-0 z-40 bg-surface-container-low/95 backdrop-blur-md border-b border-outline-variant">
          {connection === 'offline' && <OfflineBanner />}
          <div className="h-14 px-3 flex items-center gap-2">
            <span className={cx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-outline-variant font-label-sm text-[11px] uppercase', c.text)}>
              <span aria-hidden="true" className={cx('w-2 h-2 rounded-full', c.dot)} />
              {c.label}
            </span>
            <h1 className="flex-1 min-w-0 truncate font-headline-md text-[20px] text-on-surface">{name}</h1>
            <button type="button" aria-label="Opciones del Parche" onClick={onOpenMenu} className="w-12 h-12 -mr-1 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container">
              <Icon name="more_vert" className="text-[22px]" />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 pt-3 pb-6 space-y-4">
          {isHost && <InviteCard pin={pin} onShowQr={onShowQr} onShare={onShare} />}

          <section aria-label="Energía del Parche" className="flex flex-col items-center gap-1 py-4 rounded-2xl bg-surface-container-low border border-outline-variant">
            <EnergyMeter remainingSeconds={energy.remainingSeconds} totalSeconds={energy.totalSeconds} />
            <p className="flex items-center gap-1 font-label-lg text-[14px] text-primary">
              <Icon name="bolt" filled className="text-[18px]" />
              Energía del Parche
            </p>
            <p className="font-body-md text-[13px] text-on-surface-variant">La duración la define la campaña</p>
          </section>

          <div className="flex gap-3">
            <ScoreCard kind="challenge" title="Marcador del reto" value={challenge.xp} unit="XP" detail={`${challenge.completed} retos completados`} />
            {commercial && (
              <ScoreCard
                kind="commercial"
                title={`${currencyName} de la mesa`}
                value={commercial.points}
                unit={currencyName}
                detail={`${commercial.activatedCodes} ${commercial.activatedCodes === 1 ? 'código activado' : 'códigos activados'}`}
              />
            )}
          </div>

          {multiplierLabel && commercial && (
            <p className="flex items-start gap-2 p-3 rounded-xl border border-tertiary/40 bg-surface-container-low">
              <Icon name="bolt" className="text-[20px] text-tertiary" />
              <span>
                <span className="block font-label-sm text-label-sm uppercase text-tertiary">Multiplicador activo · {multiplierLabel}</span>
                <span className="font-body-md text-[13px] text-on-surface-variant">Aplica a {currencyName} según condiciones de campaña.</span>
              </span>
            </p>
          )}

          <ParticipantList participants={participants} selfId={selfId} />

          <section aria-labelledby="juega-ahora" className="space-y-2">
            <h3 id="juega-ahora" className="font-title-md text-title-md text-on-surface">
              Juega ahora
            </h3>
            <ul className="space-y-2">
              {games.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => onPlayGame(g.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl bg-surface-container border border-outline-variant text-left hover:border-primary/50 active:scale-[0.99] transition-all"
                  >
                    <span className={cx('w-11 h-11 shrink-0 rounded-xl flex items-center justify-center border', g.route === 'A' ? 'border-primary/40 text-primary' : 'border-secondary/40 text-secondary')}>
                      <Icon name={g.icon} className="text-[24px]" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="font-title-md text-[16px] text-on-surface truncate">{g.title}</span>
                        <span className={cx('shrink-0 px-1.5 rounded-md font-label-sm text-[10px] uppercase border', g.route === 'A' ? 'border-primary/40 text-primary' : 'border-secondary/40 text-secondary')}>
                          Ruta {g.route}
                        </span>
                      </span>
                      <span className="block font-body-md text-[13px] text-on-surface-variant truncate">{g.subtitle}</span>
                    </span>
                    <Icon name="chevron_right" className="text-[22px] text-on-surface-variant" />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <p className="flex items-start gap-2 font-body-md text-[13px] text-on-surface-variant">
            <Icon name="schedule" className="text-[18px]" />
            La sesión termina a las {sessionEndsAt} o al cerrar el Parche. Tu saldo individual se conserva.
          </p>
        </main>

        <LegalNotice />

        <div className="sticky bottom-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2">
          <Button leadingIcon="casino" onClick={onChooseGame} disabled={connection === 'offline'}>
            Elegir juego
          </Button>
          {canActivateCode && (
            <Button variant="secondary" leadingIcon="qr_code_scanner" onClick={onActivateCode} className="h-12">
              Activar otro código
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
