import type { ReactNode } from 'react';
import { Icon } from '../components/Icon.tsx';
import { ProgressBar } from '../components/ProgressBar.tsx';
import { StatusMessage } from '../components/StatusMessage.tsx';

export interface StaffPanelViewProps {
  loading?: boolean;
  error?: string;
  venueName: string;
  city: string;
  code: string;
  /** Imagen del QR (la genera la app; la vista solo la muestra). */
  qr?: ReactNode;
  counts: { today: number; week: number };
  weeklyGoal: number;
  recent: Array<{ timeLabel: string; campaignTitle: string; tableName: string | null }>;
}

/**
 * Vista pura: panel del Staff. Diseño: Stitch "27 · Staff · Mi actividad". Fuentes: Instrucciones §3.3, §6.C; Guía Técnica §5.9.
 * Solo su propia actividad: nunca datos de las personas. La meta mide avance, no premia rapidez ni consumo.
 */
export function StaffPanelView(p: StaffPanelViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Mi actividad</h1>
        <span className="px-3 py-1 rounded-full border border-outline-variant font-label-sm text-[12px]">
          {p.venueName} · {p.city}
        </span>
      </div>
      {p.error && <StatusMessage kind="error" title="No pudimos cargar tu actividad" body={p.error} />}
      {p.loading && <StatusMessage kind="pending" title="Cargando tu actividad" body="Un momento…" />}
      {!p.loading && !p.error && (
        <>
          <section
            aria-labelledby="codigo-staff"
            className="flex flex-wrap items-center gap-6 p-6 rounded-2xl border border-outline-variant bg-surface-container-lowest"
          >
            {p.qr}
            <div className="space-y-2 max-w-md">
              <h2 id="codigo-staff" className="font-title-md text-title-md">
                Tu código de Staff
              </h2>
              <p className="font-headline-md text-[32px] tracking-[0.3em] text-primary tabular-nums">
                <span className="sr-only">Código de Staff: {p.code.split('').join(' ')}</span>
                <span aria-hidden="true">{p.code}</span>
              </p>
              <p className="font-body-md text-[14px] text-on-surface-variant">
                La persona escanea este código en la mesa y luego la botella; así queda vinculada tu atención.
              </p>
            </div>
          </section>
          <dl className="grid grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl border border-outline-variant bg-surface-container-lowest">
              <dt className="font-label-sm text-[12px] uppercase text-on-surface-variant">Botellas vinculadas hoy</dt>
              <dd className="font-headline-lg text-headline-lg tabular-nums">{p.counts.today}</dd>
            </div>
            <div className="p-5 rounded-2xl border border-outline-variant bg-surface-container-lowest">
              <dt className="font-label-sm text-[12px] uppercase text-on-surface-variant">Esta semana</dt>
              <dd className="font-headline-lg text-headline-lg tabular-nums">{p.counts.week}</dd>
            </div>
            <div className="p-5 rounded-2xl border border-outline-variant bg-surface-container-lowest space-y-2">
              <dt className="font-label-sm text-[12px] uppercase text-on-surface-variant">Meta de la semana</dt>
              <dd>
                <span className="font-headline-lg text-headline-lg tabular-nums">
                  {p.counts.week} de {p.weeklyGoal}
                </span>
                <ProgressBar
                  value={p.counts.week}
                  max={p.weeklyGoal}
                  label="Avance de la meta semanal"
                  valueText={`${p.counts.week} de ${p.weeklyGoal}`}
                  tone="secondary"
                  className="mt-2"
                />
              </dd>
            </div>
          </dl>
          <section aria-labelledby="ultimas">
            <h2 id="ultimas" className="font-title-md text-title-md mb-2">
              Últimas vinculaciones
            </h2>
            {p.recent.length === 0 ? (
              <p className="font-body-md text-on-surface-variant">Todavía no has vinculado botellas esta semana.</p>
            ) : (
              <table className="w-full text-left font-body-md text-[14px]">
                <caption className="sr-only">Últimas vinculaciones</caption>
                <thead>
                  <tr className="text-on-surface-variant font-label-sm text-[12px] uppercase">
                    <th scope="col" className="py-1.5">
                      Hora
                    </th>
                    <th scope="col">Campaña</th>
                    <th scope="col">Mesa</th>
                  </tr>
                </thead>
                <tbody>
                  {p.recent.map((r) => (
                    <tr key={`${r.timeLabel}${r.campaignTitle}${r.tableName}`} className="border-t border-outline-variant">
                      <th scope="row" className="py-2 font-semibold">
                        {r.timeLabel}
                      </th>
                      <td>{r.campaignTitle}</td>
                      <td>{r.tableName ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <p className="flex items-start gap-2 font-body-md text-[13px] text-on-surface-variant">
            <Icon name="info" className="text-[18px]" />
            Los incentivos del Staff se liquidan según el acuerdo comercial vigente.
          </p>
        </>
      )}
    </div>
  );
}
