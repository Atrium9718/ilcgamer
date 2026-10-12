import { useState } from 'react';
import { Button } from '../components/Button.tsx';
import { Checkbox } from '../components/Checkbox.tsx';
import { Icon } from '../components/Icon.tsx';
import { StatusMessage } from '../components/StatusMessage.tsx';
import { cx } from '../lib/cx.ts';

export type GamesTab = 'catalogo' | 'registrar' | 'guia';
export type ModuleStatusView = 'BORRADOR' | 'EN_PRUEBA' | 'APROBADO' | 'ACTIVO' | 'DESACTIVADO';
export type ApprovalKindView = 'MARCA' | 'JURIDICA' | 'PRIVACIDAD' | 'TI';

export interface ModuleVersionRow {
  version: string;
  status: ModuleStatusView;
  approvals: Array<{ kind: ApprovalKindView; required: boolean; status: 'approved' | 'rejected' | 'pending' | 'not_required'; note: string | null }>;
}

export interface ModuleRow {
  moduleId: string;
  title: string;
  provider: string;
  route: 'A' | 'B';
  delivery: 'engine' | 'iframe';
  activeVersion: string | null;
  versions: ModuleVersionRow[];
}

export interface GamesViewProps {
  tab: GamesTab;
  onTabChange: (tab: GamesTab) => void;
  /** TI: registrar módulos y ver/rotar el secreto del proveedor. */
  isMaster: boolean;
  /** Admin de Marca: probar, activar, desactivar y definir los juegos por defecto. */
  canManage: boolean;
  /** Tipos de aprobación que esta persona puede emitir (según su rol). */
  approvalKinds: ApprovalKindView[];
  loading?: boolean;
  error?: string;
  notice?: string;
  busy?: string;
  modules: ModuleRow[];
  onTest: (moduleId: string, version: string) => void;
  onApprove: (moduleId: string, version: string, kind: ApprovalKindView, decision: 'APROBADO' | 'RECHAZADO', note: string) => void;
  onActivate: (moduleId: string, version: string) => void;
  onDeactivate: (moduleId: string, reason: string) => void;

  defaults: string[];
  onDefaultsChange: (ids: string[]) => void;
  onSaveDefaults: () => void;

  manifestText: string;
  onManifestChange: (text: string) => void;
  onRegister: () => void;
  fieldErrors?: Record<string, string[]>;

  secret: { moduleId: string; secret: string; epoch: number } | null;
  onShowSecret: (moduleId: string) => void;
  onRotateSecret: (moduleId: string) => void;
  onHideSecret: () => void;

  guide: string;
}

const TABS: ReadonlyArray<{ id: GamesTab; label: string; master?: boolean }> = [
  { id: 'catalogo', label: 'Catálogo' },
  { id: 'registrar', label: 'Registrar módulo', master: true },
  { id: 'guia', label: 'Guía de integración' },
];

export const MODULE_STATUS_LABEL: Record<ModuleStatusView, string> = {
  BORRADOR: 'Borrador',
  EN_PRUEBA: 'En prueba',
  APROBADO: 'Aprobado',
  ACTIVO: 'Activo',
  DESACTIVADO: 'Desactivado',
};

const STATUS_STYLE: Record<ModuleStatusView, string> = {
  BORRADOR: 'bg-surface-container-high text-on-surface-variant',
  EN_PRUEBA: 'bg-tertiary-container text-on-tertiary-container',
  APROBADO: 'bg-secondary-container text-on-secondary-container',
  ACTIVO: 'bg-primary text-on-primary',
  DESACTIVADO: 'bg-surface-container text-on-surface-variant',
};

const KIND_LABEL: Record<ApprovalKindView, string> = { MARCA: 'Marca', JURIDICA: 'Jurídica', PRIVACIDAD: 'Privacidad', TI: 'TI' };
const APPROVAL_LABEL = { approved: 'aprobada', rejected: 'rechazada', pending: 'pendiente', not_required: 'no requerida' } as const;
const inputClass =
  'w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-container-lowest font-body-md text-body-md outline-none focus:border-primary focus:ring-1 focus:ring-primary';

type Pending = { kind: 'deactivate'; moduleId: string } | { kind: 'reject'; moduleId: string; version: string; approval: ApprovalKindView };

/**
 * Vista pura: catálogo y ciclo de vida de los juegos (módulos).
 * Diseño: Stitch "23 · Consola · Juegos". Fuentes: Instrucciones §13.1; Guía Técnica §5.4.
 * Cada aprobación vale para el contenido exacto revisado; quien registra o envía a prueba no puede aprobar (lo valida la API).
 */
export function GamesView(p: GamesViewProps) {
  const tabs = TABS.filter((t) => !t.master || p.isMaster);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState('');
  const confirm = () => {
    if (!pending || reason.trim().length < 5) return;
    if (pending.kind === 'deactivate') p.onDeactivate(pending.moduleId, reason.trim());
    else p.onApprove(pending.moduleId, pending.version, pending.approval, 'RECHAZADO', reason.trim());
    setPending(null);
    setReason('');
  };
  const options = p.modules.filter((m) => m.activeVersion);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Juegos</h1>
        <p className="mt-1 max-w-3xl font-body-md text-body-md text-on-surface-variant">
          Catálogo de módulos con aprobación de Marca y Jurídica antes de activarse. Un juego nunca emite Puntos ILC; el servidor decide cada resultado.
        </p>
      </div>

      <div role="tablist" aria-label="Secciones de Juegos" className="flex gap-1 border-b border-outline-variant">
        {tabs.map((t) => (
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
      {p.loading && <StatusMessage kind="pending" title="Cargando juegos" body="Un momento…" />}

      {!p.loading && p.tab === 'catalogo' && (
        <div role="tabpanel" id="panel-catalogo" aria-labelledby="tab-catalogo" className="space-y-6">
          {p.modules.length === 0 && <p className="font-body-md text-on-surface-variant">Todavía no hay módulos registrados.</p>}
          <ul className="space-y-4">
            {p.modules.map((m) => (
              <li key={m.moduleId} className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-title-md text-title-md text-on-surface">{m.title}</h2>
                    <p className="font-label-sm text-[12px] text-on-surface-variant">
                      <code>{m.moduleId}</code> · {m.provider} · {m.delivery === 'iframe' ? 'Módulo de proveedor (iframe)' : 'Motor propio'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full border border-outline-variant font-label-sm text-[12px]">Ruta {m.route}</span>
                    {m.activeVersion ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-primary text-on-primary font-label-sm text-[12px]">Activo v{m.activeVersion}</span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-[12px]">
                        Sin versión activa
                      </span>
                    )}
                  </div>
                </div>

                <table className="w-full text-left font-body-md text-[14px]">
                  <caption className="sr-only">Versiones de {m.title}</caption>
                  <thead>
                    <tr className="text-on-surface-variant font-label-sm text-[12px] uppercase">
                      <th scope="col" className="py-1.5">
                        Versión
                      </th>
                      <th scope="col">Estado</th>
                      <th scope="col">Aprobaciones</th>
                      <th scope="col" className="text-right">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.versions.map((v) => {
                      const mine = v.approvals.filter((a) => a.status === 'pending' && p.approvalKinds.includes(a.kind));
                      const allApproved = v.approvals.every((a) => a.status === 'approved' || a.status === 'not_required');
                      return (
                        <tr key={v.version} className="border-t border-outline-variant align-top">
                          <th scope="row" className="py-2.5 font-semibold">
                            v{v.version}
                          </th>
                          <td>
                            <span className={cx('px-2 py-0.5 rounded-full font-label-sm text-[11px]', STATUS_STYLE[v.status])}>
                              {MODULE_STATUS_LABEL[v.status]}
                            </span>
                          </td>
                          <td>
                            <ul className="flex flex-wrap gap-x-3 gap-y-1">
                              {v.approvals
                                .filter((a) => a.required)
                                .map((a) => (
                                  <li key={a.kind} className="text-[13px]">
                                    {KIND_LABEL[a.kind]}: <span className={a.status === 'rejected' ? 'text-error' : undefined}>{APPROVAL_LABEL[a.status]}</span>
                                    {a.note && <span className="text-on-surface-variant"> — {a.note}</span>}
                                  </li>
                                ))}
                            </ul>
                          </td>
                          <td className="text-right space-x-1 whitespace-nowrap">
                            {p.canManage && (v.status === 'BORRADOR' || v.status === 'DESACTIVADO') && (
                              <Button
                                variant="text"
                                fullWidth={false}
                                loading={p.busy === `test:${m.moduleId}:${v.version}`}
                                onClick={() => p.onTest(m.moduleId, v.version)}
                              >
                                Probar
                              </Button>
                            )}
                            {v.status === 'EN_PRUEBA' &&
                              mine.map((a) => (
                                <span key={a.kind} className="inline-flex gap-1">
                                  <Button variant="text" fullWidth={false} onClick={() => p.onApprove(m.moduleId, v.version, a.kind, 'APROBADO', '')}>
                                    Aprobar {KIND_LABEL[a.kind]}
                                  </Button>
                                  <Button
                                    variant="text"
                                    fullWidth={false}
                                    onClick={() => setPending({ kind: 'reject', moduleId: m.moduleId, version: v.version, approval: a.kind })}
                                  >
                                    Rechazar {KIND_LABEL[a.kind]}
                                  </Button>
                                </span>
                              ))}
                            {p.canManage && allApproved && v.status !== 'ACTIVO' && v.status !== 'BORRADOR' && (
                              <Button
                                variant="text"
                                fullWidth={false}
                                loading={p.busy === `activate:${m.moduleId}:${v.version}`}
                                onClick={() => p.onActivate(m.moduleId, v.version)}
                              >
                                {v.status === 'DESACTIVADO' ? 'Volver a esta versión' : 'Activar'}
                              </Button>
                            )}
                            {p.canManage && v.status === 'ACTIVO' && (
                              <Button variant="text" fullWidth={false} onClick={() => setPending({ kind: 'deactivate', moduleId: m.moduleId })}>
                                Desactivar
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {p.isMaster && m.delivery === 'iframe' && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button variant="secondary" fullWidth={false} leadingIcon="key" onClick={() => p.onShowSecret(m.moduleId)}>
                      Secreto del proveedor
                    </Button>
                    {p.secret?.moduleId === m.moduleId && (
                      <div role="status" className="flex flex-wrap items-center gap-2 p-2 rounded-xl bg-surface-container">
                        <code className="font-label-sm text-[12px] break-all">{p.secret.secret}</code>
                        <span className="text-[12px] text-on-surface-variant">época {p.secret.epoch}. Entrégalo solo por un canal seguro.</span>
                        <Button variant="text" fullWidth={false} onClick={() => p.onRotateSecret(m.moduleId)}>
                          Rotar
                        </Button>
                        <Button variant="text" fullWidth={false} onClick={p.onHideSecret}>
                          Ocultar
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>

          {pending && (
            <section aria-label="Motivo" className="p-4 rounded-2xl border border-outline-variant bg-surface-container space-y-3">
              <label className="block space-y-1.5">
                <span className="font-label-lg text-label-lg text-on-surface">
                  {pending.kind === 'deactivate' ? `Motivo para desactivar «${pending.moduleId}»` : `Motivo del rechazo (${KIND_LABEL[pending.approval]})`}
                </span>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={inputClass} />
                <span className="font-body-md text-[12px] text-on-surface-variant">Mínimo 5 caracteres. Queda en la bitácora de auditoría.</span>
              </label>
              <div className="flex gap-2">
                <Button fullWidth={false} disabled={reason.trim().length < 5} onClick={confirm}>
                  Confirmar
                </Button>
                <Button
                  variant="text"
                  fullWidth={false}
                  onClick={() => {
                    setPending(null);
                    setReason('');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </section>
          )}

          {p.canManage && (
            <section aria-labelledby="defaults-h" className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 space-y-3">
              <div>
                <h2 id="defaults-h" className="font-title-md text-title-md">
                  Juegos por defecto
                </h2>
                <p className="font-body-md text-[13px] text-on-surface-variant">
                  Se ofrecen cuando no hay campaña o la campaña no eligió juegos. Máximo 2 de Ruta B.
                </p>
              </div>
              {options.length === 0 && <p className="font-body-md text-on-surface-variant">Activa un módulo para poder elegirlo.</p>}
              <div className="grid grid-cols-2 gap-2">
                {options.map((m) => {
                  const on = p.defaults.includes(m.moduleId);
                  const b = options.filter((o) => o.route === 'B' && p.defaults.includes(o.moduleId)).length;
                  return (
                    <Checkbox
                      key={m.moduleId}
                      label={`${m.title} · Ruta ${m.route}`}
                      checked={on}
                      disabled={!on && m.route === 'B' && b >= 2}
                      onChange={(c) => p.onDefaultsChange(c ? [...p.defaults, m.moduleId] : p.defaults.filter((x) => x !== m.moduleId))}
                    />
                  );
                })}
              </div>
              <Button fullWidth={false} loading={p.busy === 'defaults'} onClick={p.onSaveDefaults}>
                Guardar juegos por defecto
              </Button>
            </section>
          )}
        </div>
      )}

      {!p.loading && p.tab === 'registrar' && p.isMaster && (
        <div role="tabpanel" id="panel-registrar" aria-labelledby="tab-registrar" className="space-y-4 max-w-3xl">
          <p className="font-body-md text-on-surface-variant">
            Pega el manifiesto JSON del módulo (hay ejemplos en la carpeta <code>games/ejemplos</code> y en la guía). Cada registro crea una versión nueva en
            borrador.
          </p>
          <label className="block space-y-1.5">
            <span className="font-label-lg text-label-lg text-on-surface">Manifiesto del módulo</span>
            <textarea
              value={p.manifestText}
              onChange={(e) => p.onManifestChange(e.target.value)}
              rows={18}
              spellCheck={false}
              className={cx(inputClass, 'font-mono text-[13px]')}
              aria-invalid={p.fieldErrors && Object.keys(p.fieldErrors).length > 0 ? true : undefined}
            />
          </label>
          {p.fieldErrors && Object.keys(p.fieldErrors).length > 0 && (
            <div role="alert" className="p-3 rounded-xl border border-error/50 bg-error-container text-on-error-container font-body-md text-[13px]">
              <ul className="space-y-1">
                {Object.entries(p.fieldErrors).map(([path, msgs]) => (
                  <li key={path}>
                    <code>{path}</code>: {msgs.join(' · ')}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Button fullWidth={false} loading={p.busy === 'register'} disabled={p.manifestText.trim().length === 0} onClick={p.onRegister}>
            Registrar versión
          </Button>
        </div>
      )}

      {!p.loading && p.tab === 'guia' && (
        <div role="tabpanel" id="panel-guia" aria-labelledby="tab-guia">
          <article
            // biome-ignore lint/a11y/noNoninteractiveTabindex: región desplazable alcanzable con teclado (WCAG 2.1.1)
            tabIndex={0}
            aria-label="Guía de integración de juegos"
            className="max-w-4xl max-h-[70vh] overflow-auto rounded-2xl border border-outline-variant bg-surface-container-lowest p-5"
          >
            <pre className="whitespace-pre-wrap font-body-md text-[14px] leading-relaxed text-on-surface">{p.guide}</pre>
          </article>
        </div>
      )}
    </div>
  );
}
