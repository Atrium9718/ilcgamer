import { useState } from 'react';
import { Button } from '../components/Button.tsx';
import { Icon } from '../components/Icon.tsx';
import { StatusMessage } from '../components/StatusMessage.tsx';
import { TextField } from '../components/TextField.tsx';
import { cx } from '../lib/cx.ts';
import { formatNumber } from '../lib/format.ts';

export type RewardsAdminTab = 'catalogo' | 'nueva' | 'canjes';
export type RewardTypeView = 'DIGITAL' | 'MERCHANDISING' | 'EXPERIENCIA' | 'CONTENIDO';
export type ClaimStatusView = 'RESERVADO' | 'RECLAMADO' | 'ENTREGADO' | 'EXPIRADO' | 'ANULADO';

export interface RewardAdminRow {
  id: string;
  name: string;
  slug: string;
  type: RewardTypeView;
  cost: number;
  active: boolean;
  fulfillment: string;
  campaignSlug: string | null;
  zones: Array<{ zone: string; available: number; lowStockAlert: number; low: boolean }>;
  counts: { reserved: number; delivered: number; cancelled: number };
}

export interface ClaimAdminRow {
  id: string;
  code: string | null;
  rewardName: string;
  zone: string;
  status: ClaimStatusView;
  cost: number;
  userAlias: string;
  /** Textos ya formateados. */
  createdLabel: string;
  expiresLabel?: string;
  cancelReason: string | null;
}

export interface NewRewardValue {
  slug: string;
  name: string;
  description: string;
  type: RewardTypeView;
  cost: number;
  /** Una condición por línea. */
  conditionsText: string;
  maxPerUser: number;
  startsAt: string;
  endsAt: string;
  fulfillment: string;
  campaignSlug: string;
  /** Una zona por línea: "Zona: cantidad" o "Zona: cantidad: umbral de alerta". */
  zonesText: string;
}

export interface RewardsAdminViewProps {
  tab: RewardsAdminTab;
  onTabChange: (tab: RewardsAdminTab) => void;
  loading?: boolean;
  error?: string;
  notice?: string;
  busy?: string;
  fieldErrors?: Record<string, string[]>;

  rewards: RewardAdminRow[];
  onActivate: (id: string) => void;
  onDeactivate: (id: string, reason: string) => void;
  onAdjustStock: (id: string, v: { zone: string; delta: number; reason: string }) => void;

  form: NewRewardValue;
  onFormChange: (v: NewRewardValue) => void;
  onCreate: () => void;
  campaignOptions: Array<{ slug: string; label: string }>;

  claims: ClaimAdminRow[];
  statusFilter: ClaimStatusView | 'ALL';
  onStatusFilterChange: (s: ClaimStatusView | 'ALL') => void;
  deliverCode: string;
  onDeliverCodeChange: (v: string) => void;
  onDeliver: () => void;
  onCancelClaim: (id: string, reason: string) => void;
}

const TABS: ReadonlyArray<{ id: RewardsAdminTab; label: string }> = [
  { id: 'catalogo', label: 'Catálogo' },
  { id: 'nueva', label: 'Nueva recompensa' },
  { id: 'canjes', label: 'Canjes' },
];
export const REWARD_TYPE_LABEL: Record<RewardTypeView, string> = {
  DIGITAL: 'Digital',
  MERCHANDISING: 'Merchandising',
  EXPERIENCIA: 'Experiencia',
  CONTENIDO: 'Contenido',
};
const CLAIM_LABEL: Record<ClaimStatusView, string> = {
  RESERVADO: 'Por retirar',
  RECLAMADO: 'Por retirar',
  ENTREGADO: 'Entregado',
  EXPIRADO: 'Vencido',
  ANULADO: 'Anulado',
};
const inputClass =
  'w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-container-lowest font-body-md text-body-md outline-none focus:border-primary focus:ring-1 focus:ring-primary';

type Pending =
  | { kind: 'deactivate'; id: string; name: string }
  | { kind: 'cancel'; id: string; name: string }
  | { kind: 'stock'; id: string; name: string; zones: string[] };

/**
 * Vista pura: recompensas, inventario y canjes. Diseño: Stitch "24 · Consola · Recompensas".
 * Fuentes: Guía Técnica §5.8 (inventario por zona, estados del canje) y §9 (separación de funciones: quien crea no activa).
 */
export function RewardsAdminView(p: RewardsAdminViewProps) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState('');
  const [zone, setZone] = useState('');
  const [delta, setDelta] = useState(0);
  const close = () => {
    setPending(null);
    setReason('');
    setDelta(0);
  };
  const confirm = () => {
    if (!pending || reason.trim().length < 5) return;
    if (pending.kind === 'deactivate') p.onDeactivate(pending.id, reason.trim());
    else if (pending.kind === 'cancel') p.onCancelClaim(pending.id, reason.trim());
    else if (delta !== 0) p.onAdjustStock(pending.id, { zone: zone || (pending.zones[0] as string), delta, reason: reason.trim() });
    else return;
    close();
  };
  const fe = (path: string) => p.fieldErrors?.[path]?.[0];
  const set = <K extends keyof NewRewardValue>(k: K, v: NewRewardValue[K]) => p.onFormChange({ ...p.form, [k]: v });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Recompensas</h1>
        <p className="mt-1 max-w-3xl font-body-md text-body-md text-on-surface-variant">
          Catálogo con stock por zona. Un canje descuenta puntos y stock a la vez; lo que no se retira a tiempo vence y devuelve ambos.
        </p>
      </div>

      <div role="tablist" aria-label="Secciones de Recompensas" className="flex gap-1 border-b border-outline-variant">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={p.tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => p.onTabChange(t.id)}
            className={cx(
              'min-h-11 px-4 -mb-px border-b-2 font-label-lg text-[14px]',
              p.tab === t.id ? 'border-primary text-on-surface' : 'border-transparent text-on-surface-variant hover:text-on-surface',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {p.error && (
        <p
          role="alert"
          className="flex items-start gap-2 p-3 rounded-xl border border-error/50 bg-error-container text-on-error-container font-body-md text-[14px]"
        >
          <Icon name="error" className="text-[20px]" />
          {p.error}
        </p>
      )}
      {p.notice && (
        <p
          role="status"
          className="flex items-start gap-2 p-3 rounded-xl border border-secondary/40 bg-secondary-container text-on-secondary-container font-body-md text-[14px]"
        >
          <Icon name="check_circle" className="text-[20px]" />
          {p.notice}
        </p>
      )}
      {p.loading && <StatusMessage kind="pending" title="Cargando recompensas" body="Un momento…" />}

      {pending && (
        <section aria-label="Confirmar acción" className="p-4 rounded-2xl border border-outline-variant bg-surface-container space-y-3">
          <h2 className="font-title-md text-title-md">
            {pending.kind === 'deactivate' && `Desactivar «${pending.name}»`}
            {pending.kind === 'cancel' && `Anular el canje de «${pending.name}»`}
            {pending.kind === 'stock' && `Ajustar stock de «${pending.name}»`}
          </h2>
          {pending.kind === 'stock' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="font-label-lg text-label-lg">Zona</span>
                <select value={zone || pending.zones[0]} onChange={(e) => setZone(e.target.value)} className={inputClass}>
                  {pending.zones.map((z) => (
                    <option key={z}>{z}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="font-label-lg text-label-lg">Cambio (+ repone, − descuenta)</span>
                <input type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} className={inputClass} />
              </label>
            </div>
          )}
          <label className="block space-y-1.5">
            <span className="font-label-lg text-label-lg text-on-surface">Motivo (queda en auditoría)</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={inputClass} />
          </label>
          {pending.kind === 'cancel' && (
            <p className="font-body-md text-[13px] text-on-surface-variant">Se devuelven los puntos y el stock a la persona y a la zona.</p>
          )}
          <div className="flex gap-2">
            <Button fullWidth={false} disabled={reason.trim().length < 5 || (pending.kind === 'stock' && delta === 0)} onClick={confirm}>
              Confirmar
            </Button>
            <Button variant="text" fullWidth={false} onClick={close}>
              Cancelar
            </Button>
          </div>
        </section>
      )}

      {!p.loading && p.tab === 'catalogo' && (
        <div role="tabpanel" id="panel-catalogo" aria-labelledby="tab-catalogo" className="space-y-4">
          <p className="flex items-start gap-2 font-body-md text-[13px] text-on-surface-variant">
            <Icon name="verified_user" className="text-[18px]" />
            Quien crea una recompensa no puede activarla: la activa otra persona de Marca.
          </p>
          {p.rewards.length === 0 && <p className="font-body-md text-on-surface-variant">Todavía no hay recompensas.</p>}
          <ul className="space-y-4">
            {p.rewards.map((r) => (
              <li key={r.id} className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-title-md text-title-md text-on-surface">{r.name}</h2>
                    <p className="font-label-sm text-[12px] text-on-surface-variant">
                      <code>{r.slug}</code> · {REWARD_TYPE_LABEL[r.type]} · Entrega: {r.fulfillment}
                      {r.campaignSlug ? ` · Campaña ${r.campaignSlug}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full border border-outline-variant font-label-sm text-[12px] tabular-nums">
                      {formatNumber(r.cost)} puntos
                    </span>
                    <span
                      className={cx(
                        'px-2.5 py-0.5 rounded-full font-label-sm text-[12px]',
                        r.active ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant',
                      )}
                    >
                      {r.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                </div>
                <table className="w-full text-left font-body-md text-[14px]">
                  <caption className="sr-only">Stock por zona de {r.name}</caption>
                  <thead>
                    <tr className="text-on-surface-variant font-label-sm text-[12px] uppercase">
                      <th scope="col" className="py-1.5">
                        Zona
                      </th>
                      <th scope="col">Disponibles</th>
                      <th scope="col">Alerta desde</th>
                      <th scope="col">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.zones.map((z) => (
                      <tr key={z.zone} className="border-t border-outline-variant">
                        <th scope="row" className="py-2 font-semibold">
                          {z.zone}
                        </th>
                        <td className="tabular-nums">{z.available}</td>
                        <td className="tabular-nums">{z.lowStockAlert}</td>
                        <td>
                          {z.available === 0 ? (
                            <span className="text-error font-label-sm text-[12px]">Agotada</span>
                          ) : z.low ? (
                            <span className="text-tertiary font-label-sm text-[12px]">Stock bajo</span>
                          ) : (
                            <span className="text-on-surface-variant font-label-sm text-[12px]">Con stock</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-body-md text-[13px] text-on-surface-variant tabular-nums">
                    Por retirar {r.counts.reserved} · Entregados {r.counts.delivered} · Anulados o vencidos {r.counts.cancelled}
                  </p>
                  <div className="space-x-1">
                    {r.active ? (
                      <Button variant="text" fullWidth={false} onClick={() => setPending({ kind: 'deactivate', id: r.id, name: r.name })}>
                        Desactivar
                      </Button>
                    ) : (
                      <Button variant="text" fullWidth={false} loading={p.busy === `activate:${r.id}`} onClick={() => p.onActivate(r.id)}>
                        Activar
                      </Button>
                    )}
                    <Button
                      variant="text"
                      fullWidth={false}
                      onClick={() => setPending({ kind: 'stock', id: r.id, name: r.name, zones: r.zones.map((z) => z.zone) })}
                    >
                      Ajustar stock
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!p.loading && p.tab === 'nueva' && (
        <form
          role="tabpanel"
          id="panel-nueva"
          aria-labelledby="tab-nueva"
          noValidate
          className="max-w-3xl space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            p.onCreate();
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Nombre" value={p.form.name} onChange={(v) => set('name', v)} error={fe('name')} maxLength={80} />
            <TextField
              label="Identificador"
              value={p.form.slug}
              onChange={(v) => set('slug', v)}
              error={fe('slug')}
              hint="Minúsculas con guiones, ej. gorra-ilc"
            />
          </div>
          <TextField label="Descripción" value={p.form.description} onChange={(v) => set('description', v)} error={fe('description')} maxLength={500} />
          <div className="grid grid-cols-3 gap-4">
            <label className="block space-y-1.5">
              <span className="font-label-lg text-label-lg">Tipo</span>
              <select value={p.form.type} onChange={(e) => set('type', e.target.value as RewardTypeView)} className={inputClass}>
                {Object.entries(REWARD_TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <TextField label="Costo en puntos" type="number" min={0} value={String(p.form.cost)} onChange={(v) => set('cost', Number(v))} error={fe('cost')} />
            <TextField
              label="Máximo por persona"
              type="number"
              min={1}
              value={String(p.form.maxPerUser)}
              onChange={(v) => set('maxPerUser', Number(v))}
              error={fe('maxPerUser')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Disponible desde" type="date" value={p.form.startsAt} onChange={(v) => set('startsAt', v)} error={fe('startsAt')} />
            <TextField label="Disponible hasta" type="date" value={p.form.endsAt} onChange={(v) => set('endsAt', v)} error={fe('endsAt')} />
          </div>
          <TextField label="Responsable de la entrega" value={p.form.fulfillment} onChange={(v) => set('fulfillment', v)} error={fe('fulfillment')} />
          <label className="block space-y-1.5">
            <span className="font-label-lg text-label-lg">Campaña (opcional)</span>
            <select value={p.form.campaignSlug} onChange={(e) => set('campaignSlug', e.target.value)} className={inputClass}>
              <option value="">Sin campaña</option>
              {p.campaignOptions.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
            <span className="font-body-md text-[12px] text-on-surface-variant">Si la campaña no está activa, el canje no se confirma.</span>
          </label>
          <label className="block space-y-1.5">
            <span className="font-label-lg text-label-lg">Condiciones visibles (una por línea)</span>
            <textarea value={p.form.conditionsText} onChange={(e) => set('conditionsText', e.target.value)} rows={4} className={inputClass} />
            {fe('conditions') && <span className="font-body-md text-[13px] text-error">{fe('conditions')}</span>}
          </label>
          <label className="block space-y-1.5">
            <span className="font-label-lg text-label-lg">Stock por zona (una por línea: «Zona: cantidad» o «Zona: cantidad: alerta»)</span>
            <textarea value={p.form.zonesText} onChange={(e) => set('zonesText', e.target.value)} rows={3} className={inputClass} />
            {fe('zones') && <span className="font-body-md text-[13px] text-error">{fe('zones')}</span>}
          </label>
          <Button type="submit" fullWidth={false} loading={p.busy === 'create'}>
            Crear recompensa
          </Button>
        </form>
      )}

      {!p.loading && p.tab === 'canjes' && (
        <div role="tabpanel" id="panel-canjes" aria-labelledby="tab-canjes" className="space-y-5">
          <form
            noValidate
            className="flex flex-wrap items-end gap-3 p-4 rounded-2xl border border-outline-variant bg-surface-container-lowest"
            onSubmit={(e) => {
              e.preventDefault();
              p.onDeliver();
            }}
          >
            <TextField
              label="Código de entrega"
              value={p.deliverCode}
              onChange={(v) => p.onDeliverCodeChange(v.toUpperCase())}
              maxLength={12}
              className="w-64"
            />
            <Button type="submit" fullWidth={false} disabled={p.deliverCode.trim().length < 6} loading={p.busy === 'deliver'}>
              Entregar
            </Button>
          </form>
          <label className="inline-flex items-center gap-2 font-label-lg text-[14px]">
            Estado
            <select
              value={p.statusFilter}
              onChange={(e) => p.onStatusFilterChange(e.target.value as ClaimStatusView | 'ALL')}
              className={cx(inputClass, 'w-auto')}
            >
              <option value="ALL">Todos</option>
              <option value="RESERVADO">Por retirar</option>
              <option value="ENTREGADO">Entregados</option>
              <option value="EXPIRADO">Vencidos</option>
              <option value="ANULADO">Anulados</option>
            </select>
          </label>
          {p.claims.length === 0 ? (
            <p className="font-body-md text-on-surface-variant">No hay canjes con ese filtro.</p>
          ) : (
            <table className="w-full text-left font-body-md text-[14px]">
              <caption className="sr-only">Canjes</caption>
              <thead>
                <tr className="text-on-surface-variant font-label-sm text-[12px] uppercase">
                  <th scope="col" className="py-1.5">
                    Código
                  </th>
                  <th scope="col">Recompensa</th>
                  <th scope="col">Persona</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Fecha</th>
                  <th scope="col" className="text-right">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {p.claims.map((c) => (
                  <tr key={c.id} className="border-t border-outline-variant align-top">
                    <th scope="row" className="py-2.5 font-mono text-[13px]">
                      {c.code ?? '—'}
                    </th>
                    <td>
                      {c.rewardName}
                      <span className="block text-[12px] text-on-surface-variant tabular-nums">
                        {formatNumber(c.cost)} puntos · {c.zone}
                      </span>
                    </td>
                    <td>{c.userAlias}</td>
                    <td>
                      {CLAIM_LABEL[c.status]}
                      {c.cancelReason && <span className="block text-[12px] text-on-surface-variant">{c.cancelReason}</span>}
                    </td>
                    <td>
                      {c.createdLabel}
                      {c.expiresLabel && <span className="block text-[12px] text-on-surface-variant">{c.expiresLabel}</span>}
                    </td>
                    <td className="text-right">
                      {(c.status === 'RESERVADO' || c.status === 'RECLAMADO') && (
                        <Button variant="text" fullWidth={false} onClick={() => setPending({ kind: 'cancel', id: c.id, name: c.rewardName })}>
                          Anular
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
