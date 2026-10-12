import { Button } from '../components/Button.tsx';
import { Icon } from '../components/Icon.tsx';
import { StatusMessage } from '../components/StatusMessage.tsx';
import { Switch } from '../components/Switch.tsx';
import { TextField } from '../components/TextField.tsx';
import { cx } from '../lib/cx.ts';

export type DealerTab = 'resumen' | 'perfil' | 'entregar';

export interface DealerProfileValue {
  description: string;
  hours: string;
  address: string;
  listed: boolean;
}

export interface DealerPanelViewProps {
  tab: DealerTab;
  onTabChange: (t: DealerTab) => void;
  loading?: boolean;
  error?: string;
  notice?: string;
  busy?: string;
  venueName: string;
  city: string;
  channelLabel: string;
  counts: { today: number; week: number; month: number };
  series: Array<{ label: string; count: number }>;
  rank: { position: number; total: number } | null;
  campaigns: string[];
  profile: DealerProfileValue;
  onProfileChange: (v: DealerProfileValue) => void;
  onSaveProfile: () => void;
  deliverCode: string;
  onDeliverCodeChange: (v: string) => void;
  onDeliver: () => void;
}

/**
 * Vista pura: panel del Comercio. Diseño: Stitch "28 · Comercio · Mi establecimiento". Fuentes: Instrucciones §3.4, §6.D; Guía Técnica §5.9.
 * Solo ve su establecimiento; de los demás locales únicamente su propia posición. Los datos de personas nunca aparecen.
 */
export function DealerPanelView(p: DealerPanelViewProps) {
  const max = Math.max(1, ...p.series.map((s) => s.count));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{p.venueName}</h1>
        <span className="px-3 py-1 rounded-full border border-outline-variant font-label-sm text-[12px]">{p.channelLabel}</span>
        <span className="px-3 py-1 rounded-full border border-outline-variant font-label-sm text-[12px]">{p.city}</span>
      </div>
      <div role="tablist" aria-label="Secciones del establecimiento" className="flex gap-1 border-b border-outline-variant">
        {(
          [
            ['resumen', 'Resumen'],
            ['perfil', 'Perfil público'],
            ['entregar', 'Entregar recompensa'],
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
      {p.loading && <StatusMessage kind="pending" title="Cargando tu establecimiento" body="Un momento…" />}

      {!p.loading && p.tab === 'resumen' && (
        <div role="tabpanel" id="panel-resumen" aria-labelledby="tab-resumen" className="space-y-6">
          <dl className="grid grid-cols-4 gap-4">
            {(
              [
                ['Botellas activadas hoy', p.counts.today],
                ['Esta semana', p.counts.week],
                ['Este mes', p.counts.month],
              ] as const
            ).map(([label, n]) => (
              <div key={label} className="p-5 rounded-2xl border border-outline-variant bg-surface-container-lowest">
                <dt className="font-label-sm text-[12px] uppercase text-on-surface-variant">{label}</dt>
                <dd className="font-headline-lg text-headline-lg tabular-nums">{n}</dd>
              </div>
            ))}
            <div className="p-5 rounded-2xl border border-outline-variant bg-surface-container-lowest">
              <dt className="font-label-sm text-[12px] uppercase text-on-surface-variant">Posición en tu ciudad</dt>
              <dd className="font-headline-lg text-headline-lg tabular-nums">{p.rank ? `${p.rank.position}.º de ${p.rank.total}` : '—'}</dd>
            </div>
          </dl>
          <section aria-labelledby="serie">
            <h2 id="serie" className="font-title-md text-title-md mb-2">
              Últimos 14 días
            </h2>
            <ol className="flex items-end gap-1.5 h-32" aria-label="Botellas activadas por día">
              {p.series.map((d) => (
                <li key={d.label} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                  <span className="sr-only">
                    {d.label}: {d.count}
                  </span>
                  <span
                    aria-hidden="true"
                    className="w-full rounded-t bg-secondary"
                    style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count ? 4 : 1 }}
                  />
                  <span aria-hidden="true" className="font-label-sm text-[10px] text-on-surface-variant">
                    {d.label}
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <section aria-labelledby="camps">
            <h2 id="camps" className="font-title-md text-title-md mb-2">
              Campañas activas en tu local
            </h2>
            {p.campaigns.length === 0 ? (
              <p className="font-body-md text-on-surface-variant">Todavía no tienes campañas vinculadas.</p>
            ) : (
              <ul className="list-disc pl-5 font-body-md">
                {p.campaigns.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {!p.loading && p.tab === 'perfil' && (
        <form
          role="tabpanel"
          id="panel-perfil"
          aria-labelledby="tab-perfil"
          noValidate
          className="max-w-2xl space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            p.onSaveProfile();
          }}
        >
          <TextField
            label="Descripción"
            value={p.profile.description}
            onChange={(v) => p.onProfileChange({ ...p.profile, description: v })}
            maxLength={500}
            showCount
          />
          <TextField label="Horarios" value={p.profile.hours} onChange={(v) => p.onProfileChange({ ...p.profile, hours: v })} maxLength={200} />
          <TextField label="Dirección" value={p.profile.address} onChange={(v) => p.onProfileChange({ ...p.profile, address: v })} maxLength={160} />
          <Switch label="Mostrar en el directorio" checked={p.profile.listed} onChange={(v) => p.onProfileChange({ ...p.profile, listed: v })} />
          <Button type="submit" fullWidth={false} loading={p.busy === 'profile'}>
            Guardar
          </Button>
        </form>
      )}

      {!p.loading && p.tab === 'entregar' && (
        <form
          role="tabpanel"
          id="panel-entregar"
          aria-labelledby="tab-entregar"
          noValidate
          className="max-w-xl space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            p.onDeliver();
          }}
        >
          <TextField label="Código de entrega" value={p.deliverCode} onChange={(v) => p.onDeliverCodeChange(v.toUpperCase())} maxLength={12} />
          <p className="font-body-md text-[13px] text-on-surface-variant">Solo puedes entregar recompensas de tu ciudad.</p>
          <Button type="submit" fullWidth={false} disabled={p.deliverCode.trim().length < 6} loading={p.busy === 'deliver'}>
            Entregar
          </Button>
        </form>
      )}
    </div>
  );
}
