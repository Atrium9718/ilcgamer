import { useState } from 'react';
import { Button } from '../components/Button.tsx';
import { Checkbox } from '../components/Checkbox.tsx';
import { Icon } from '../components/Icon.tsx';
import { cx } from '../lib/cx.ts';
import { formatNumber } from '../lib/format.ts';
import { type ApprovalState, type CampaignStatusView, KIND_LABEL, RouteChip, type RouteView, StatusChip } from './chips.tsx';

export type DetailTab = 'resumen' | 'reglas' | 'tema' | 'historial';
export type LifecycleAction = 'pause' | 'resume' | 'close' | 'archive';

export interface ApprovalRow {
  kind: string;
  required: boolean;
  status: ApprovalState;
  byAlias: string | null;
  atLabel: string | null;
  note: string | null;
}

export interface RulesView {
  pointsBySku: Array<{ sku: string; points: number }>;
  multipliers: Array<{ label: string; factor: number; windowLabel: string }>;
  energyMinutes: number;
  sessionEndsAtLocalTime: string;
  pointsExpiryDays?: number;
  activationsPerUserPerDay: number;
  activationsPerUserTotal?: number;
}

export interface CampaignDetailData {
  slug: string;
  internalName: string;
  publicTitle: string;
  publicDescription: string;
  objective: string;
  kpi: string;
  ownerTeam: string;
  route: RouteView;
  status: CampaignStatusView;
  brandLabels: string[];
  channelLabels: string[];
  territories: string[];
  windowLabel: string;
  minAge: number;
  terms: string;
  activeVersion: number | null;
  working: { version: number; state: string; stateLabel: string };
  versions: Array<{ version: number; stateLabel: string; createdLabel: string }>;
  rules: RulesView;
  theme: { mode: 'dark' | 'light'; brand: string; accent?: string; surface?: string };
  dataUsage: { location: boolean; extraData: boolean };
}

export interface CampaignPermissions {
  canEdit: boolean;
  canSubmit: boolean;
  canNewVersion: boolean;
  canPublish: boolean;
  /** Tipos de aprobación que la persona puede emitir sobre esta versión (ya filtrados por separación de funciones). */
  decideKinds: string[];
  transitions: LifecycleAction[];
}

/**
 * Vista pura: detalle de campaña con aprobaciones, checklist §16 y acciones.
 * Diseño: Stitch "17 · Consola · Detalle de campaña". Fuentes: Guía Técnica §5.3, §5.7, §5.11, §16.
 * La publicación permanece deshabilitada mientras falte una aprobación o un punto del checklist, y la vista
 * indica exactamente qué falta.
 */
export interface CampaignDetailViewProps {
  data: CampaignDetailData;
  approvals: ApprovalRow[];
  missingApprovals: string[];
  checklist: Array<{ key: string; label: string }>;
  checked: Record<string, boolean>;
  onToggleChecklist: (key: string, value: boolean) => void;
  permissions: CampaignPermissions;
  tab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  busy?: string;
  error?: string;
  onEdit: () => void;
  onSubmit: () => void;
  onNewVersion: () => void;
  onPublish: () => void;
  onDecide: (kind: string, decision: 'APROBADO' | 'RECHAZADO', note: string) => void;
  onTransition: (action: LifecycleAction) => void;
}

const TABS: ReadonlyArray<{ id: DetailTab; label: string; icon: string }> = [
  { id: 'resumen', label: 'Resumen', icon: 'description' },
  { id: 'reglas', label: 'Reglas', icon: 'rule' },
  { id: 'tema', label: 'Tema', icon: 'palette' },
  { id: 'historial', label: 'Historial', icon: 'history' },
];

const TRANSITION_LABEL: Record<LifecycleAction, { label: string; icon: string }> = {
  pause: { label: 'Pausar', icon: 'pause_circle' },
  resume: { label: 'Reanudar', icon: 'play_circle' },
  close: { label: 'Cerrar campaña', icon: 'event_busy' },
  archive: { label: 'Archivar', icon: 'inventory_2' },
};

export function CampaignDetailView(props: CampaignDetailViewProps) {
  const { data, approvals, checklist, checked, permissions, tab, busy } = props;
  const pendingChecklist = checklist.filter((c) => !checked[c.key]).length;
  const publishBlocked = props.missingApprovals.length > 0 || pendingChecklist > 0;
  const publishHint = props.missingApprovals.length
    ? `Falta: ${props.missingApprovals.join(', ')}`
    : pendingChecklist
      ? `Completa el checklist (faltan ${pendingChecklist})`
      : 'Todo listo para publicar';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-2">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{data.internalName}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <RouteChip route={data.route} />
            {data.brandLabels.map((b) => (
              <span key={b} className="px-2.5 py-0.5 rounded-full border border-outline-variant font-label-sm text-[11px] text-on-surface">
                {b}
              </span>
            ))}
            <StatusChip status={data.status} />
            <span className="font-body-md text-[13px] text-on-surface-variant">
              Versión publicada: {data.activeVersion ? `v${data.activeVersion}` : 'ninguna'} · En trabajo: v{data.working.version} ({data.working.stateLabel})
            </span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {permissions.canEdit && (
            <Button variant="secondary" fullWidth={false} leadingIcon="edit" onClick={props.onEdit} className="h-11 px-4">
              Editar borrador
            </Button>
          )}
          {permissions.canSubmit && (
            <Button fullWidth={false} leadingIcon="send" loading={busy === 'submit'} onClick={props.onSubmit} className="h-11 px-4">
              Enviar a revisión
            </Button>
          )}
          {permissions.canNewVersion && (
            <Button
              variant="secondary"
              fullWidth={false}
              leadingIcon="note_add"
              loading={busy === 'version'}
              onClick={props.onNewVersion}
              className="h-11 px-4"
            >
              Crear nueva versión
            </Button>
          )}
        </div>
      </div>

      {props.error && (
        <p
          role="alert"
          className="flex items-start gap-2 p-3 rounded-xl border border-error/50 bg-error-container text-on-error-container font-body-md text-[14px]"
        >
          <Icon name="error" className="text-[20px]" />
          {props.error}
        </p>
      )}

      <div className="grid grid-cols-3 gap-6 items-start">
        <section className="col-span-2 rounded-2xl border border-outline-variant bg-surface-container-lowest">
          <div role="tablist" aria-label="Secciones de la campaña" className="flex gap-1 p-2 border-b border-outline-variant">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                onClick={() => props.onTabChange(t.id)}
                className={cx(
                  'flex items-center gap-1.5 min-h-10 px-4 rounded-lg font-label-lg text-[14px]',
                  tab === t.id ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant hover:bg-surface-container',
                )}
              >
                <Icon name={t.icon} className="text-[18px]" />
                {t.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="p-6">
            {tab === 'resumen' && <Summary data={data} />}
            {tab === 'reglas' && <Rules rules={data.rules} />}
            {tab === 'tema' && <Theme theme={data.theme} title={data.publicTitle} />}
            {tab === 'historial' && (
              <ol className="space-y-2">
                {data.versions.map((v) => (
                  <li key={v.version} className="flex items-center justify-between p-3 rounded-xl border border-outline-variant">
                    <span className="font-label-lg text-[14px]">Versión {v.version}</span>
                    <span className="font-body-md text-[13px] text-on-surface-variant">
                      {v.stateLabel} · creada {v.createdLabel}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <section aria-labelledby="aprobaciones" className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 space-y-3">
            <h2 id="aprobaciones" className="font-headline-md text-[20px] text-on-surface">
              Aprobaciones de la versión {data.working.version}
            </h2>
            <ul className="space-y-3">
              {approvals.map((a) => (
                <ApprovalItem
                  key={a.kind}
                  approval={a}
                  canDecide={permissions.decideKinds.includes(a.kind)}
                  busy={busy === `decide:${a.kind}`}
                  onDecide={props.onDecide}
                />
              ))}
            </ul>
            <p className="font-body-md text-[12px] text-on-surface-variant">Cualquier cambio crea una nueva versión y requiere nuevas aprobaciones.</p>
          </section>

          {permissions.canPublish && (
            <section aria-labelledby="checklist" className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 id="checklist" className="font-headline-md text-[20px] text-on-surface">
                  Checklist antes de publicar
                </h2>
                {pendingChecklist > 0 && (
                  <span className="px-2 py-0.5 rounded-full border border-warning font-label-sm text-[11px] text-warning tabular-nums">
                    Faltan {pendingChecklist}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {checklist.map((c) => (
                  <Checkbox
                    key={c.key}
                    checked={!!checked[c.key]}
                    onChange={(v) => props.onToggleChecklist(c.key, v)}
                    label={c.label}
                    className="items-start [&_span]:text-[14px] [&_span]:font-normal"
                  />
                ))}
              </div>
              <Button leadingIcon="publish" disabled={publishBlocked} loading={busy === 'publish'} onClick={props.onPublish}>
                Publicar versión {data.working.version}
              </Button>
              <p className={cx('font-body-md text-[13px]', publishBlocked ? 'text-warning' : 'text-secondary')}>{publishHint}</p>
            </section>
          )}

          {permissions.transitions.length > 0 && (
            <section aria-labelledby="operacion" className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 space-y-2">
              <h2 id="operacion" className="font-headline-md text-[20px] text-on-surface">
                Operación
              </h2>
              {permissions.transitions.map((t) => (
                <Button
                  key={t}
                  variant={t === 'close' ? 'danger' : 'secondary'}
                  leadingIcon={TRANSITION_LABEL[t].icon}
                  loading={busy === t}
                  onClick={() => props.onTransition(t)}
                  className="h-11"
                >
                  {TRANSITION_LABEL[t].label}
                </Button>
              ))}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function ApprovalItem({
  approval,
  canDecide,
  busy,
  onDecide,
}: {
  approval: ApprovalRow;
  canDecide: boolean;
  busy: boolean;
  onDecide: (kind: string, d: 'APROBADO' | 'RECHAZADO', note: string) => void;
}) {
  const [note, setNote] = useState('');
  const icon = { approved: 'check_circle', rejected: 'cancel', pending: 'schedule', not_required: 'remove_circle_outline' }[approval.status];
  const color = { approved: 'text-secondary', rejected: 'text-error', pending: 'text-warning', not_required: 'text-on-surface-variant' }[approval.status];
  const label = KIND_LABEL[approval.kind] ?? approval.kind;
  const detail =
    approval.status === 'not_required'
      ? 'No aplica (sin ubicación ni datos adicionales)'
      : approval.status === 'pending'
        ? 'Pendiente de revisión'
        : `${approval.status === 'approved' ? 'Aprobado' : 'Rechazado'} por ${approval.byAlias ?? '—'} · ${approval.atLabel ?? ''}`;
  return (
    <li className="p-3 rounded-xl border border-outline-variant space-y-2">
      <div className="flex items-start gap-2">
        <Icon name={icon} filled className={cx('text-[22px]', color)} />
        <div className="flex-1">
          <p className="font-label-lg text-[15px] text-on-surface">{label}</p>
          <p className="font-body-md text-[13px] text-on-surface-variant">{detail}</p>
          {approval.note && <p className="mt-1 font-body-md text-[13px] italic text-on-surface">“{approval.note}”</p>}
        </div>
      </div>
      {canDecide && approval.status === 'pending' && (
        <div className="space-y-2">
          <label className="block">
            <span className="font-label-lg text-[13px] text-on-surface">Observación ({label})</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="mt-1 w-full p-2 rounded-lg border border-outline-variant bg-surface-container-lowest font-body-md text-[14px] outline-none focus:border-primary"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button fullWidth leadingIcon="check" loading={busy} onClick={() => onDecide(approval.kind, 'APROBADO', note)} className="h-11">
              Aprobar
            </Button>
            <Button
              variant="danger"
              fullWidth
              leadingIcon="close"
              disabled={busy || note.trim().length < 3}
              onClick={() => onDecide(approval.kind, 'RECHAZADO', note)}
              className="h-11"
            >
              Rechazar
            </Button>
          </div>
          <p className="font-body-md text-[12px] text-on-surface-variant">Para rechazar, escribe el motivo.</p>
        </div>
      )}
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-label-sm text-label-sm uppercase text-on-surface-variant">{label}</dt>
      <dd className="mt-0.5 font-body-md text-body-md text-on-surface">{children}</dd>
    </div>
  );
}

function Summary({ data }: { data: CampaignDetailData }) {
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
      <Field label="Título público">{data.publicTitle}</Field>
      <Field label="Ventana">{data.windowLabel}</Field>
      <Field label="Objetivo">{data.objective}</Field>
      <Field label="KPI principal">{data.kpi}</Field>
      <Field label="Responsable">{data.ownerTeam}</Field>
      <Field label="Edad mínima">{data.minAge} años</Field>
      <Field label="Canales">{data.channelLabels.join(', ')}</Field>
      <Field label="Territorios">{data.territories.length ? data.territories.join(', ') : 'Sin restricción territorial'}</Field>
      <Field label="Uso de datos">
        {data.dataUsage.location || data.dataUsage.extraData
          ? [data.dataUsage.location && 'Ubicación aproximada', data.dataUsage.extraData && 'Datos adicionales'].filter(Boolean).join(' · ') +
            ' (requiere Privacidad)'
          : 'Sin ubicación ni datos adicionales'}
      </Field>
      <Field label="Descripción pública">{data.publicDescription || '—'}</Field>
      <div className="col-span-2">
        <Field label="Términos y condiciones">
          <span className="whitespace-pre-wrap">{data.terms || 'Pendientes'}</span>
        </Field>
      </div>
    </dl>
  );
}

function Rules({ rules }: { rules: RulesView }) {
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="font-title-md text-title-md text-on-surface">Puntos por referencia (SKU)</h3>
        {rules.pointsBySku.length ? (
          <table className="w-full text-left rounded-xl overflow-hidden border border-outline-variant">
            <thead className="bg-surface-container font-label-sm text-label-sm uppercase text-on-surface-variant">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Referencia
                </th>
                <th scope="col" className="px-3 py-2">
                  Puntos por activación válida
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {rules.pointsBySku.map((p) => (
                <tr key={p.sku}>
                  <td className="px-3 py-2 font-label-lg text-[14px]">{p.sku}</td>
                  <td className="px-3 py-2 font-label-lg text-[14px] text-primary tabular-nums">{formatNumber(p.points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="font-body-md text-[14px] text-on-surface-variant">Esta versión no otorga puntos comerciales.</p>
        )}
        <p className="flex items-start gap-1.5 font-body-md text-[13px] text-warning">
          <Icon name="info" className="text-[18px]" />
          Valores de prueba: requieren aprobación de Finanzas, Trade Marketing y Jurídica antes de producción (Guía Técnica §5.7).
        </p>
      </section>
      <section className="space-y-2">
        <h3 className="font-title-md text-title-md text-on-surface">Multiplicadores</h3>
        {rules.multipliers.length ? (
          <ul className="space-y-1">
            {rules.multipliers.map((m) => (
              <li key={m.label} className="font-body-md text-[14px]">
                <strong className="text-tertiary tabular-nums">x{m.factor.toLocaleString('es-CO')}</strong> · {m.label} · {m.windowLabel}
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-body-md text-[14px] text-on-surface-variant">Sin multiplicadores.</p>
        )}
      </section>
      <dl className="grid grid-cols-3 gap-4">
        <Field label="Energía del Parche">{rules.energyMinutes} min</Field>
        <Field label="Cierre de sesiones">{rules.sessionEndsAtLocalTime}</Field>
        <Field label="Vigencia de puntos">{rules.pointsExpiryDays ? `${rules.pointsExpiryDays} días` : 'Sin vencimiento definido'}</Field>
        <Field label="Activaciones por persona al día">{rules.activationsPerUserPerDay}</Field>
        <Field label="Activaciones por persona en total">{rules.activationsPerUserTotal ?? 'Sin tope total'}</Field>
      </dl>
    </div>
  );
}

function Theme({ theme, title }: { theme: CampaignDetailData['theme']; title: string }) {
  const style = {
    ...(theme.accent ? { '--color-brand-accent': theme.accent } : {}),
    ...(theme.surface ? { '--color-brand-surface': theme.surface } : {}),
  } as React.CSSProperties;
  return (
    <div className="grid grid-cols-2 gap-6 items-start">
      <dl className="space-y-3">
        <Field label="Submarca">{theme.brand}</Field>
        <Field label="Modo">{theme.mode === 'dark' ? 'Oscuro (on-premise)' : 'Claro'}</Field>
        <Field label="Acento de marca">{theme.accent ?? 'El de la submarca'}</Field>
        <Field label="Superficie de marca">{theme.surface ?? 'La de la submarca'}</Field>
        <p className="font-body-md text-[13px] text-on-surface-variant">
          Las campañas solo cambian colores de marca; los colores funcionales y de estado no se modifican.
        </p>
      </dl>
      <section
        data-brand={theme.brand}
        style={style}
        className="rounded-2xl p-5 bg-brand-surface text-on-brand-surface space-y-3"
        aria-label="Vista previa del tema"
      >
        <p className="font-label-sm text-[11px] uppercase">Vista previa</p>
        <p className="font-headline-md text-[22px]">{title}</p>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-brand-accent font-label-sm text-[11px]">
          <span aria-hidden="true" className="w-2 h-2 rounded-full bg-brand-accent" />
          {theme.brand}
        </span>
      </section>
    </div>
  );
}
