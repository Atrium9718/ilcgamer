import type { ReactNode } from 'react';
import { Button } from '../components/Button.tsx';
import { Icon } from '../components/Icon.tsx';
import { StatusMessage } from '../components/StatusMessage.tsx';
import { Switch } from '../components/Switch.tsx';
import { TextField } from '../components/TextField.tsx';
import { cx } from '../lib/cx.ts';
import { formatNumber } from '../lib/format.ts';

export type AnalyticsTab = 'ruta-a' | 'ruta-b' | 'operacion' | 'ejecutiva' | 'referidos';
export type SeriesView = Array<{ label: string; count: number }>;

export interface AnalyticsData {
  routeA: {
    claims: number;
    pointsIssued: number;
    reversals: { count: number; points: number };
    redemptions: number;
    staffLinked: number;
    byDay: SeriesView;
    bySku: Array<{ sku: string; name: string; claims: number; points: number }>;
    byCampaign: Array<{ slug: string; title: string; claims: number; points: number }>;
  };
  routeB: {
    missionsStarted: number;
    missionsCompleted: number;
    completionRate: number | null;
    xpGranted: number;
    badgesAwarded: number;
    sessionsCreated: number;
    sessionsJoined: number;
    byDay: SeriesView;
    byModule: Array<{ moduleId: string; started: number; completed: number }>;
  };
  ops: {
    codeChecks: { total: number; unrecognized: number };
    ageGatePassed: number;
    consentUpdates: number;
    securityEvents: { total: number; open: number; high: number };
    campaignsByStatus: Array<{ label: string; count: number }>;
    rewardZonesLowStock: number;
    modulesAwaitingApproval: number;
    shareCards: number;
  };
}

export interface ReferralSettingsValue {
  enabled: boolean;
  referrerPoints: number;
  referrerXp: number;
  dailyCap: number;
  weeklyCap: number;
  attributionWindowDays: number;
}

export interface AnalyticsViewProps {
  tab: AnalyticsTab;
  onTabChange: (t: AnalyticsTab) => void;
  days: 7 | 30 | 90;
  onDaysChange: (d: 7 | 30 | 90) => void;
  loading?: boolean;
  error?: string;
  notice?: string;
  busy?: string;
  fieldErrors?: Record<string, string[]>;
  data: AnalyticsData | null;
  referralSettings: ReferralSettingsValue;
  onReferralSettingsChange: (v: ReferralSettingsValue) => void;
  onSaveReferralSettings: () => void;
  referralSummary: { attributed: number; rewardedByClaim: number; rewardedByMission: number; capped: number } | null;
}

const TABS: ReadonlyArray<{ id: AnalyticsTab; label: string }> = [
  { id: 'ruta-a', label: 'Ruta A · Comercial' },
  { id: 'ruta-b', label: 'Ruta B · Experiencia' },
  { id: 'operacion', label: 'Operación' },
  { id: 'ejecutiva', label: 'Ejecutiva' },
  { id: 'referidos', label: 'Referidos' },
];

function Kpis({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-4 gap-4">
      {items.map(([label, value]) => (
        <div key={label} className="p-5 rounded-2xl border border-outline-variant bg-surface-container-lowest">
          <dt className="font-label-sm text-[12px] uppercase text-on-surface-variant">{label}</dt>
          <dd className="font-headline-lg text-headline-lg tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Bars({ series, label }: { series: SeriesView; label: string }) {
  const max = Math.max(1, ...series.map((s) => s.count));
  const step = Math.max(1, Math.ceil(series.length / 15));
  return (
    <ol className="flex items-end gap-1 h-32" aria-label={label}>
      {series.map((d, i) => (
        <li key={d.label} className="flex-1 flex flex-col items-center justify-end gap-1 h-full min-w-0">
          <span className="sr-only">
            {d.label}: {d.count}
          </span>
          <span aria-hidden="true" className="w-full rounded-t bg-secondary" style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count ? 4 : 1 }} />
          <span aria-hidden="true" className="font-label-sm text-[10px] text-on-surface-variant">
            {i % step === 0 ? d.label : ''}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Table({ caption, head, rows }: { caption: string; head: string[]; rows: Array<Array<ReactNode>> }) {
  return (
    <table className="w-full text-left font-body-md text-[14px]">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="text-on-surface-variant font-label-sm text-[12px] uppercase">
          {head.map((h, i) => (
            <th key={h} scope="col" className={cx('py-1.5', i > 0 && 'text-right')}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={head.length} className="py-3 text-on-surface-variant">
              Sin datos en este período.
            </td>
          </tr>
        ) : (
          rows.map((r) => (
            <tr key={String(r[0])} className="border-t border-outline-variant">
              {r.map((c, i) => (
                <td key={`${String(r[0])}-${head[i]}`} className={cx('py-2', i === 0 ? 'font-semibold' : 'text-right tabular-nums')}>
                  {c}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)} %`);

/**
 * Vista pura: analítica por tableros separados. Diseño: Stitch "29 · Consola · Analítica". Fuentes: Guía Técnica §10.
 * Los tableros de Ruta A y Ruta B no se combinan en una sola puntuación; todo es agregado, nunca personas.
 */
export function AnalyticsView(p: AnalyticsViewProps) {
  const fe = (k: string) => p.fieldErrors?.[k]?.[0];
  const d = p.data;
  const rs = p.referralSettings;
  const set = <K extends keyof ReferralSettingsValue>(k: K, v: ReferralSettingsValue[K]) => p.onReferralSettingsChange({ ...rs, [k]: v });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Analítica</h1>
          <p className="mt-1 max-w-3xl font-body-md text-body-md text-on-surface-variant">
            Los tableros de Ruta A y Ruta B se miden por separado; no se combinan en una sola puntuación.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 font-label-lg text-[14px]">
          Período
          <select
            value={p.days}
            onChange={(e) => p.onDaysChange(Number(e.target.value) as 7 | 30 | 90)}
            className="px-3 py-2 rounded-xl border border-outline-variant bg-surface-container-lowest"
          >
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
          </select>
        </label>
      </div>

      <div role="tablist" aria-label="Tableros" className="flex gap-1 border-b border-outline-variant">
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
      {p.loading && <StatusMessage kind="pending" title="Cargando tableros" body="Un momento…" />}

      {!p.loading && d && p.tab === 'ruta-a' && (
        <div role="tabpanel" id="panel-ruta-a" aria-labelledby="tab-ruta-a" className="space-y-6">
          <Kpis
            items={[
              ['Activaciones válidas', formatNumber(d.routeA.claims)],
              ['Puntos ILC emitidos', formatNumber(d.routeA.pointsIssued)],
              ['Reversos', `${d.routeA.reversals.count} · ${formatNumber(d.routeA.reversals.points)} pts`],
              ['Canjes de recompensas', formatNumber(d.routeA.redemptions)],
            ]}
          />
          <section aria-labelledby="a-dia">
            <h2 id="a-dia" className="font-title-md text-title-md mb-2">
              Activaciones por día
            </h2>
            <Bars series={d.routeA.byDay} label="Activaciones por día" />
          </section>
          <div className="grid grid-cols-2 gap-8">
            <section aria-labelledby="a-sku">
              <h2 id="a-sku" className="font-title-md text-title-md mb-2">
                Por producto (SKU)
              </h2>
              <Table
                caption="Activaciones por producto"
                head={['Producto', 'Activaciones', 'Puntos']}
                rows={d.routeA.bySku.map((s) => [`${s.name} (${s.sku})`, formatNumber(s.claims), formatNumber(s.points)])}
              />
            </section>
            <section aria-labelledby="a-camp">
              <h2 id="a-camp" className="font-title-md text-title-md mb-2">
                Por campaña
              </h2>
              <Table
                caption="Activaciones por campaña"
                head={['Campaña', 'Activaciones', 'Puntos']}
                rows={d.routeA.byCampaign.map((c) => [c.title, formatNumber(c.claims), formatNumber(c.points)])}
              />
            </section>
          </div>
          <p className="flex items-start gap-2 font-body-md text-[13px] text-on-surface-variant">
            <Icon name="info" className="text-[18px]" />
            Una activación de código no prueba consumo: es un evento comercial válido. Vinculadas por Staff: {d.routeA.staffLinked}.
          </p>
        </div>
      )}

      {!p.loading && d && p.tab === 'ruta-b' && (
        <div role="tabpanel" id="panel-ruta-b" aria-labelledby="tab-ruta-b" className="space-y-6">
          <Kpis
            items={[
              ['Misiones iniciadas', formatNumber(d.routeB.missionsStarted)],
              ['Misiones completadas', formatNumber(d.routeB.missionsCompleted)],
              ['Finalización', pct(d.routeB.completionRate)],
              ['Insignias otorgadas', formatNumber(d.routeB.badgesAwarded)],
            ]}
          />
          <section aria-labelledby="b-dia">
            <h2 id="b-dia" className="font-title-md text-title-md mb-2">
              Misiones completadas por día
            </h2>
            <Bars series={d.routeB.byDay} label="Misiones completadas por día" />
          </section>
          <section aria-labelledby="b-mod">
            <h2 id="b-mod" className="font-title-md text-title-md mb-2">
              Por juego
            </h2>
            <Table
              caption="Misiones por juego"
              head={['Juego', 'Iniciadas', 'Completadas']}
              rows={d.routeB.byModule.map((m) => [m.moduleId, formatNumber(m.started), formatNumber(m.completed)])}
            />
          </section>
          <p className="font-body-md text-[13px] text-on-surface-variant tabular-nums">
            XP otorgada: {formatNumber(d.routeB.xpGranted)} · Parches creados: {d.routeB.sessionsCreated} · Personas que se unieron a un Parche:{' '}
            {d.routeB.sessionsJoined}. El XP nunca se convierte en Puntos ILC.
          </p>
        </div>
      )}

      {!p.loading && d && p.tab === 'operacion' && (
        <div role="tabpanel" id="panel-operacion" aria-labelledby="tab-operacion" className="space-y-6">
          <Kpis
            items={[
              ['Consultas de código', formatNumber(d.ops.codeChecks.total)],
              ['Códigos no reconocidos', formatNumber(d.ops.codeChecks.unrecognized)],
              ['Incidentes abiertos', formatNumber(d.ops.securityEvents.open)],
              ['Incidentes de severidad alta', formatNumber(d.ops.securityEvents.high)],
            ]}
          />
          <Table
            caption="Cumplimiento y operación"
            head={['Indicador', 'Valor']}
            rows={[
              ['Controles de edad superados', formatNumber(d.ops.ageGatePassed)],
              ['Cambios de autorizaciones', formatNumber(d.ops.consentUpdates)],
              ['Zonas de recompensas con stock bajo', formatNumber(d.ops.rewardZonesLowStock)],
              ['Juegos esperando aprobación', formatNumber(d.ops.modulesAwaitingApproval)],
              ['Tarjetas sociales generadas', formatNumber(d.ops.shareCards)],
              ...d.ops.campaignsByStatus.map((c): [string, string] => [`Campañas ${c.label.toLowerCase()}`, formatNumber(c.count)]),
            ]}
          />
        </div>
      )}

      {!p.loading && d && p.tab === 'ejecutiva' && (
        <div role="tabpanel" id="panel-ejecutiva" aria-labelledby="tab-ejecutiva" className="grid grid-cols-2 gap-6">
          <section aria-labelledby="e-a" className="p-5 rounded-2xl border border-outline-variant bg-surface-container-lowest space-y-3">
            <h2 id="e-a" className="font-title-md text-title-md text-primary">
              Ruta A · Comercial
            </h2>
            <Kpis2
              items={[
                ['Activaciones válidas', formatNumber(d.routeA.claims)],
                ['Puntos ILC emitidos', formatNumber(d.routeA.pointsIssued)],
                ['Canjes', formatNumber(d.routeA.redemptions)],
              ]}
            />
          </section>
          <section aria-labelledby="e-b" className="p-5 rounded-2xl border border-outline-variant bg-surface-container-lowest space-y-3">
            <h2 id="e-b" className="font-title-md text-title-md text-secondary">
              Ruta B · Experiencia
            </h2>
            <Kpis2
              items={[
                ['Misiones completadas', formatNumber(d.routeB.missionsCompleted)],
                ['Finalización', pct(d.routeB.completionRate)],
                ['Insignias', formatNumber(d.routeB.badgesAwarded)],
              ]}
            />
          </section>
          <p className="col-span-2 flex items-start gap-2 font-body-md text-[13px] text-on-surface-variant">
            <Icon name="info" className="text-[18px]" />
            Ambos tableros se muestran lado a lado, sin reducirlos a una sola puntuación: miden objetivos distintos.
          </p>
        </div>
      )}

      {!p.loading && p.tab === 'referidos' && (
        <div role="tabpanel" id="panel-referidos" aria-labelledby="tab-referidos" className="space-y-6">
          {p.referralSummary && (
            <Kpis
              items={[
                ['Invitaciones atribuidas', formatNumber(p.referralSummary.attributed)],
                ['Bonificadas por activación', formatNumber(p.referralSummary.rewardedByClaim)],
                ['Bonificadas por misión', formatNumber(p.referralSummary.rewardedByMission)],
                ['Frenadas por tope', formatNumber(p.referralSummary.capped)],
              ]}
            />
          )}
          <form
            noValidate
            className="max-w-2xl space-y-4 p-5 rounded-2xl border border-outline-variant bg-surface-container-lowest"
            onSubmit={(e) => {
              e.preventDefault();
              p.onSaveReferralSettings();
            }}
          >
            <h2 className="font-title-md text-title-md">Reglas de bonificación</h2>
            <p className="font-body-md text-[13px] text-on-surface-variant">
              Apagadas por defecto: encenderlas exige términos, topes y presupuesto aprobados por Marca, Finanzas y Jurídico. La bonificación solo ocurre tras
              una acción real del invitado.
            </p>
            <Switch label="Bonificar a quien invita" checked={rs.enabled} onChange={(v) => set('enabled', v)} />
            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Puntos ILC por la primera activación (Ruta A)"
                type="number"
                min={0}
                value={String(rs.referrerPoints)}
                onChange={(v) => set('referrerPoints', Number(v))}
                error={fe('referrerPoints')}
              />
              <TextField
                label="XP por la primera misión (Ruta B)"
                type="number"
                min={0}
                value={String(rs.referrerXp)}
                onChange={(v) => set('referrerXp', Number(v))}
                error={fe('referrerXp')}
              />
              <TextField
                label="Tope diario por persona que invita"
                type="number"
                min={1}
                value={String(rs.dailyCap)}
                onChange={(v) => set('dailyCap', Number(v))}
                error={fe('dailyCap')}
              />
              <TextField
                label="Tope semanal"
                type="number"
                min={1}
                value={String(rs.weeklyCap)}
                onChange={(v) => set('weeklyCap', Number(v))}
                error={fe('weeklyCap')}
              />
              <TextField
                label="Días para atribuir un código tras crear la cuenta"
                type="number"
                min={1}
                value={String(rs.attributionWindowDays)}
                onChange={(v) => set('attributionWindowDays', Number(v))}
                error={fe('attributionWindowDays')}
              />
            </div>
            <Button type="submit" fullWidth={false} loading={p.busy === 'referrals'}>
              Guardar reglas
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

function Kpis2({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-3 gap-3">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="font-label-sm text-[11px] uppercase text-on-surface-variant">{label}</dt>
          <dd className="font-headline-md text-headline-md tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
