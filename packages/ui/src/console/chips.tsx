import { Icon } from '../components/Icon.tsx';
import { cx } from '../lib/cx.ts';

export type CampaignStatusView = 'BORRADOR' | 'EN_REVISION' | 'APROBADA' | 'PROGRAMADA' | 'ACTIVA' | 'PAUSADA' | 'CERRADA' | 'ARCHIVADA';
export type RouteView = 'A_COMERCIAL' | 'B_EXPERIENCIAL' | 'MIXTA';
export type ApprovalState = 'approved' | 'rejected' | 'pending' | 'not_required';

export const STATUS_LABEL: Record<CampaignStatusView, string> = {
  BORRADOR: 'Borrador',
  EN_REVISION: 'En revisión',
  APROBADA: 'Aprobada',
  PROGRAMADA: 'Programada',
  ACTIVA: 'Activa',
  PAUSADA: 'Pausada',
  CERRADA: 'Cerrada',
  ARCHIVADA: 'Archivada',
};

const STATUS_STYLE: Record<CampaignStatusView, string> = {
  BORRADOR: 'border-outline text-on-surface-variant',
  EN_REVISION: 'border-warning text-warning',
  APROBADA: 'border-secondary text-secondary',
  PROGRAMADA: 'border-tertiary text-tertiary',
  ACTIVA: 'bg-secondary text-on-secondary border-secondary',
  PAUSADA: 'border-warning text-warning bg-surface-container-high',
  CERRADA: 'border-outline text-on-surface-variant bg-surface-container-high',
  ARCHIVADA: 'border-outline-variant text-on-surface-variant',
};

export function StatusChip({ status }: { status: CampaignStatusView }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border font-label-sm text-[11px] uppercase whitespace-nowrap',
        STATUS_STYLE[status],
      )}
    >
      {status === 'ACTIVA' && <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-on-secondary" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

const ROUTE: Record<RouteView, { label: string; className: string }> = {
  A_COMERCIAL: { label: 'Ruta A · Comercial', className: 'border-primary/50 text-primary' },
  B_EXPERIENCIAL: { label: 'Ruta B · Experiencial', className: 'border-secondary/50 text-secondary' },
  MIXTA: { label: 'Mixta (A + B)', className: 'border-tertiary/50 text-tertiary' },
};

export function RouteChip({ route }: { route: RouteView }) {
  const r = ROUTE[route];
  return <span className={cx('inline-flex px-2.5 py-0.5 rounded-full border font-label-sm text-[11px] whitespace-nowrap', r.className)}>{r.label}</span>;
}

const KIND_LABEL: Record<string, string> = { MARCA: 'Marca', JURIDICA: 'Jurídica', PRIVACIDAD: 'Privacidad', TI: 'TI' };
const APPROVAL: Record<ApprovalState, { icon: string; className: string; label: string }> = {
  approved: { icon: 'check_circle', className: 'text-secondary', label: 'aprobada' },
  rejected: { icon: 'cancel', className: 'text-error', label: 'rechazada' },
  pending: { icon: 'schedule', className: 'text-warning', label: 'pendiente' },
  not_required: { icon: 'remove', className: 'text-on-surface-variant', label: 'no aplica' },
};

/** Marca · Jurídica · Privacidad en una fila, con texto accesible (no solo color). */
export function ApprovalDots({ approvals }: { approvals: Array<{ kind: string; status: ApprovalState }> }) {
  return (
    <ul className="flex items-center gap-1" aria-label="Aprobaciones">
      {approvals.map((a) => {
        const s = APPROVAL[a.status];
        return (
          <li key={a.kind} title={`${KIND_LABEL[a.kind]}: ${s.label}`}>
            <Icon name={s.icon} filled={a.status !== 'not_required'} className={cx('text-[20px]', s.className)} />
            <span className="sr-only">{`${KIND_LABEL[a.kind]}: ${s.label}`}</span>
          </li>
        );
      })}
    </ul>
  );
}

export { KIND_LABEL };
