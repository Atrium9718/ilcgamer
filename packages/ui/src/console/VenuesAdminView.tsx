import { useState } from 'react';
import { Button } from '../components/Button.tsx';
import { Checkbox } from '../components/Checkbox.tsx';
import { Icon } from '../components/Icon.tsx';
import { StatusMessage } from '../components/StatusMessage.tsx';
import { TextField } from '../components/TextField.tsx';
import { cx } from '../lib/cx.ts';

export type VenuesTab = 'lista' | 'nuevo';
export type VenueStatusView = 'PENDIENTE' | 'APROBADO' | 'SUSPENDIDO';
export type VenueChannelView = 'ON_PREMISE' | 'OFF_PREMISE' | 'EVENTO' | 'DIGITAL';

export interface VenueRow {
  id: string;
  name: string;
  channel: VenueChannelView;
  city: string;
  department: string;
  status: VenueStatusView;
  listed: boolean;
  personnel: Array<{ userId: string; alias: string; role: 'STAFF' | 'DEALER'; code: string | null; active: boolean }>;
  campaigns: Array<{ slug: string; title: string }>;
}

export interface NewVenueValue {
  name: string;
  channel: VenueChannelView;
  city: string;
  department: string;
  address: string;
}

export interface VenuesAdminViewProps {
  tab: VenuesTab;
  onTabChange: (t: VenuesTab) => void;
  loading?: boolean;
  error?: string;
  notice?: string;
  busy?: string;
  fieldErrors?: Record<string, string[]>;
  venues: VenueRow[];
  campaignOptions: Array<{ slug: string; label: string }>;
  onApprove: (id: string) => void;
  onSuspend: (id: string, reason: string) => void;
  onLinkCampaigns: (id: string, slugs: string[]) => void;
  onAddPersonnel: (id: string, v: { email: string; role: 'STAFF' | 'DEALER' }) => void;
  onRemovePersonnel: (id: string, userId: string) => void;
  form: NewVenueValue;
  onFormChange: (v: NewVenueValue) => void;
  onCreate: () => void;
}

const CHANNEL_LABEL: Record<VenueChannelView, string> = { ON_PREMISE: 'On-premise', OFF_PREMISE: 'Off-premise', EVENTO: 'Evento', DIGITAL: 'Digital' };
const STATUS_LABEL: Record<VenueStatusView, string> = { PENDIENTE: 'Pendiente', APROBADO: 'Aprobado', SUSPENDIDO: 'Suspendido' };
const STATUS_TONE: Record<VenueStatusView, string> = {
  PENDIENTE: 'bg-tertiary-container text-on-tertiary-container',
  APROBADO: 'bg-primary text-on-primary',
  SUSPENDIDO: 'bg-error-container text-on-error-container',
};
const inputClass =
  'w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-container-lowest font-body-md text-body-md outline-none focus:border-primary focus:ring-1 focus:ring-primary';

/**
 * Vista pura: establecimientos aliados y su personal. Diseño: Stitch "26 · Consola · Comercios".
 * Fuentes: Instrucciones §3.3-§3.5; Guía Técnica §5.9. Aprobar habilita al local para vincular botellas y entregar recompensas de su ciudad.
 */
export function VenuesAdminView(p: VenuesAdminViewProps) {
  const [suspending, setSuspending] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'STAFF' | 'DEALER'>('STAFF');
  const [links, setLinks] = useState<Record<string, string[]>>({});
  const fe = (k: string) => p.fieldErrors?.[k]?.[0];
  const set = <K extends keyof NewVenueValue>(k: K, v: NewVenueValue[K]) => p.onFormChange({ ...p.form, [k]: v });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Comercios</h1>
        <p className="mt-1 max-w-3xl font-body-md text-body-md text-on-surface-variant">
          Establecimientos aliados, su personal y las campañas donde participan.
        </p>
      </div>
      <div role="tablist" aria-label="Secciones de Comercios" className="flex gap-1 border-b border-outline-variant">
        {(
          [
            ['lista', 'Establecimientos'],
            ['nuevo', 'Nuevo establecimiento'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={p.tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => p.onTabChange(id)}
            className={cx(
              'min-h-11 px-4 -mb-px border-b-2 font-label-lg text-[14px]',
              p.tab === id ? 'border-primary text-on-surface' : 'border-transparent text-on-surface-variant hover:text-on-surface',
            )}
          >
            {label}
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
      {p.loading && <StatusMessage kind="pending" title="Cargando comercios" body="Un momento…" />}

      {suspending && (
        <section aria-label="Confirmar suspensión" className="p-4 rounded-2xl border border-outline-variant bg-surface-container space-y-3">
          <label className="block space-y-1.5">
            <span className="font-label-lg text-label-lg">Motivo de la suspensión (queda en auditoría)</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={inputClass} />
          </label>
          <div className="flex gap-2">
            <Button
              fullWidth={false}
              disabled={reason.trim().length < 5}
              onClick={() => {
                p.onSuspend(suspending, reason.trim());
                setSuspending(null);
                setReason('');
              }}
            >
              Confirmar
            </Button>
            <Button variant="text" fullWidth={false} onClick={() => setSuspending(null)}>
              Cancelar
            </Button>
          </div>
        </section>
      )}

      {!p.loading && p.tab === 'lista' && (
        <div role="tabpanel" id="panel-lista" aria-labelledby="tab-lista" className="space-y-4">
          <p className="flex items-start gap-2 font-body-md text-[13px] text-on-surface-variant">
            <Icon name="verified_user" className="text-[18px]" />
            Aprobar un establecimiento lo habilita para vincular botellas y entregar recompensas de su ciudad.
          </p>
          {p.venues.length === 0 && <p className="font-body-md text-on-surface-variant">Todavía no hay establecimientos.</p>}
          <ul className="space-y-4">
            {p.venues.map((v) => {
              const expanded = open === v.id;
              const selected = links[v.id] ?? v.campaigns.map((c) => c.slug);
              return (
                <li key={v.id} className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-title-md text-title-md">{v.name}</h2>
                      <p className="font-label-sm text-[12px] text-on-surface-variant">
                        {CHANNEL_LABEL[v.channel]} · {v.city}, {v.department} · {v.listed ? 'En el directorio' : 'Fuera del directorio'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-body-md text-[13px] text-on-surface-variant tabular-nums">
                        Personal activo {v.personnel.filter((x) => x.active).length} · Campañas {v.campaigns.length}
                      </span>
                      <span className={cx('px-2.5 py-0.5 rounded-full font-label-sm text-[12px]', STATUS_TONE[v.status])}>{STATUS_LABEL[v.status]}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {v.status !== 'APROBADO' && (
                      <Button variant="text" fullWidth={false} loading={p.busy === `approve:${v.id}`} onClick={() => p.onApprove(v.id)}>
                        {v.status === 'SUSPENDIDO' ? 'Reactivar' : 'Aprobar'}
                      </Button>
                    )}
                    {v.status === 'APROBADO' && (
                      <Button variant="text" fullWidth={false} onClick={() => setSuspending(v.id)}>
                        Suspender
                      </Button>
                    )}
                    <Button variant="text" fullWidth={false} aria-expanded={expanded} onClick={() => setOpen(expanded ? null : v.id)}>
                      {expanded ? 'Ocultar detalle' : 'Personal y campañas'}
                    </Button>
                  </div>
                  {expanded && (
                    <div className="space-y-5 pt-2 border-t border-outline-variant">
                      <table className="w-full text-left font-body-md text-[14px]">
                        <caption className="sr-only">Personal de {v.name}</caption>
                        <thead>
                          <tr className="text-on-surface-variant font-label-sm text-[12px] uppercase">
                            <th scope="col" className="py-1.5">
                              Alias
                            </th>
                            <th scope="col">Rol</th>
                            <th scope="col">Código de Staff</th>
                            <th scope="col">Estado</th>
                            <th scope="col" className="text-right">
                              Acción
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {v.personnel.map((x) => (
                            <tr key={`${x.userId}${x.role}`} className="border-t border-outline-variant">
                              <th scope="row" className="py-2 font-semibold">
                                {x.alias}
                              </th>
                              <td>{x.role === 'STAFF' ? 'Staff' : 'Comercio'}</td>
                              <td className="font-mono text-[13px]">{x.code ?? '—'}</td>
                              <td>{x.active ? 'Activo' : 'Retirado'}</td>
                              <td className="text-right">
                                {x.active && (
                                  <Button variant="text" fullWidth={false} onClick={() => p.onRemovePersonnel(v.id, x.userId)}>
                                    Retirar
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <form
                        noValidate
                        className="flex flex-wrap items-end gap-3"
                        onSubmit={(e) => {
                          e.preventDefault();
                          p.onAddPersonnel(v.id, { email, role });
                          setEmail('');
                        }}
                      >
                        <TextField
                          label="Correo de la persona"
                          type="email"
                          value={email}
                          onChange={setEmail}
                          className="w-72"
                          hint="Debe haber ingresado antes con ese correo"
                        />
                        <label className="block space-y-1.5">
                          <span className="font-label-lg text-label-lg">Rol</span>
                          <select value={role} onChange={(e) => setRole(e.target.value as 'STAFF' | 'DEALER')} className={inputClass}>
                            <option value="STAFF">Staff</option>
                            <option value="DEALER">Comercio</option>
                          </select>
                        </label>
                        <Button type="submit" fullWidth={false} disabled={email.trim().length < 5}>
                          Agregar personal
                        </Button>
                      </form>
                      <fieldset className="space-y-2">
                        <legend className="font-label-lg text-label-lg">Campañas vinculadas</legend>
                        <div className="grid grid-cols-2 gap-2">
                          {p.campaignOptions.map((c) => (
                            <Checkbox
                              key={c.slug}
                              label={c.label}
                              checked={selected.includes(c.slug)}
                              onChange={(on) => setLinks({ ...links, [v.id]: on ? [...selected, c.slug] : selected.filter((x) => x !== c.slug) })}
                            />
                          ))}
                        </div>
                        <Button variant="secondary" fullWidth={false} loading={p.busy === `link:${v.id}`} onClick={() => p.onLinkCampaigns(v.id, selected)}>
                          Guardar campañas
                        </Button>
                      </fieldset>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!p.loading && p.tab === 'nuevo' && (
        <form
          role="tabpanel"
          id="panel-nuevo"
          aria-labelledby="tab-nuevo"
          noValidate
          className="max-w-2xl space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            p.onCreate();
          }}
        >
          <TextField label="Nombre del establecimiento" value={p.form.name} onChange={(v) => set('name', v)} error={fe('name')} maxLength={80} />
          <label className="block space-y-1.5">
            <span className="font-label-lg text-label-lg">Canal</span>
            <select value={p.form.channel} onChange={(e) => set('channel', e.target.value as VenueChannelView)} className={inputClass}>
              {Object.entries(CHANNEL_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="Ciudad"
              value={p.form.city}
              onChange={(v) => set('city', v)}
              error={fe('city')}
              hint="Debe coincidir con la zona de las recompensas que entregará"
            />
            <TextField label="Departamento" value={p.form.department} onChange={(v) => set('department', v)} error={fe('department')} />
          </div>
          <TextField label="Dirección (opcional)" value={p.form.address} onChange={(v) => set('address', v)} error={fe('address')} />
          <Button type="submit" fullWidth={false} loading={p.busy === 'create'}>
            Registrar establecimiento
          </Button>
        </form>
      )}
    </div>
  );
}
