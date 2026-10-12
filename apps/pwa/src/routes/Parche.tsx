import { CreateParcheView, type JoinMethod, JoinParcheView, type ParcheMode, ParcheRoomView } from '@ilc/ui';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { DEMO } from '../demo/fixtures.ts';
import { data } from '../lib/data.ts';
import { identityApi } from '../lib/identity.ts';
import { useSession } from '../lib/session.tsx';
import { useOnline } from '../lib/useOnline.ts';

const validName = (v: string) => v.trim().length >= 2;

export function CreateParcheRoute() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const { me, setMe } = useSession();
  const [alias, setAlias] = useState(me && me.alias !== 'Jugador' ? me.alias : '');
  const [mode, setMode] = useState<ParcheMode>('multi');
  return (
    <CreateParcheView
      brandLabel={DEMO.parche.brand}
      parcheName={name}
      onParcheNameChange={setName}
      alias={alias}
      onAliasChange={setAlias}
      mode={mode}
      onModeChange={setMode}
      energyMinutes={DEMO.energyMinutes}
      canSubmit={validName(name) && validName(alias)}
      onSubmit={async () => {
        if (alias.trim() !== me?.alias) await identityApi.updateAlias(alias.trim()).then(setMe, () => undefined);
        navigate(`/parche/${DEMO.parche.id}`, { replace: true });
      }}
      onBack={() => navigate(-1)}
    />
  );
}

export function JoinParcheRoute() {
  const navigate = useNavigate();
  const params = useParams();
  const [method, setMethod] = useState<JoinMethod>('pin');
  // /p/:pin — enlace de invitación con el PIN incluido.
  const [pin, setPin] = useState(/^\d{4}$/.test(params.pin ?? '') ? (params.pin as string) : '');
  const { me, setMe } = useSession();
  const [alias, setAlias] = useState(me && me.alias !== 'Jugador' ? me.alias : '');
  const [attemptsLeft, setAttemptsLeft] = useState<number | undefined>();
  const [pinError, setPinError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  return (
    <JoinParcheView
      method={method}
      onMethodChange={setMethod}
      pin={pin}
      onPinChange={(v) => {
        setPin(v);
        setPinError(undefined);
      }}
      attemptsLeft={attemptsLeft}
      pinError={pinError}
      alias={alias}
      onAliasChange={setAlias}
      canSubmit={pin.length === 4 && validName(alias)}
      submitting={submitting}
      onSubmit={async () => {
        setSubmitting(true);
        const r = await data.joinParche(pin, alias.trim());
        setSubmitting(false);
        if ('sessionId' in r) {
          if (alias.trim() !== me?.alias) await identityApi.updateAlias(alias.trim()).then(setMe, () => undefined);
          navigate(`/parche/${r.sessionId}`, { replace: true });
        } else {
          setAttemptsLeft(r.attemptsLeft);
          setPinError(`PIN incorrecto. Te quedan ${r.attemptsLeft} intentos.`);
          setPin('');
        }
      }}
      onBack={() => navigate(-1)}
      cameraDenied
    />
  );
}

export function ParcheRoomRoute() {
  const navigate = useNavigate();
  const online = useOnline();
  const total = DEMO.energyMinutes * 60;
  // El servidor es la fuente del reloj (Paso 8); aquí solo se muestra la cuenta regresiva.
  const [remaining, setRemaining] = useState(32 * 60 + 15);
  useEffect(() => {
    const t = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <ParcheRoomView
      name={DEMO.parche.name}
      connection={online ? 'live' : 'offline'}
      pin={DEMO.parche.pin}
      isHost
      energy={{ remainingSeconds: remaining, totalSeconds: total }}
      challenge={{ xp: 1250, completed: 3 }}
      commercial={{ points: 500, activatedCodes: 1 }}
      currencyName={DEMO.currencyName}
      multiplierLabel={`x1,5 · ${DEMO.campaignLabel}`}
      participants={[...DEMO.participants]}
      selfId="yo"
      games={[
        { id: 'trivia', title: 'Trivia del origen', subtitle: '3 min · historia y saberes de Caldas', route: 'A', icon: 'quiz' },
        { id: 'acertijo', title: 'El Parche resuelve', subtitle: 'Acertijo cooperativo de bosque y barricas', route: 'B', icon: 'menu_book' },
      ]}
      sessionEndsAt="6:00 a. m."
      canActivateCode
      onShowQr={() => undefined}
      onShare={() =>
        navigator.share?.({ title: 'Únete a mi Parche', text: `PIN ${DEMO.parche.pin}`, url: `${location.origin}/parche/unirse` }).catch(() => undefined)
      }
      onPlayGame={(id) => navigate(`/jugar/${id}/resultado`)}
      onChooseGame={() => navigate('/jugar')}
      onActivateCode={() => navigate('/escanear')}
      onOpenMenu={() => undefined}
    />
  );
}
