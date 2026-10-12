import type { FormEvent, ReactNode } from 'react';
import { Button } from '../components/Button.tsx';
import { Checkbox } from '../components/Checkbox.tsx';
import { Icon } from '../components/Icon.tsx';
import { TextField } from '../components/TextField.tsx';

/** Estado del formulario (refleja CampaignDraft de @ilc/contracts; la API valida y responde errores por campo). */
export interface CampaignEditorValue {
  slug: string;
  route: 'A_COMERCIAL' | 'B_EXPERIENCIAL' | 'MIXTA';
  internalName: string;
  publicTitle: string;
  publicDescription: string;
  objective: string;
  kpi: string;
  ownerTeam: string;
  brandSlugs: string[];
  channels: Array<'ON_PREMISE' | 'OFF_PREMISE' | 'EVENTO' | 'DIGITAL'>;
  territoriesText: string;
  minAge: number;
  startsAt: string;
  endsAt: string;
  terms: string;
  points: Array<{ sku: string; points: number }>;
  multipliers: Array<{ label: string; factor: number; startsAt: string; endsAt: string }>;
  energyMinutes: number;
  sessionEndsAtLocalTime: string;
  pointsExpiryDays: number | null;
  activationsPerUserPerDay: number;
  themeMode: 'dark' | 'light';
  themeBrand: string;
  accent: string | null;
  location: boolean;
  extraData: boolean;
}

export interface CampaignEditorViewProps {
  mode: 'create' | 'edit';
  value: CampaignEditorValue;
  onChange: (value: CampaignEditorValue) => void;
  brandOptions: Array<{ slug: string; label: string }>;
  /** Errores por campo devueltos por la API ("draft.rules.energyMinutes" → mensajes). */
  fieldErrors?: Record<string, string[]>;
  error?: string;
  saving?: boolean;
  onSave: () => void;
  onCancel: () => void;
}

const CHANNELS: ReadonlyArray<{ id: CampaignEditorValue['channels'][number]; label: string }> = [
  { id: 'ON_PREMISE', label: 'On-premise (bares, discotecas)' },
  { id: 'OFF_PREMISE', label: 'Off-premise (retail, licoreras)' },
  { id: 'EVENTO', label: 'Eventos' },
  { id: 'DIGITAL', label: 'Digital' },
];

const ROUTES: ReadonlyArray<{ id: CampaignEditorValue['route']; label: string; help: string }> = [
  { id: 'A_COMERCIAL', label: 'Ruta A · Comercial', help: 'Activación de códigos, Puntos ILC y beneficios.' },
  { id: 'B_EXPERIENCIAL', label: 'Ruta B · Experiencial', help: 'Historias y retos con XP e insignias; no exige compra.' },
  { id: 'MIXTA', label: 'Mixta', help: 'Combina ambas; las economías siguen separadas.' },
];

const inputClass =
  'w-full h-11 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant outline-none font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary';

function Section({ title, icon, children, note }: { title: string; icon: string; children: ReactNode; note?: string }) {
  return (
    <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 space-y-4">
      <h2 className="flex items-center gap-2 font-headline-md text-[20px] text-on-surface">
        <Icon name={icon} className="text-[22px] text-primary" />
        {title}
      </h2>
      {note && <p className="font-body-md text-[13px] text-on-surface-variant">{note}</p>}
      {children}
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
  error,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  suffix?: string;
  error?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="font-label-lg text-label-lg text-on-surface">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`${inputClass} tabular-nums`}
          aria-invalid={error ? true : undefined}
        />
        {suffix && <span className="font-body-md text-[13px] text-on-surface-variant whitespace-nowrap">{suffix}</span>}
      </span>
      <span className="block font-body-md text-[12px] text-on-surface-variant tabular-nums">
        Rango permitido: {min}–{max}
      </span>
      {error && <span className="block font-label-lg text-[13px] text-error">{error}</span>}
    </label>
  );
}

/**
 * Vista pura: crear/editar el borrador de una campaña. Fuentes: Instrucciones §2, §6, §9, §11; Guía Técnica §5.3, §5.7, §18.
 * Las reglas solo admiten las mecánicas soportadas, con rangos acotados (sin premios por velocidad o cantidad de consumo).
 */
export function CampaignEditorView({ mode, value: v, onChange, brandOptions, fieldErrors = {}, error, saving, onSave, onCancel }: CampaignEditorViewProps) {
  const set = <K extends keyof CampaignEditorValue>(key: K, val: CampaignEditorValue[K]) => onChange({ ...v, [key]: val });
  const fe = (path: string) => fieldErrors[path]?.[0] ?? fieldErrors[`draft.${path}`]?.[0];
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!saving) onSave();
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6 pb-24">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{mode === 'create' ? 'Nueva campaña' : `Editar borrador · ${v.internalName}`}</h1>
          <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
            Guardar no publica: la campaña pasa por revisión de Marca, Jurídica y, si aplica, Privacidad.
          </p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 p-3 rounded-xl border border-error/50 bg-error-container text-on-error-container font-body-md text-[14px]"
        >
          <Icon name="error" className="text-[20px]" />
          {error}
        </p>
      )}

      <Section title="Identificación" icon="badge">
        <div className="grid grid-cols-2 gap-4">
          <TextField label="Nombre interno" value={v.internalName} onChange={(x) => set('internalName', x)} maxLength={120} error={fe('internalName')} />
          <TextField
            label="Identificador (URL)"
            value={v.slug}
            onChange={(x) => set('slug', x.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            disabled={mode === 'edit'}
            hint="Se usa en los QR de evento: ilc.app/e/identificador"
            error={fieldErrors.slug?.[0]}
          />
          <TextField label="Título público" value={v.publicTitle} onChange={(x) => set('publicTitle', x)} maxLength={80} error={fe('publicTitle')} />
          <TextField label="Equipo responsable" value={v.ownerTeam} onChange={(x) => set('ownerTeam', x)} maxLength={80} error={fe('ownerTeam')} />
          <TextField label="Objetivo" value={v.objective} onChange={(x) => set('objective', x)} maxLength={300} error={fe('objective')} />
          <TextField label="KPI principal" value={v.kpi} onChange={(x) => set('kpi', x)} maxLength={200} error={fe('kpi')} />
        </div>
        <label className="block space-y-1.5">
          <span className="font-label-lg text-label-lg text-on-surface">Descripción pública</span>
          <textarea
            value={v.publicDescription}
            onChange={(e) => set('publicDescription', e.target.value)}
            maxLength={400}
            rows={2}
            className={`${inputClass} h-auto py-2`}
          />
        </label>
        <fieldset className="space-y-2">
          <legend className="font-label-lg text-label-lg text-on-surface mb-1">Ruta</legend>
          <div className="grid grid-cols-3 gap-3">
            {ROUTES.map((r) => (
              <label
                key={r.id}
                className={`p-3 rounded-xl border cursor-pointer ${v.route === r.id ? 'border-primary bg-surface-container' : 'border-outline-variant'} ${mode === 'edit' ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <input
                  type="radio"
                  name="route"
                  className="sr-only"
                  checked={v.route === r.id}
                  disabled={mode === 'edit'}
                  onChange={() => set('route', r.id)}
                />
                <span className="block font-label-lg text-[14px] text-on-surface">{r.label}</span>
                <span className="block font-body-md text-[12px] text-on-surface-variant">{r.help}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </Section>

      <Section title="Alcance" icon="map" note="La segmentación es por canal y territorio elegido, no por GPS (Guía Técnica §5.3).">
        <fieldset>
          <legend className="font-label-lg text-label-lg text-on-surface mb-2">Marcas</legend>
          <div className="grid grid-cols-2 gap-2">
            {brandOptions.map((b) => (
              <Checkbox
                key={b.slug}
                label={b.label}
                checked={v.brandSlugs.includes(b.slug)}
                onChange={(on) => set('brandSlugs', on ? [...v.brandSlugs, b.slug] : v.brandSlugs.filter((x) => x !== b.slug))}
              />
            ))}
          </div>
          {fe('brandSlugs') && <p className="mt-1 font-label-lg text-[13px] text-error">{fe('brandSlugs')}</p>}
        </fieldset>
        <fieldset>
          <legend className="font-label-lg text-label-lg text-on-surface mb-2">Canales</legend>
          <div className="grid grid-cols-2 gap-2">
            {CHANNELS.map((c) => (
              <Checkbox
                key={c.id}
                label={c.label}
                checked={v.channels.includes(c.id)}
                onChange={(on) => set('channels', on ? [...v.channels, c.id] : v.channels.filter((x) => x !== c.id))}
              />
            ))}
          </div>
          {fe('channels') && <p className="mt-1 font-label-lg text-[13px] text-error">{fe('channels')}</p>}
        </fieldset>
        <TextField
          label="Territorios"
          value={v.territoriesText}
          onChange={(x) => set('territoriesText', x)}
          hint="Municipios o departamentos separados por coma. Vacío = sin restricción."
        />
      </Section>

      <Section title="Vigencia y edad" icon="event">
        <div className="grid grid-cols-3 gap-4">
          <label className="block space-y-1.5">
            <span className="font-label-lg text-label-lg text-on-surface">Inicio</span>
            <input
              type="datetime-local"
              value={v.startsAt}
              onChange={(e) => set('startsAt', e.target.value)}
              className={inputClass}
              aria-invalid={fe('startsAt') ? true : undefined}
            />
            {fe('startsAt') && <span className="block font-label-lg text-[13px] text-error">{fe('startsAt')}</span>}
          </label>
          <label className="block space-y-1.5">
            <span className="font-label-lg text-label-lg text-on-surface">Fin</span>
            <input
              type="datetime-local"
              value={v.endsAt}
              onChange={(e) => set('endsAt', e.target.value)}
              className={inputClass}
              aria-invalid={fe('endsAt') ? true : undefined}
            />
            {fe('endsAt') && <span className="block font-label-lg text-[13px] text-error">{fe('endsAt')}</span>}
          </label>
          <NumberField label="Edad mínima" value={v.minAge} onChange={(x) => set('minAge', x)} min={18} max={99} suffix="años" error={fe('minAge')} />
        </div>
      </Section>

      <Section
        title="Reglas"
        icon="rule"
        note="Parámetros de prueba hasta aprobación de Finanzas, Trade Marketing y Jurídica. Solo existen las mecánicas listadas."
      >
        <fieldset className="space-y-2">
          <legend className="font-label-lg text-label-lg text-on-surface">Puntos ILC por activación válida (por referencia)</legend>
          {v.points.map((p, i) => (
            <div key={`p-${i.toString()}`} className="grid grid-cols-[1fr_200px_48px] gap-2 items-center">
              <input
                aria-label={`Referencia ${i + 1}`}
                value={p.sku}
                placeholder="RVC-8"
                onChange={(e) =>
                  set(
                    'points',
                    v.points.map((x, j) => (j === i ? { ...x, sku: e.target.value.toUpperCase() } : x)),
                  )
                }
                className={inputClass}
              />
              <input
                aria-label={`Puntos referencia ${i + 1}`}
                type="number"
                min={0}
                max={10000}
                value={p.points}
                onChange={(e) =>
                  set(
                    'points',
                    v.points.map((x, j) => (j === i ? { ...x, points: Number(e.target.value) } : x)),
                  )
                }
                className={`${inputClass} tabular-nums`}
              />
              <button
                type="button"
                aria-label={`Quitar referencia ${i + 1}`}
                onClick={() =>
                  set(
                    'points',
                    v.points.filter((_, j) => j !== i),
                  )
                }
                className="w-12 h-11 rounded-xl hover:bg-surface-container flex items-center justify-center"
              >
                <Icon name="delete" className="text-[20px] text-on-surface-variant" />
              </button>
            </div>
          ))}
          <Button variant="text" fullWidth={false} leadingIcon="add" onClick={() => set('points', [...v.points, { sku: '', points: 0 }])}>
            Agregar referencia
          </Button>
          {fe('rules.pointsBySku') && <p className="font-label-lg text-[13px] text-error">{fe('rules.pointsBySku')}</p>}
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="font-label-lg text-label-lg text-on-surface">Multiplicadores de temporada (máx. x3)</legend>
          {v.multipliers.map((m, i) => (
            <div key={`m-${i.toString()}`} className="grid grid-cols-[1fr_100px_200px_200px_48px] gap-2 items-center">
              <input
                aria-label={`Nombre multiplicador ${i + 1}`}
                value={m.label}
                placeholder="Feria de Manizales"
                onChange={(e) =>
                  set(
                    'multipliers',
                    v.multipliers.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                  )
                }
                className={inputClass}
              />
              <input
                aria-label={`Factor multiplicador ${i + 1}`}
                type="number"
                step="0.1"
                min={1}
                max={3}
                value={m.factor}
                onChange={(e) =>
                  set(
                    'multipliers',
                    v.multipliers.map((x, j) => (j === i ? { ...x, factor: Number(e.target.value) } : x)),
                  )
                }
                className={`${inputClass} tabular-nums`}
              />
              <input
                aria-label={`Inicio multiplicador ${i + 1}`}
                type="datetime-local"
                value={m.startsAt}
                onChange={(e) =>
                  set(
                    'multipliers',
                    v.multipliers.map((x, j) => (j === i ? { ...x, startsAt: e.target.value } : x)),
                  )
                }
                className={inputClass}
              />
              <input
                aria-label={`Fin multiplicador ${i + 1}`}
                type="datetime-local"
                value={m.endsAt}
                onChange={(e) =>
                  set(
                    'multipliers',
                    v.multipliers.map((x, j) => (j === i ? { ...x, endsAt: e.target.value } : x)),
                  )
                }
                className={inputClass}
              />
              <button
                type="button"
                aria-label={`Quitar multiplicador ${i + 1}`}
                onClick={() =>
                  set(
                    'multipliers',
                    v.multipliers.filter((_, j) => j !== i),
                  )
                }
                className="w-12 h-11 rounded-xl hover:bg-surface-container flex items-center justify-center"
              >
                <Icon name="delete" className="text-[20px] text-on-surface-variant" />
              </button>
            </div>
          ))}
          {v.multipliers.length < 5 && (
            <Button
              variant="text"
              fullWidth={false}
              leadingIcon="add"
              onClick={() => set('multipliers', [...v.multipliers, { label: '', factor: 1.5, startsAt: v.startsAt, endsAt: v.endsAt }])}
            >
              Agregar multiplicador
            </Button>
          )}
        </fieldset>
        <div className="grid grid-cols-3 gap-4">
          <NumberField
            label="Energía del Parche"
            value={v.energyMinutes}
            onChange={(x) => set('energyMinutes', x)}
            min={5}
            max={240}
            suffix="min"
            error={fe('rules.energyMinutes')}
          />
          <label className="block space-y-1.5">
            <span className="font-label-lg text-label-lg text-on-surface">Cierre de sesiones del Parche</span>
            <input type="time" value={v.sessionEndsAtLocalTime} onChange={(e) => set('sessionEndsAtLocalTime', e.target.value)} className={inputClass} />
            <span className="block font-body-md text-[12px] text-on-surface-variant">Reloj distinto a la vigencia de los puntos.</span>
          </label>
          <NumberField
            label="Activaciones por persona al día"
            value={v.activationsPerUserPerDay}
            onChange={(x) => set('activationsPerUserPerDay', x)}
            min={1}
            max={20}
            error={fe('rules.limits.activationsPerUserPerDay')}
          />
        </div>
        <div className="grid grid-cols-3 gap-4 items-start">
          <Checkbox label="Los puntos vencen" checked={v.pointsExpiryDays !== null} onChange={(on) => set('pointsExpiryDays', on ? 90 : null)} />
          {v.pointsExpiryDays !== null && (
            <NumberField
              label="Vigencia de los puntos"
              value={v.pointsExpiryDays}
              onChange={(x) => set('pointsExpiryDays', x)}
              min={1}
              max={730}
              suffix="días"
            />
          )}
        </div>
      </Section>

      <Section title="Tema de la campaña" icon="palette" note="Solo cambia colores de marca; los colores funcionales y de estado se mantienen (DESIGN.md).">
        <div className="grid grid-cols-3 gap-4 items-end">
          <label className="block space-y-1.5">
            <span className="font-label-lg text-label-lg text-on-surface">Submarca</span>
            <select value={v.themeBrand} onChange={(e) => set('themeBrand', e.target.value)} className={inputClass}>
              {brandOptions.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="font-label-lg text-label-lg text-on-surface">Modo</span>
            <select value={v.themeMode} onChange={(e) => set('themeMode', e.target.value as 'dark' | 'light')} className={inputClass}>
              <option value="dark">Oscuro (on-premise)</option>
              <option value="light">Claro</option>
            </select>
          </label>
          <div className="space-y-1.5">
            <Checkbox label="Acento propio de temporada" checked={v.accent !== null} onChange={(on) => set('accent', on ? '#C9A45C' : null)} />
            {v.accent !== null && (
              <label className="flex items-center gap-2">
                <span className="sr-only">Color de acento</span>
                <input
                  type="color"
                  value={v.accent}
                  onChange={(e) => set('accent', e.target.value.toUpperCase())}
                  className="w-12 h-11 rounded-lg border border-outline-variant bg-transparent"
                />
                <span className="font-label-lg text-[13px] tabular-nums">{v.accent}</span>
              </label>
            )}
          </div>
        </div>
      </Section>

      <Section
        title="Datos y privacidad"
        icon="shield"
        note="Si la campaña usa ubicación o datos adicionales, requiere aprobación de la persona responsable de Privacidad (Guía Técnica §9.3)."
      >
        <div className="grid grid-cols-2 gap-3">
          <Checkbox label="Usa ubicación aproximada (ciudad o establecimiento)" checked={v.location} onChange={(on) => set('location', on)} />
          <Checkbox label="Recoge datos adicionales del participante" checked={v.extraData} onChange={(on) => set('extraData', on)} />
        </div>
      </Section>

      <Section title="Términos y condiciones" icon="gavel">
        <label className="block">
          <span className="sr-only">Términos y condiciones</span>
          <textarea value={v.terms} onChange={(e) => set('terms', e.target.value)} rows={6} maxLength={10000} className={`${inputClass} h-auto py-2`} />
        </label>
      </Section>

      <div className="fixed bottom-0 left-64 right-0 z-40 bg-surface-container-low/95 backdrop-blur border-t border-outline-variant px-8 py-3 flex justify-end gap-3">
        <Button variant="secondary" fullWidth={false} onClick={onCancel} className="h-11 px-5">
          Cancelar
        </Button>
        <Button type="submit" fullWidth={false} leadingIcon="save" loading={saving} className="h-11 px-5">
          {mode === 'create' ? 'Crear borrador' : 'Guardar borrador'}
        </Button>
      </div>
    </form>
  );
}
