import {
  defaultPartyManifest,
  type GameManifest,
  type ModuleView,
  PARTY_GAME_LABEL,
  PARTY_GAMES,
  type PartyConfig,
  type PartyGame,
  validateManifest,
} from '@ilc/contracts';
import { PartyEditorView, type PartyGameRow, PartyListView } from '@ilc/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { gamesAdminApi } from '../lib/adminApi.ts';
import { ApiRequestError } from '../lib/api.ts';
import { errorMessage } from '../lib/session.tsx';

const isParty = (m: ModuleView): boolean => {
  const d = m.versions[0]?.manifest.delivery;
  return d?.kind === 'engine' && d.engine === 'party';
};
const gameOf = (m: ModuleView): PartyGame => (m.versions[0]?.manifest.delivery as unknown as { config: PartyConfig } | undefined)?.config.game ?? 'spinner';

/** Siguiente versión (parche) a partir de la más alta existente. */
export function nextVersionOf(versions: string[]): string {
  const parsed = versions.map((v) => v.split('.').map(Number) as [number, number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const top = parsed.at(-1);
  return top ? `${top[0]}.${top[1]}.${top[2] + 1}` : '1.0.0';
}

/** Lista de juegos de fiesta instalados y plantillas para crear otros. */
export function PartyList() {
  const navigate = useNavigate();
  const [modules, setModules] = useState<ModuleView[] | 'loading'>('loading');
  const [error, setError] = useState<string>();
  const load = useCallback(() => {
    setError(undefined);
    gamesAdminApi.modules().then(setModules, (e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);
  const rows: PartyGameRow[] = Array.isArray(modules)
    ? modules.filter(isParty).map((m) => ({
        moduleId: m.moduleId,
        title: m.versions[0]?.manifest.title ?? m.moduleId,
        game: gameOf(m),
        gameLabel: PARTY_GAME_LABEL[gameOf(m)],
        activeVersion: m.activeVersion,
        latestVersion: m.versions[0]?.version ?? '-',
        latestStatus: m.versions[0]?.status ?? '',
      }))
    : [];
  return (
    <PartyListView
      rows={rows}
      templates={PARTY_GAMES.map((g) => ({ game: g, label: PARTY_GAME_LABEL[g] }))}
      loading={modules === 'loading' && !error}
      error={error}
      onEdit={(id) => navigate(`/fiesta/${id}`)}
      onNew={(g) => navigate(`/fiesta/nuevo/${g}`)}
      onGoToCatalog={() => navigate('/juegos')}
      onRetry={load}
    />
  );
}

/** Editor de un juego de fiesta (existente o nuevo desde plantilla). Guardar registra una versión nueva en borrador. */
export function PartyEditor() {
  const { slug, game } = useParams();
  const navigate = useNavigate();
  const isNew = !slug;
  const newGame = game as PartyGame | undefined;

  const [loaded, setLoaded] = useState<{ base: GameManifest | ReturnType<typeof defaultPartyManifest>; versions: string[] } | 'loading' | 'missing'>('loading');
  const [moduleId, setModuleId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [config, setConfig] = useState<PartyConfig>();
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isNew) {
      if (!newGame || !PARTY_GAMES.includes(newGame)) return setLoaded('missing');
      const base = defaultPartyManifest(newGame);
      setLoaded({ base, versions: [] });
      setModuleId(base.moduleId);
      setTitle(base.title);
      setDescription(base.description);
      setConfig(base.delivery.config as unknown as PartyConfig);
      return;
    }
    gamesAdminApi.modules().then(
      (mods) => {
        const m = mods.find((x) => x.moduleId === slug && isParty(x));
        const latest = m?.versions[0];
        if (!m || !latest) return setLoaded('missing');
        setLoaded({ base: latest.manifest, versions: m.versions.map((v) => v.version) });
        setModuleId(m.moduleId);
        setTitle(latest.manifest.title);
        setDescription(latest.manifest.description);
        setConfig((latest.manifest.delivery as unknown as { config: PartyConfig }).config);
      },
      () => setLoaded('missing'),
    );
  }, [isNew, newGame, slug]);

  const nextVersion = useMemo(() => (typeof loaded === 'object' ? nextVersionOf(loaded.versions) : '1.0.0'), [loaded]);
  const manifest = useMemo(() => {
    if (typeof loaded !== 'object' || !config) return undefined;
    return { ...loaded.base, moduleId, version: nextVersion, title, description, delivery: { kind: 'engine', engine: 'party', config } };
  }, [loaded, config, moduleId, nextVersion, title, description]);

  // Validación en vivo con las mismas reglas que el servidor (incluida la de contenido sin presión de alcohol).
  const liveErrors = useMemo(() => {
    if (!manifest) return {};
    const r = validateManifest(manifest);
    return r.ok ? {} : r.errors;
  }, [manifest]);
  const errors = { ...liveErrors, ...serverErrors };

  const save = async () => {
    if (!manifest) return;
    setBusy(true);
    setNotice(undefined);
    setServerErrors({});
    try {
      await gamesAdminApi.register(manifest);
      setSaved(true);
      setNotice(`Guardado como versión ${nextVersion} (borrador). Ve al Catálogo para ponerla a prueba, aprobarla y activarla.`);
      setLoaded((cur) => (typeof cur === 'object' ? { base: manifest as GameManifest, versions: [...cur.versions, nextVersion] } : cur));
      if (isNew) navigate(`/fiesta/${moduleId}`, { replace: true });
    } catch (err) {
      setSaved(false);
      if (err instanceof ApiRequestError && err.fields) setServerErrors(err.fields);
      setNotice(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loaded === 'missing')
    return (
      <PartyListView
        rows={[]}
        templates={[]}
        error="No encontramos ese juego de fiesta."
        onEdit={() => undefined}
        onNew={() => undefined}
        onGoToCatalog={() => navigate('/juegos')}
        onRetry={() => navigate('/fiesta')}
      />
    );
  if (loaded === 'loading' || !config)
    return (
      <PartyListView
        rows={[]}
        templates={[]}
        loading
        onEdit={() => undefined}
        onNew={() => undefined}
        onGoToCatalog={() => undefined}
        onRetry={() => undefined}
      />
    );
  return (
    <PartyEditorView
      game={config.game}
      gameLabel={PARTY_GAME_LABEL[config.game]}
      isNew={isNew}
      moduleId={moduleId}
      onModuleIdChange={setModuleId}
      title={title}
      onTitleChange={setTitle}
      description={description}
      onDescriptionChange={setDescription}
      config={config}
      onConfigChange={(c) => {
        setConfig(c as PartyConfig);
        setSaved(false);
        setNotice(undefined);
        setServerErrors({});
      }}
      nextVersion={nextVersion}
      errors={errors}
      busy={busy}
      notice={notice}
      saved={saved}
      onSave={() => void save()}
      onBack={() => navigate('/fiesta')}
      onGoToCatalog={() => navigate('/juegos')}
    />
  );
}
