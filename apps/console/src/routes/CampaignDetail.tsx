import type { CampaignView } from '@ilc/contracts';
import { CampaignDetailView, type DetailTab, type LifecycleAction, StatusMessage } from '@ilc/ui';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { adminApi } from '../lib/adminApi.ts';
import { approvalRows, CHECKLIST, permissionsFor, viewToDetail } from '../lib/mapping.ts';
import { errorMessage, useSession } from '../lib/session.tsx';

const CONFIRM: Partial<Record<LifecycleAction, string>> = {
  close: '¿Cerrar la campaña? Dejará de aceptar participaciones y no se puede reabrir.',
  archive: '¿Archivar la campaña? Quedará solo para consulta.',
};

export function CampaignDetail() {
  const { slug = '' } = useParams();
  const { me } = useSession();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<CampaignView | null>(null);
  const [loadError, setLoadError] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [tab, setTab] = useState<DetailTab>('resumen');
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    adminApi.get(slug).then(setCampaign, (err) => setLoadError(errorMessage(err)));
  }, [slug]);

  if (loadError) return <StatusMessage kind="error" title="No pudimos abrir la campaña" body={loadError} />;
  if (!campaign) return <StatusMessage kind="pending" title="Cargando campaña" body="Un momento…" />;

  /** Toda acción devuelve la campaña actualizada; el checklist se reinicia si cambia la versión de trabajo. */
  const act = async (key: string, fn: () => Promise<CampaignView>) => {
    setBusy(key);
    setError(undefined);
    try {
      const next = await fn();
      if (next.workingVersion.contentHash !== campaign.workingVersion.contentHash) setChecked({});
      setCampaign(next);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <CampaignDetailView
      data={viewToDetail(campaign)}
      approvals={approvalRows(campaign.workingVersion.approvals)}
      missingApprovals={campaign.publish.missing}
      checklist={CHECKLIST}
      checked={checked}
      onToggleChecklist={(key, value) => setChecked((c) => ({ ...c, [key]: value }))}
      permissions={permissionsFor(me?.roles ?? [], campaign)}
      tab={tab}
      onTabChange={setTab}
      busy={busy}
      error={error}
      onEdit={() => navigate(`/campanas/${slug}/editar`)}
      onSubmit={() => act('submit', () => adminApi.submit(slug))}
      onNewVersion={() => act('version', () => adminApi.newVersion(slug))}
      onPublish={() =>
        act('publish', () => {
          const list = Object.fromEntries(
            Object.entries(checked)
              .filter(([, v]) => v)
              .map(([k]) => [k, true as const]),
          );
          return adminApi.publish(slug, list);
        })
      }
      onDecide={(kind, decision, note) =>
        act(`decide:${kind}`, () => adminApi.decide(slug, { kind: kind as 'MARCA', decision, ...(note.trim() ? { note: note.trim() } : {}) }))
      }
      onTransition={(action) => {
        const question = CONFIRM[action];
        if (question && !window.confirm(question)) return;
        void act(action, () => adminApi.transition(slug, action));
      }}
    />
  );
}
