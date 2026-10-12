import { type FormEvent, useState } from 'react';
import { Button } from '../components/Button.tsx';
import { Icon } from '../components/Icon.tsx';
import { StatusMessage } from '../components/StatusMessage.tsx';
import { TextField } from '../components/TextField.tsx';
import { cx } from '../lib/cx.ts';

export type EconomyTab = 'movimientos' | 'insignias' | 'conciliacion';

export interface AccountEntryRow {
  id: string;
  type: 'CREDITO' | 'DEBITO' | 'REVERSO' | 'AJUSTE';
  kind: 'credit' | 'debit' | 'reversal' | 'adjustment' | 'expiry';
  amount: number;
  description: string;
  detail?: string;
  dateLabel: string;
  expiresLabel?: string;
  /** Lo que queda sin usar (solo créditos). */
  remaining: number | null;
  compensated: boolean;
  reason: string | null;
}

export interface AccountView {
  idHint: string;
  alias: string;
  status: string;
  balance: number;
  ledgerSum: number;
  xp: number;
  level: number;
  entries: AccountEntryRow[];
}

export interface BadgeRow {
  slug: string;
  name: string;
  icon: string;
  awarded: number;
}

export interface ReconciliationView {
  checkedAccounts: number;
  checkedLabel: string;
  mismatches: Array<{ idHint: string; balance: number; ledgerSum: number }>;
}

export interface EconomyViewProps {
  tab: EconomyTab;
  onTabChange: (tab: EconomyTab) => void;
  currencyName: string;
  error?: string;
  notice?: string;
  busy?: string;
  fieldErrors?: Record<string, string[]>;

  query: string;
  onQueryChange: (v: string) => void;
  onSearch: () => void;
  account: AccountView | null;
  onReverse: (entryId: string, reason: string) => void;

  badges: BadgeRow[];
  newBadge: { slug: string; name: string; icon: string };
  onNewBadgeChange: (v: { slug: string; name: string; icon: string }) => void;
  onCreateBadge: () => void;

  reconciliation: ReconciliationView | null;
  onReconcile: () => void;
}

const TABS: ReadonlyArray<{ id: EconomyTab; label: string }> = [
  { id: 'movimientos', label: 'Movimientos' },
  { id: 'insignias', label: 'Insignias' },
  { id: 'conciliacion', label: 'Conciliación' },
];

const KIND: Record<AccountEntryRow['kind'], { label: string; cls: string }> = {
  credit: { label: 'Crédito', cls: 'border-secondary text-secondary' },
  debit: { label: 'Débito', cls: 'border-outline text-on-surface-variant' },
  reversal: { label: 'Reverso', cls: 'border-tertiary text-tertiary' },
  adjustment: { label: 'Ajuste', cls: 'border-warning text-warning' },
  expiry: { label: 'Vencimiento', cls: 'border-outline-variant text-on-surface-variant' },
};

const fmt = (n: number) => n.toLocaleString('es-CO');
const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : `−${fmt(Math.abs(n))}`);

/**
 * Vista pura: economía en la consola — movimientos de una cuenta con reversos auditados, catálogo de insignias y
 * conciliación. Diseño: Stitch "19 · Consola · Economía". Fuentes: Guía Técnica §5.7, §9.1, §12.2.
 * Los movimientos nunca se editan: se compensan con un movimiento nuevo que exige motivo.
 */
export function EconomyView(p: EconomyViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Economía</h1>
        <p className="mt-1 max-w-3xl font-body-md text-body-md text-on-surface-variant">
          {p.currencyName} (Ruta A) y XP (Ruta B) son economías separadas. Los movimientos nunca se editan ni se borran: se compensan con un movimiento
          auditado.
        </p>
      </div>
      <div role="tablist" aria-label="Secciones de economía" className="flex gap-1 border-b border-outline-variant">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`eco-tab-${t.id}`}
            aria-selected={p.tab === t.id}
            aria-controls={`eco-panel-${t.id}`}
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
          className="flex items-start gap-2 p-3 rounded-xl border border-secondary/50 bg-secondary-container text-on-secondary-container font-body-md text-[14px]"
        >
          <Icon name="check_circle" className="text-[20px]" />
          {p.notice}
        </p>
      )}
      <section role="tabpanel" id={`eco-panel-${p.tab}`} aria-labelledby={`eco-tab-${p.tab}`}>
        {p.tab === 'movimientos' ? <MovementsPanel {...p} /> : p.tab === 'insignias' ? <BadgesPanel {...p} /> : <ReconcilePanel {...p} />}
      </section>
    </div>
  );
}

function MovementsPanel(p: EconomyViewProps) {
  const [reversing, setReversing] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const a = p.account;
  const target = a?.entries.find((e) => e.id === reversing);
  return (
    <div className="space-y-5">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (p.query.trim()) p.onSearch();
        }}
      >
        <TextField
          label="Id de reclamación o de persona"
          value={p.query}
          onChange={p.onQueryChange}
          hint="El id de reclamación aparece en la exportación de auditoría de cada lote."
          className="flex-1 min-w-80"
        />
        <Button type="submit" fullWidth={false} leadingIcon="search" loading={p.busy === 'search'} disabled={!p.query.trim()} className="px-5 h-11">
          Buscar
        </Button>
      </form>

      {!a ? (
        <StatusMessage kind="empty" title="Busca una cuenta" body="Consulta los movimientos para atender un reclamo o una revisión de fraude." />
      ) : (
        <div className="grid grid-cols-[1fr_22rem] gap-6 items-start">
          <div className="space-y-4">
            <dl className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl border border-primary/40 bg-surface-container-low">
                <dt className="font-label-sm text-label-sm uppercase text-on-surface-variant">Saldo · {a.alias}</dt>
                <dd className="font-numeric-xl text-[28px] tabular-nums text-on-surface">
                  {fmt(a.balance)} <span className="font-label-lg text-[13px] text-primary">{p.currencyName}</span>
                </dd>
              </div>
              <div className={cx('p-4 rounded-2xl border bg-surface-container-low', a.ledgerSum === a.balance ? 'border-outline-variant' : 'border-error')}>
                <dt className="font-label-sm text-label-sm uppercase text-on-surface-variant">Suma del ledger</dt>
                <dd className="font-numeric-xl text-[28px] tabular-nums text-on-surface">{fmt(a.ledgerSum)}</dd>
                <dd className={cx('font-body-md text-[12px]', a.ledgerSum === a.balance ? 'text-secondary' : 'text-error')}>
                  {a.ledgerSum === a.balance ? 'Conciliado' : 'Diferencia: revisar'}
                </dd>
              </div>
              <div className="p-4 rounded-2xl border border-secondary/40 bg-surface-container-low">
                <dt className="font-label-sm text-label-sm uppercase text-on-surface-variant">Ruta B (separada)</dt>
                <dd className="font-numeric-xl text-[28px] tabular-nums text-on-surface">
                  {fmt(a.xp)} <span className="font-label-lg text-[13px] text-secondary">XP · Nivel {a.level}</span>
                </dd>
              </div>
            </dl>
            <p className="font-body-md text-[12px] text-on-surface-variant">
              Persona {a.idHint} · cuenta {a.status.toLowerCase()}
            </p>
            {a.entries.length === 0 ? (
              <StatusMessage kind="empty" title="Sin movimientos" />
            ) : (
              <div className="rounded-2xl border border-outline-variant overflow-hidden bg-surface-container-lowest">
                <table className="w-full text-left font-body-md text-[14px]">
                  <thead className="bg-surface-container font-label-sm text-label-sm uppercase text-on-surface-variant">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        Fecha
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Tipo
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Concepto
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Cantidad
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Disponible
                      </th>
                      <th scope="col" className="px-4 py-3">
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {a.entries.map((e) => (
                      <tr key={e.id} className={cx(reversing === e.id && 'bg-error-container/30')}>
                        <td className="px-4 py-3 whitespace-nowrap tabular-nums">{e.dateLabel}</td>
                        <td className="px-4 py-3">
                          <span className={cx('px-2 py-0.5 rounded-full border font-label-sm text-[11px]', KIND[e.kind].cls)}>{KIND[e.kind].label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p>{e.description}</p>
                          {e.detail && <p className="text-[12px] text-on-surface-variant">{e.detail}</p>}
                          {e.reason && <p className="text-[12px] text-on-surface-variant">Motivo: {e.reason}</p>}
                          {e.expiresLabel && <p className="text-[12px] text-on-surface-variant">Vence {e.expiresLabel}</p>}
                        </td>
                        <td className={cx('px-4 py-3 text-right tabular-nums font-label-lg', e.amount > 0 ? 'text-secondary' : 'text-on-surface')}>
                          {signed(e.amount)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{e.remaining === null ? '—' : fmt(e.remaining)}</td>
                        <td className="px-4 py-3 text-right">
                          {e.type === 'CREDITO' && !e.compensated && (e.remaining ?? 0) > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setReversing(e.id);
                                setReason('');
                              }}
                              aria-label={`Reversar ${fmt(e.amount)} del ${e.dateLabel}`}
                              className="min-h-10 px-3 rounded-lg font-label-lg text-[13px] text-error hover:bg-surface-container"
                            >
                              Reversar
                            </button>
                          )}
                          {e.compensated && <span className="font-body-md text-[12px] text-on-surface-variant">Compensado</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <aside className="p-5 rounded-2xl border border-outline-variant bg-surface-container-low space-y-4">
            {target ? (
              <form
                className="space-y-4"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  if (reason.trim().length < 10) return;
                  p.onReverse(target.id, reason.trim());
                  setReversing(null);
                }}
              >
                <p className="font-headline-md text-[20px] text-on-surface">Reversar movimiento</p>
                <p className="font-body-md text-[14px]">
                  {target.description} · {target.dateLabel}. Se descuentan <strong className="tabular-nums">{fmt(target.remaining ?? 0)}</strong>{' '}
                  {p.currencyName} que siguen sin usar.
                </p>
                <TextField
                  label="Motivo (queda en auditoría)"
                  value={reason}
                  onChange={setReason}
                  maxLength={500}
                  hint="Mínimo 10 caracteres. La persona ve el reverso, no el motivo."
                  error={p.fieldErrors?.reason?.[0]}
                />
                <p className="font-body-md text-[12px] text-on-surface-variant">El movimiento original no se borra: se registra un reverso compensatorio.</p>
                <Button type="submit" variant="danger" disabled={reason.trim().length < 10} loading={p.busy === 'reverse'}>
                  Registrar reverso
                </Button>
                <Button variant="text" onClick={() => setReversing(null)}>
                  Cancelar
                </Button>
              </form>
            ) : (
              <>
                <p className="font-label-lg text-[14px] text-on-surface">Cómo funcionan los reversos</p>
                <p className="font-body-md text-[13px] text-on-surface-variant">
                  Solo se reversa lo que sigue sin usar de un crédito. Cada crédito admite un único reverso y nadie puede reversar movimientos de su propia
                  cuenta.
                </p>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function BadgesPanel(p: EconomyViewProps) {
  const nb = p.newBadge;
  const fe = (k: string) => p.fieldErrors?.[k]?.[0];
  return (
    <div className="grid grid-cols-[1fr_22rem] gap-6 items-start">
      {p.badges.length === 0 ? (
        <StatusMessage
          kind="empty"
          title="Aún no hay insignias"
          body="Las misiones de la Ruta B (Paso 9) las otorgarán; aquí se define el catálogo aprobado por Marca."
        />
      ) : (
        <ul className="grid grid-cols-3 gap-3">
          {p.badges.map((b) => (
            <li key={b.slug} className="p-4 rounded-2xl border border-outline-variant bg-surface-container-lowest flex items-center gap-3">
              <span className="w-12 h-12 rounded-full border border-secondary/50 flex items-center justify-center">
                <Icon name={b.icon} className="text-[24px] text-secondary" />
              </span>
              <div className="min-w-0">
                <p className="font-label-lg text-[14px] text-on-surface truncate">{b.name}</p>
                <p className="font-body-md text-[12px] text-on-surface-variant">
                  {b.slug} · {fmt(b.awarded)} otorgadas
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (p.busy !== 'badge') p.onCreateBadge();
        }}
        className="p-5 rounded-2xl border border-outline-variant bg-surface-container-lowest space-y-4"
      >
        <p className="font-headline-md text-[20px] text-on-surface">Nueva insignia</p>
        <TextField
          label="Identificador"
          value={nb.slug}
          onChange={(v) => p.onNewBadgeChange({ ...nb, slug: v.toLowerCase() })}
          maxLength={60}
          error={fe('slug')}
        />
        <TextField label="Nombre visible" value={nb.name} onChange={(v) => p.onNewBadgeChange({ ...nb, name: v })} maxLength={60} error={fe('name')} />
        <TextField
          label="Ícono (Material Symbols)"
          value={nb.icon}
          onChange={(v) => p.onNewBadgeChange({ ...nb, icon: v })}
          maxLength={40}
          hint="Ej.: filter_vintage, park, menu_book. Sin copas, botellas ni alusiones al consumo."
          error={fe('icon')}
        />
        <Button type="submit" leadingIcon="add_circle" loading={p.busy === 'badge'} disabled={!nb.slug || !nb.name || !nb.icon}>
          Crear insignia
        </Button>
      </form>
    </div>
  );
}

function ReconcilePanel(p: EconomyViewProps) {
  const r = p.reconciliation;
  return (
    <div className="max-w-3xl space-y-4">
      <p className="font-body-md text-[14px] text-on-surface-variant">
        El saldo de cada cuenta se guarda también como suma de movimientos. La plataforma compara ambos cada hora; una diferencia genera un incidente de
        seguridad de severidad alta.
      </p>
      <Button fullWidth={false} variant="secondary" leadingIcon="fact_check" loading={p.busy === 'reconcile'} onClick={p.onReconcile} className="px-5">
        Conciliar ahora
      </Button>
      {r &&
        (r.mismatches.length === 0 ? (
          <p
            role="status"
            className="flex items-center gap-2 p-3 rounded-xl border border-secondary/50 bg-secondary-container text-on-secondary-container font-body-md text-[14px]"
          >
            <Icon name="verified" className="text-[20px]" />
            {fmt(r.checkedAccounts)} cuentas revisadas: sin diferencias ({r.checkedLabel}).
          </p>
        ) : (
          <div className="p-4 rounded-xl border border-error/50 bg-error-container text-on-error-container space-y-2">
            <p className="font-label-lg text-[14px]">
              {r.mismatches.length} cuentas con diferencia ({r.checkedLabel})
            </p>
            <ul className="font-body-md text-[13px] tabular-nums">
              {r.mismatches.map((m) => (
                <li key={m.idHint}>
                  Persona {m.idHint}: saldo {fmt(m.balance)} · ledger {fmt(m.ledgerSum)}
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  );
}
