import { cx } from '../lib/cx.ts';

export type ParticipantStatus = 'connected' | 'reconnecting' | 'left';

export interface Participant {
  id: string;
  /** Solo alias. Nunca nombre legal, teléfono ni correo en pantallas compartidas (Guía Técnica §5.5). */
  alias: string;
  isHost?: boolean;
  status: ParticipantStatus;
}

export interface ParticipantListProps {
  participants: Participant[];
  /** Id del participante que ve la pantalla, para marcar "(tú)". */
  selfId?: string;
}

function initials(alias: string): string {
  return alias
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

const STATUS_COPY: Record<ParticipantStatus, string> = {
  connected: 'En línea',
  reconnecting: 'Reconectando…',
  left: 'Salió del Parche',
};

/** Lista de integrantes. Sin rankings por persona ni métricas individuales de consumo. */
export function ParticipantList({ participants, selfId }: ParticipantListProps) {
  const active = participants.filter((p) => p.status !== 'left');
  return (
    <section aria-labelledby="parche-integrantes">
      <div className="flex items-baseline justify-between mb-2">
        <h3 id="parche-integrantes" className="font-title-md text-title-md text-on-surface">
          En el Parche <span className="text-on-surface-variant tabular-nums">({active.length})</span>
        </h3>
        <span className="font-label-sm text-[12px] text-on-surface-variant">Solo se muestran alias</span>
      </div>
      <ul className="grid grid-cols-2 gap-2">
        {participants.map((p) => (
          <li
            key={p.id}
            className={cx(
              'flex items-center gap-2.5 px-3 py-2.5 min-h-14 rounded-xl border bg-surface-container-low',
              p.isHost ? 'border-primary/40' : 'border-outline-variant',
              p.status === 'left' && 'opacity-60',
            )}
          >
            <span
              aria-hidden="true"
              className={cx(
                'relative w-9 h-9 shrink-0 rounded-full flex items-center justify-center font-label-lg text-[13px] border-2',
                p.isHost ? 'border-primary text-primary bg-surface-container-high' : 'border-outline-variant text-on-surface bg-surface-container',
              )}
            >
              {initials(p.alias)}
              <span
                className={cx(
                  'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface-container-low',
                  p.status === 'connected' ? 'bg-secondary' : p.status === 'reconnecting' ? 'bg-warning animate-pulse' : 'bg-outline',
                )}
              />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-label-lg text-[14px] text-on-surface truncate">
                {p.alias}
                {p.id === selfId && <span className="text-on-surface-variant font-body-md"> (tú)</span>}
              </p>
              <p className={cx('font-label-sm text-[11px] uppercase', p.isHost ? 'text-primary' : p.status === 'reconnecting' ? 'text-warning' : 'text-on-surface-variant')}>
                {p.isHost && p.status === 'connected' ? 'Anfitrión' : STATUS_COPY[p.status]}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
