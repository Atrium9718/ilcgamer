import type { AdminAccount, Reconciliation } from '@ilc/contracts';
import { type AccountView, type EconomyTab, EconomyView } from '@ilc/ui';
import { useEffect, useState } from 'react';
import { economyApi } from '../lib/adminApi.ts';
import { ApiRequestError } from '../lib/api.ts';
import { formatDate, formatDateTime } from '../lib/mapping.ts';
import { errorMessage } from '../lib/session.tsx';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hint = (id: string | null) => (id ? `…${id.slice(-4)}` : '—');

const toView = (a: AdminAccount): AccountView => ({
  idHint: hint(a.userId),
  alias: a.alias,
  status: a.status,
  balance: a.balance,
  ledgerSum: a.ledgerSum,
  xp: a.xp,
  level: a.level,
  entries: a.entries.map((e) => ({
    id: e.id,
    type: e.type,
    kind: e.kind,
    amount: e.amount,
    description: e.description,
    detail: e.detail,
    dateLabel: formatDate(e.at),
    expiresLabel: e.expiresAt ? formatDate(e.expiresAt) : undefined,
    remaining: e.remaining,
    compensated: e.compensated,
    reason: e.reason,
  })),
});

/**
 * Contenedor de Economía. Busca primero por id de reclamación (el dato de la exportación de auditoría) y, si no
 * existe, por id de persona. La API vuelve a validar permisos, motivo y que nadie reverse su propia cuenta.
 */
export function Economy() {
  const [tab, setTab] = useState<EconomyTab>('movimientos');
  const [query, setQuery] = useState('');
  const [account, setAccount] = useState<AdminAccount | null>(null);
  const [badges, setBadges] = useState<Awaited<ReturnType<typeof economyApi.badges>>>([]);
  const [newBadge, setNewBadge] = useState({ slug: '', name: '', icon: '' });
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    economyApi.badges().then(setBadges, (err) => setError(errorMessage(err)));
  }, []);

  const act = async (key: string, fn: () => Promise<string | undefined>) => {
    setBusy(key);
    setError(undefined);
    setNotice(undefined);
    setFieldErrors({});
    try {
      const message = await fn();
      if (message) setNotice(message);
    } catch (err) {
      if (err instanceof ApiRequestError && err.fields) setFieldErrors(err.fields);
      setError(errorMessage(err));
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <EconomyView
      tab={tab}
      onTabChange={(t) => {
        setTab(t);
        setError(undefined);
        setNotice(undefined);
      }}
      currencyName="Puntos ILC"
      error={error}
      notice={notice}
      busy={busy}
      fieldErrors={fieldErrors}
      query={query}
      onQueryChange={setQuery}
      onSearch={() =>
        act('search', async () => {
          const id = query.trim();
          if (!UUID.test(id)) throw new Error('Escribe un id completo (formato 0192f0c1-…).');
          setAccount(null);
          try {
            setAccount(await economyApi.account({ claimId: id }));
          } catch (err) {
            if (!(err instanceof ApiRequestError && err.code === 'NOT_FOUND')) throw err;
            setAccount(await economyApi.account({ userId: id }));
          }
          return undefined;
        })
      }
      account={account ? toView(account) : null}
      onReverse={(entryId, reason) =>
        act('reverse', async () => {
          const updated = await economyApi.reverse(entryId, reason);
          setAccount(updated);
          return 'Reverso registrado. Quedó en la auditoría con tu motivo.';
        })
      }
      badges={badges}
      newBadge={newBadge}
      onNewBadgeChange={setNewBadge}
      onCreateBadge={() =>
        act('badge', async () => {
          const b = await economyApi.createBadge({ slug: newBadge.slug.trim(), name: newBadge.name.trim(), icon: newBadge.icon.trim() });
          setBadges(await economyApi.badges());
          setNewBadge({ slug: '', name: '', icon: '' });
          return `Insignia «${b.name}» creada.`;
        })
      }
      reconciliation={
        reconciliation
          ? {
              checkedAccounts: reconciliation.checkedAccounts,
              checkedLabel: formatDateTime(reconciliation.checkedAt),
              mismatches: reconciliation.mismatches.map((m) => ({ idHint: hint(m.userId), balance: m.balance, ledgerSum: m.ledgerSum })),
            }
          : null
      }
      onReconcile={() =>
        act('reconcile', async () => {
          setReconciliation(await economyApi.reconcile());
          return undefined;
        })
      }
    />
  );
}
