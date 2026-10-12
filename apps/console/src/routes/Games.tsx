import type { ModuleView } from '@ilc/contracts';
import { type ApprovalKindView, type GamesTab, GamesView, type ModuleRow } from '@ilc/ui';
import { useCallback, useEffect, useState } from 'react';
import { gamesAdminApi } from '../lib/adminApi.ts';
import { ApiRequestError } from '../lib/api.ts';
import { errorMessage, useSession } from '../lib/session.tsx';

/** Módulo de la API → fila de la vista (una versión sin manifiesto nunca llega: la API ya lo validó). */
export const toModuleRow = (m: ModuleView): ModuleRow => {
  const latest = m.versions[0];
  return {
    moduleId: m.moduleId,
    title: latest?.manifest.title ?? m.moduleId,
    provider: m.provider,
    route: m.route,
    delivery: latest?.manifest.delivery.kind ?? 'engine',
    activeVersion: m.activeVersion,
    versions: m.versions.map((v) => ({ version: v.version, status: v.status, approvals: v.approvals.map((a) => ({ ...a })) })),
  };
};

const APPROVAL_BY_ROLE: Record<string, ApprovalKindView> = { REVISOR_MARCA: 'MARCA', REVISOR_JURIDICO: 'JURIDICA', RESPONSABLE_PRIVACIDAD: 'PRIVACIDAD' };

/** Contenedor de Juegos: conecta la vista pura con /admin/games. La API vuelve a validar cada permiso y la separación de funciones. */
export function Games() {
  const { me } = useSession();
  const roles = me?.roles ?? [];
  const isMaster = roles.includes('SUPERADMIN');
  const canManage = isMaster || roles.includes('ADMIN_MARCA');
  const approvalKinds = roles.flatMap((r) => (APPROVAL_BY_ROLE[r] ? [APPROVAL_BY_ROLE[r]] : []));

  const [tab, setTab] = useState<GamesTab>('catalogo');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [defaults, setDefaults] = useState<string[]>([]);
  const [manifestText, setManifestText] = useState('');
  const [secret, setSecret] = useState<{ moduleId: string; secret: string; epoch: number } | null>(null);
  const [guide, setGuide] = useState('');

  const reload = useCallback(async () => {
    const [mods, g] = await Promise.all([gamesAdminApi.modules(), gamesAdminApi.guide()]);
    setModules(mods.map(toModuleRow));
    setGuide(g.markdown);
    if (canManage) setDefaults((await gamesAdminApi.defaults()).modules);
  }, [canManage]);

  useEffect(() => {
    reload()
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [reload]);

  const act = async (key: string, fn: () => Promise<string | undefined>) => {
    setBusy(key);
    setError(undefined);
    setNotice(undefined);
    setFieldErrors({});
    try {
      const message = await fn();
      await reload();
      if (message) setNotice(message);
    } catch (err) {
      if (err instanceof ApiRequestError && err.fields) setFieldErrors(err.fields);
      setError(errorMessage(err));
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <GamesView
      tab={tab}
      onTabChange={(t) => {
        setTab(t);
        setError(undefined);
        setNotice(undefined);
      }}
      isMaster={isMaster}
      canManage={canManage}
      approvalKinds={approvalKinds}
      loading={loading}
      error={error}
      notice={notice}
      busy={busy}
      modules={modules}
      onTest={(id, v) =>
        void act(`test:${id}:${v}`, async () => {
          await gamesAdminApi.test(id, v);
          return `La versión ${v} de «${id}» está en prueba: el equipo editorial ya puede jugarla sin otorgar nada.`;
        })
      }
      onApprove={(id, v, kind, decision, note) =>
        void act(`approve:${id}:${v}:${kind}`, async () => {
          await gamesAdminApi.decide(id, v, { kind, decision, ...(note ? { note } : {}) });
          return decision === 'APROBADO' ? 'Aprobación registrada.' : 'Rechazo registrado: la versión vuelve a borrador.';
        })
      }
      onActivate={(id, v) =>
        void act(`activate:${id}:${v}`, async () => {
          await gamesAdminApi.activate(id, v);
          return `«${id}» v${v} está activo.`;
        })
      }
      onDeactivate={(id, reason) =>
        void act(`deactivate:${id}`, async () => {
          await gamesAdminApi.deactivate(id, reason);
          return `«${id}» se desactivó y dejó de ofrecerse.`;
        })
      }
      defaults={defaults}
      onDefaultsChange={setDefaults}
      onSaveDefaults={() =>
        void act('defaults', async () => {
          await gamesAdminApi.saveDefaults(defaults);
          return 'Juegos por defecto guardados.';
        })
      }
      manifestText={manifestText}
      onManifestChange={setManifestText}
      onRegister={() => {
        let manifest: unknown;
        try {
          manifest = JSON.parse(manifestText);
        } catch {
          setFieldErrors({});
          setError('El manifiesto no es un JSON válido. Revisa comas y comillas.');
          return;
        }
        void act('register', async () => {
          const v = await gamesAdminApi.register(manifest);
          setManifestText('');
          setTab('catalogo');
          return `Versión registrada en borrador para «${v.moduleId}».`;
        });
      }}
      fieldErrors={fieldErrors}
      secret={secret}
      onShowSecret={(id) =>
        void act(`secret:${id}`, async () => {
          setSecret({ moduleId: id, ...(await gamesAdminApi.secret(id)) });
          return undefined;
        })
      }
      onRotateSecret={(id) =>
        void act(`rotate:${id}`, async () => {
          setSecret({ moduleId: id, ...(await gamesAdminApi.rotateSecret(id)) });
          return 'Secreto rotado: el anterior dejó de valer. Entrégalo al proveedor por un canal seguro.';
        })
      }
      onHideSecret={() => setSecret(null)}
      guide={guide}
    />
  );
}
