import type { ParcheState } from '@ilc/contracts';
import { applyCampaignTheme, Button, CreateParcheView, type JoinMethod, JoinParcheView, type ParcheMode, ParcheRoomView, Sheet, StatusMessage } from '@ilc/ui';
import QRCode from 'qrcode';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { ApiRequestError } from '../lib/api.ts';
import { identityApi } from '../lib/identity.ts';
import { parcheApi, useParcheLive } from '../lib/parche.ts';
import { useSession } from '../lib/session.tsx';
import { KEYS, removeLocal, writeLocal } from '../lib/storage.ts';

const validName = (v: string) => v.trim().length >= 2;
const errorText = (err: unknown) => (err instanceof Error ? err.message : 'No pudimos completar la acción.');
const timeFmt = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });

/** Si la API pide confirmar la edad (campaña +21), se vuelve aquí después del control. */
function handleAgeGate(err: unknown, navigate: ReturnType<typeof useNavigate>, returnTo: string, campaignSlug?: string): boolean {
  if (!(err instanceof ApiRequestError && err.code === 'AGE_GATE_REQUIRED')) return false;
  writeLocal(KEYS.returnTo, returnTo, 'session');
  if (campaignSlug) writeLocal(KEYS.pendingCampaign, campaignSlug, 'session');
  navigate('/edad');
  return true;
}

/** Alias por defecto: el de la cuenta si ya lo personalizó. */
function useDefaultAlias() {
  const { me, setMe } = useSession();
  const [alias, setAlias] = useState(me && me.alias !== 'Jugador' ? me.alias : '');
  const remember = async (value: string) => {
    if (value.trim() !== me?.alias) await identityApi.updateAlias(value.trim()).then(setMe, () => undefined);
  };
  return { alias, setAlias, remember };
}

const enterRoom = (navigate: ReturnType<typeof useNavigate>, s: ParcheState) => {
  writeLocal(KEYS.activeParche, s.id, 'session');
  navigate(`/parche/${s.id}`, { replace: true });
};

/**
 * /parche/nuevo — crear El Parche (Guía Técnica §5.5). Puede nacer de una activación propia (Ruta A, `claimId` en el
 * estado de navegación), del QR de un evento (`campaignSlug`) o ser un Parche libre de Ruta B.
 */
export function CreateParcheRoute() {
  const navigate = useNavigate();
  const origin = (useLocation().state ?? {}) as { claimId?: string; campaignSlug?: string; brandLabel?: string };
  const { alias, setAlias, remember } = useDefaultAlias();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<ParcheMode>('multi');
  const [players, setPlayers] = useState('');
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const localPlayers = players
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <CreateParcheView
      brandLabel={origin.brandLabel}
      parcheName={name}
      onParcheNameChange={setName}
      alias={alias}
      onAliasChange={setAlias}
      mode={mode}
      onModeChange={setMode}
      localPlayers={players}
      onLocalPlayersChange={setPlayers}
      localPlayersError={fieldErrors.localPlayers?.[0] ?? (localPlayers.length > 11 ? 'Máximo 11 personas.' : undefined)}
      // La energía real la define la campaña; el servidor la confirma al crear.
      energyMinutes={45}
      nameError={fieldErrors.name?.[0]}
      aliasError={fieldErrors.alias?.[0]}
      error={error}
      canSubmit={validName(name) && validName(alias) && (mode === 'multi' || (localPlayers.length >= 1 && localPlayers.length <= 11))}
      submitting={submitting}
      onSubmit={async () => {
        setSubmitting(true);
        setError(undefined);
        setFieldErrors({});
        try {
          const s = await parcheApi.create({
            name: name.trim(),
            alias: alias.trim(),
            mode: mode === 'multi' ? 'MULTI_DISPOSITIVO' : 'UN_DISPOSITIVO',
            ...(origin.claimId ? { claimId: origin.claimId } : origin.campaignSlug ? { campaignSlug: origin.campaignSlug } : {}),
            ...(mode === 'single' ? { localPlayers } : {}),
          });
          await remember(alias);
          enterRoom(navigate, s);
        } catch (err) {
          if (handleAgeGate(err, navigate, '/parche/nuevo', origin.campaignSlug)) return;
          if (err instanceof ApiRequestError && err.fields) setFieldErrors(err.fields);
          setError(errorText(err));
        } finally {
          setSubmitting(false);
        }
      }}
      onBack={() => navigate(-1)}
    />
  );
}

/** Lee QR con la cámara si el navegador lo permite (BarcodeDetector); si no, se usa la cámara nativa del celular. */
function useQrScanner(active: boolean, onCode: (text: string) => void): { video: ReactNode; unavailable: boolean } {
  const ref = useRef<HTMLVideoElement>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (!active) return;
    const Detector = (
      globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }
    ).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setUnavailable(true);
      return;
    }
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        stream = s;
        if (!ref.current) return;
        ref.current.srcObject = s;
        void ref.current.play();
        const detector = new Detector({ formats: ['qr_code'] });
        timer = setInterval(async () => {
          if (!ref.current) return;
          const found = await detector.detect(ref.current).catch(() => []);
          if (found[0]) onCode(found[0].rawValue);
        }, 400);
      })
      .catch(() => setUnavailable(true));
    return () => {
      if (timer) clearInterval(timer);
      for (const t of stream?.getTracks() ?? []) t.stop();
    };
  }, [active, onCode]);
  return { video: <video ref={ref} muted playsInline className="w-full h-full object-cover" aria-label="Cámara para leer el QR" />, unavailable };
}

/**
 * /parche/unirse, /p/:pin (enlace con PIN) y /parche/:id/unirse?i=… (QR firmado del anfitrión).
 * El PIN tiene intentos limitados en el servidor; el QR solo vale mientras el Parche siga activo.
 */
export function JoinParcheRoute() {
  const navigate = useNavigate();
  const params = useParams();
  const [search] = useSearchParams();
  const invite = params.id ? search.get('i') : null;
  const [method, setMethod] = useState<JoinMethod>('pin');
  const [pin, setPin] = useState(/^\d{4}$/.test(params.pin ?? '') ? (params.pin as string) : '');
  const { alias, setAlias, remember } = useDefaultAlias();
  const [pinError, setPinError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const scanner = useQrScanner(method === 'qr', (text) => {
    try {
      const url = new URL(text, location.origin);
      if (url.origin === location.origin && /^\/(parche\/[0-9a-f-]{36}\/unirse|p\/\d{4})$/.test(url.pathname)) navigate(`${url.pathname}${url.search}`);
    } catch {
      /* QR ajeno: se ignora */
    }
  });

  const submit = async () => {
    setSubmitting(true);
    setPinError(undefined);
    try {
      const s = invite && params.id ? await parcheApi.joinByInvite(params.id, invite, alias.trim()) : await parcheApi.joinByPin(pin, alias.trim());
      await remember(alias);
      enterRoom(navigate, s);
    } catch (err) {
      if (handleAgeGate(err, navigate, location.pathname + location.search)) return;
      setPinError(errorText(err));
      if (!invite) setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <JoinParcheView
      method={invite ? 'pin' : method}
      onMethodChange={setMethod}
      pin={invite ? '••••' : pin}
      onPinChange={(v) => {
        setPin(v);
        setPinError(undefined);
      }}
      pinError={pinError}
      alias={alias}
      onAliasChange={setAlias}
      canSubmit={(invite ? true : pin.length === 4) && validName(alias)}
      submitting={submitting}
      onSubmit={() => void submit()}
      onBack={() => navigate(-1)}
      qrVideo={scanner.video}
      cameraDenied={scanner.unavailable}
    />
  );
}

/** Segundos que faltan según el reloj del servidor (corrige el desfase del celular). */
function useRemaining(endsAt: string | null | undefined, clockOffset: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!endsAt) return 0;
  return Math.max(0, Math.round((new Date(endsAt).getTime() - (now + clockOffset)) / 1000));
}

/** /parche/:id — sala en vivo. El estado, la energía y el cierre vienen del servidor. */
export function ParcheRoomRoute() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { state, error, connection, clockOffset, setState } = useParcheLive(id);
  const remaining = useRemaining(state?.energy.endsAt, clockOffset);
  const [qr, setQr] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const inviteUrl = state?.invitePath ? `${location.origin}${state.invitePath}` : null;

  useEffect(() => {
    if (state?.campaign) applyCampaignTheme({ brand: state.campaign.themeId });
  }, [state?.campaign]);
  useEffect(() => {
    if (state && state.status !== 'ABIERTA' && state.status !== 'EN_CURSO' && state.status !== 'CREADA') removeLocal(KEYS.activeParche, 'session');
  }, [state]);

  if (error && !state)
    return (
      <StatusMessage
        kind="error"
        title="No pudimos abrir el Parche"
        body={errorText(error)}
        className="min-h-dvh justify-center bg-surface"
        action={<Button onClick={() => navigate('/parche/unirse')}>Unirme con PIN</Button>}
      />
    );
  if (!state) return <StatusMessage kind="pending" title="Entrando al Parche…" className="min-h-dvh justify-center bg-surface" />;

  const ended = !['CREADA', 'ABIERTA', 'EN_CURSO'].includes(state.status);
  const me = state.participants.find((p) => p.isYou);
  if (ended || me?.status === 'left')
    return (
      <main className="min-h-dvh flex items-center justify-center bg-surface">
        <StatusMessage
          kind="empty"
          title={me?.status === 'left' ? 'Saliste del Parche' : 'El Parche terminó'}
          body={`Marcador final: ${state.score.toLocaleString('es-CO')}. Tus puntos y tu progreso siguen en tu cuenta.`}
          action={<Button onClick={() => navigate('/jugar', { replace: true })}>Seguir explorando</Button>}
        />
      </main>
    );

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setActionError(undefined);
    try {
      await fn();
    } catch (err) {
      setActionError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ParcheRoomView
        name={state.name}
        connection={connection}
        pin={state.pin ?? '····'}
        isHost={state.isHost && state.mode === 'MULTI_DISPOSITIVO'}
        energy={{ remainingSeconds: remaining, totalSeconds: state.energy.minutes * 60 }}
        challenge={{ xp: state.score, completed: 0 }}
        commercial={state.route === 'B_EXPERIENCIAL' ? undefined : { activatedCodes: state.activations }}
        currencyName="Puntos ILC"
        participants={[
          ...state.participants.filter((p) => p.status !== 'left').map((p) => ({ id: p.id, alias: p.alias, isHost: p.isHost, status: p.status })),
          ...state.localPlayers.map((alias, i) => ({ id: `local-${i}`, alias, status: 'connected' as const })),
        ]}
        selfId={me?.id}
        games={[
          { id: 'trivia', title: 'Trivia del origen', subtitle: 'Disponible con el motor de juegos', route: 'A', icon: 'quiz' },
          { id: 'acertijo', title: 'El Parche resuelve', subtitle: 'Acertijo cooperativo de bosque y barricas', route: 'B', icon: 'menu_book' },
        ]}
        sessionEndsAt={timeFmt.format(new Date(state.expiresAt))}
        canActivateCode={state.route !== 'B_EXPERIENCIAL'}
        onShowQr={() => {
          if (inviteUrl) void QRCode.toDataURL(inviteUrl, { margin: 1, width: 280 }).then(setQr);
        }}
        onShare={
          inviteUrl ? () => navigator.share?.({ title: 'Únete a mi Parche', text: `PIN ${state.pin ?? ''}`, url: inviteUrl }).catch(() => undefined) : undefined
        }
        onPlayGame={() => navigate(`/jugar?parche=${state.id}`)}
        onChooseGame={() => navigate(`/jugar?parche=${state.id}`)}
        // Activar dentro del Parche: se escanea la botella con la cámara; la activación recarga la energía del grupo.
        onActivateCode={() => setActionError('Escanea el QR de la botella con la cámara de tu celular: la activación recarga la energía del Parche.')}
        onOpenMenu={() => setMenu(true)}
      />
      <Sheet open={qr !== null} onClose={() => setQr(null)} title="Invita con este QR" actions={<Button onClick={() => setQr(null)}>Listo</Button>}>
        <div className="flex flex-col items-center gap-3">
          {qr && <img src={qr} alt="Código QR para unirse a este Parche" className="w-56 h-56 rounded-xl bg-white p-2" />}
          <p className="text-center">
            O comparte el PIN <strong className="tabular-nums tracking-widest">{state.pin}</strong>. Solo funciona mientras este Parche esté activo.
          </p>
        </div>
      </Sheet>
      <Sheet
        open={menu}
        onClose={() => setMenu(false)}
        title="Opciones del Parche"
        actions={
          <>
            {state.isHost && (
              <Button
                variant="danger"
                loading={busy}
                onClick={() =>
                  act(async () => {
                    setState(await parcheApi.close(state.id));
                    setMenu(false);
                  })
                }
              >
                Cerrar el Parche para todos
              </Button>
            )}
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  await parcheApi.leave(state.id);
                  removeLocal(KEYS.activeParche, 'session');
                  navigate('/jugar', { replace: true });
                })
              }
            >
              Salir del Parche
            </Button>
          </>
        }
      >
        <p>
          {state.isHost
            ? 'Si sales, el Parche sigue y otra persona queda como anfitriona. Si lo cierras, termina para todos.'
            : 'Si sales, el grupo sigue jugando. Puedes volver a entrar con el PIN mientras el Parche esté activo.'}
        </p>
      </Sheet>
      {actionError && (
        <p
          role="status"
          className="fixed bottom-24 inset-x-4 max-w-md mx-auto p-3 rounded-xl border border-outline-variant bg-surface-container-high font-body-md text-[14px] text-on-surface"
        >
          {actionError}
        </p>
      )}
    </>
  );
}
