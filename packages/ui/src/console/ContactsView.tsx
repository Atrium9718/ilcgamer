import { useMemo, useState } from 'react';
import { Button } from '../components/Button.tsx';
import { StatusMessage } from '../components/StatusMessage.tsx';
import { TextField } from '../components/TextField.tsx';
import { formatNumber } from '../lib/format.ts';

export interface ContactRow {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  registeredLabel: string;
  marketing: boolean;
  source: string;
}

export interface ContactsViewProps {
  rows: ContactRow[];
  summary: { total: number; withMarketing: number; withEmail: number; withPhone: number; inPeriod: number; today: number };
  byDay: Array<{ label: string; count: number }>;
  days: number;
  onDaysChange: (d: number) => void;
  loading?: boolean;
  error?: string;
  /** Descarga todos los registros (no solo los filtrados en pantalla). */
  onDownload: () => void;
  onRetry: () => void;
}

const RANGES = [7, 30, 90];
const SCROLL = 'overflow-x-auto rounded-2xl border border-outline-variant';

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
      <p className="font-label-sm text-[12px] uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className="font-headline-lg text-[32px] leading-9 text-on-surface tabular-nums">{value}</p>
      {hint && <p className="font-body-md text-[12px] text-on-surface-variant">{hint}</p>}
    </div>
  );
}

/**
 * Panel de registros: quiénes se inscribieron (nombre, correo, celular), qué autorizaron y cómo evoluciona por día, con descarga en CSV.
 * Son datos personales: solo Marca y TI, y cada consulta queda en la auditoría.
 */
export function ContactsView({ rows, summary, byDay, days, onDaysChange, loading, error, onDownload, onRetry }: ContactsViewProps) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.fullName, r.email, r.phone].some((v) => (v ?? '').toLowerCase().includes(q)));
  }, [rows, query]);
  const max = Math.max(1, ...byDay.map((d) => d.count));
  const optRate = summary.total === 0 ? 0 : Math.round((summary.withMarketing / summary.total) * 100);
  return (
    <div className="p-8 space-y-8 max-w-6xl">
      <header className="space-y-2">
        <h1 className="font-headline-lg text-[28px] leading-8 text-on-surface">Registros y contactos</h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
          Personas que se registraron y autorizaron el tratamiento de sus datos. Quienes aceptaron novedades pueden recibir comunicaciones de ILC; para el
          resto, el uso se limita a lo que autorizaron. Cada consulta o descarga queda registrada en la auditoría.
        </p>
      </header>
      {loading && <StatusMessage kind="pending" title="Cargando registros…" />}
      {error && <StatusMessage kind="error" title="No pudimos cargar los registros" body={error} action={<Button onClick={onRetry}>Reintentar</Button>} />}
      {!loading && !error && (
        <>
          <section aria-label="Resumen" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Tile label="Registrados" value={formatNumber(summary.total)} hint={`${formatNumber(summary.today)} hoy`} />
            <Tile label={`Nuevos (${days} días)`} value={formatNumber(summary.inPeriod)} />
            <Tile label="Aceptan novedades" value={`${optRate}%`} hint={`${formatNumber(summary.withMarketing)} de ${formatNumber(summary.total)}`} />
            <Tile
              label="Con correo y celular"
              value={formatNumber(Math.min(summary.withEmail, summary.withPhone))}
              hint={`${formatNumber(summary.withEmail)} correos · ${formatNumber(summary.withPhone)} celulares`}
            />
          </section>

          <section aria-labelledby="serie" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="serie" className="font-headline-md text-headline-md text-on-surface">
                Registros por día
              </h2>
              <fieldset className="flex gap-2 border-0 p-0 m-0">
                <legend className="sr-only">Periodo</legend>
                {RANGES.map((d) => (
                  <Button key={d} variant={d === days ? 'primary' : 'secondary'} onClick={() => onDaysChange(d)}>
                    {d} días
                  </Button>
                ))}
              </fieldset>
            </div>
            <ol aria-label="Registros por día" className="flex items-end gap-1 h-40 rounded-2xl border border-outline-variant bg-surface-container-lowest p-3">
              {byDay.map((d) => (
                <li key={d.label} className="flex-1 min-w-0 flex flex-col justify-end h-full" title={`${d.label}: ${d.count}`}>
                  <div className="w-full rounded-t bg-primary" style={{ height: `${d.count === 0 ? 2 : Math.max(6, Math.round((d.count / max) * 100))}%` }} />
                  <span className="sr-only">
                    {d.label}: {d.count} {d.count === 1 ? 'registro' : 'registros'}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="lista" className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 id="lista" className="font-headline-md text-headline-md text-on-surface">
                Personas registradas
              </h2>
              <div className="flex flex-wrap items-end gap-3">
                <TextField label="Buscar" value={query} onChange={setQuery} placeholder="Nombre, correo o celular" className="w-64" />
                <Button variant="secondary" onClick={onDownload} disabled={rows.length === 0}>
                  Descargar CSV
                </Button>
              </div>
            </div>
            <p role="status" className="font-body-md text-[13px] text-on-surface-variant">
              {formatNumber(filtered.length)} {filtered.length === 1 ? 'persona' : 'personas'}
              {query.trim() ? ' con ese filtro' : ''}
            </p>
            {filtered.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">Todavía no hay registros{query.trim() ? ' con ese filtro' : ''}.</p>
            ) : (
              <>
                {/* biome-ignore lint/a11y/useSemanticElements lint/a11y/noNoninteractiveTabindex: región con desplazamiento: debe poder enfocarse con el teclado (axe) */}
                <div className={SCROLL} tabIndex={0} role="region" aria-label="Tabla de personas registradas">
                  <table className="w-full text-left font-body-md text-[14px]">
                    <caption className="sr-only">Personas registradas con sus datos de contacto y autorizaciones</caption>
                    <thead className="bg-surface-container-high text-on-surface">
                      <tr>
                        <th scope="col" className="p-3">
                          Nombre
                        </th>
                        <th scope="col" className="p-3">
                          Correo
                        </th>
                        <th scope="col" className="p-3">
                          Celular
                        </th>
                        <th scope="col" className="p-3">
                          Registro
                        </th>
                        <th scope="col" className="p-3">
                          Novedades
                        </th>
                        <th scope="col" className="p-3">
                          Origen
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, 200).map((r) => (
                        <tr key={`${r.email ?? r.phone ?? r.fullName}-${r.registeredLabel}`} className="border-t border-outline-variant text-on-surface">
                          <td className="p-3">{r.fullName ?? '—'}</td>
                          <td className="p-3">{r.email ?? '—'}</td>
                          <td className="p-3">{r.phone ?? '—'}</td>
                          <td className="p-3">{r.registeredLabel}</td>
                          <td className="p-3">{r.marketing ? 'Sí' : 'No'}</td>
                          <td className="p-3">{r.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filtered.length > 200 && (
                  <p className="font-body-md text-[12px] text-on-surface-variant">Se muestran las primeras 200; el CSV incluye todas.</p>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
