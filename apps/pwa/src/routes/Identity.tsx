import type { OtpChannel } from '@ilc/contracts';
import { type AuthProvider, ConsentsView, OtpView, SignUpView, Toast } from '@ilc/ui';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ApiRequestError } from '../lib/api.ts';
import { identityApi } from '../lib/identity.ts';
import { useSession } from '../lib/session.tsx';
import { KEYS, readLocal, removeLocal } from '../lib/storage.ts';
import { useTabNavigate } from './shell.tsx';

const dateLabel = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)) : undefined;

/** Registro progresivo: términos (obligatorio) y marketing (opcional, desmarcado) antes del acceso persistente. */
export function SignUpRoute() {
  const navigate = useNavigate();
  const { me, config } = useSession();
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState<AuthProvider>();
  const [error, setError] = useState<string>();

  const available: AuthProvider[] = [
    ...config.oauthProviders,
    ...(config.otpChannels.includes('whatsapp') ? (['whatsapp'] as const) : []),
    ...(config.otpChannels.includes('email') ? (['email'] as const) : []),
  ];

  const start = async (provider: AuthProvider) => {
    setBusy(provider);
    setError(undefined);
    try {
      // Cada decisión queda registrada con la versión del aviso que la persona vio (§9.3).
      await identityApi.recordConsent({ purpose: 'TERMINOS_Y_PRIVACIDAD', granted: true, noticeVersion: config.legalNoticeVersion, source: 'registro' });
      await identityApi.recordConsent({ purpose: 'MARKETING', granted: marketing, noticeVersion: config.legalNoticeVersion, source: 'registro' });
      navigate(`/registro/codigo?canal=${provider === 'email' ? 'email' : 'whatsapp'}`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No pudimos continuar.');
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <>
      {error && (
        <div className="fixed top-2 inset-x-2 z-50 max-w-md mx-auto">
          <Toast tone="error" message={error} onDismiss={() => setError(undefined)} />
        </div>
      )}
      <SignUpView
        tempAlias={me?.alias ?? 'Jugador'}
        pending={{ points: 0, xp: 0, badges: 0 }}
        currencyName={config.currencyName}
        termsAccepted={terms}
        onTermsAcceptedChange={setTerms}
        marketingOptIn={marketing}
        onMarketingOptInChange={setMarketing}
        termsHref="/legal/terminos"
        privacyHref="/legal/privacidad"
        availableProviders={available}
        busyProvider={busy}
        onAuth={start}
        onSkip={() => navigate(-1)}
        onBack={() => navigate(-1)}
      />
    </>
  );
}

function useCountdown(initial: number | undefined) {
  const [left, setLeft] = useState(initial);
  useEffect(() => {
    if (left === undefined || left <= 0) return;
    const t = setTimeout(() => setLeft((v) => (v ?? 0) - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return [left, setLeft] as const;
}

export function OtpRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setMe } = useSession();
  const [channel, setChannel] = useState<OtpChannel>(params.get('canal') === 'email' ? 'email' : 'whatsapp');
  const [step, setStep] = useState<'destination' | 'code'>('destination');
  const [destination, setDestination] = useState('');
  const [masked, setMasked] = useState<string>();
  const [code, setCode] = useState('');
  const [destinationError, setDestinationError] = useState<string>();
  const [codeError, setCodeError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [expires, setExpires] = useCountdown(undefined);
  const [resend, setResend] = useCountdown(undefined);

  const request = async (via: OtpChannel = channel) => {
    setSubmitting(true);
    setDestinationError(undefined);
    try {
      const r = await identityApi.requestOtp(via, destination);
      setMasked(r.maskedDestination);
      setExpires(r.expiresInSeconds);
      setResend(r.resendInSeconds);
      setCode('');
      setCodeError(undefined);
      setStep('code');
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : 'No pudimos enviar el código.';
      if (step === 'code') setCodeError(message);
      else setDestinationError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const verify = async () => {
    setSubmitting(true);
    setCodeError(undefined);
    try {
      setMe(await identityApi.verifyOtp(channel, destination, code));
      // Si venía de activar un código, vuelve allí para terminar la activación.
      const next = readLocal<string | null>(KEYS.afterSignup, null, 'session');
      removeLocal(KEYS.afterSignup, 'session');
      navigate(next?.startsWith('/') && !next.startsWith('//') ? next : '/perfil', { replace: true });
    } catch (err) {
      setCode('');
      setCodeError(err instanceof ApiRequestError ? err.message : 'No pudimos verificar el código.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OtpView
      step={step}
      channel={channel}
      destination={destination}
      onDestinationChange={setDestination}
      destinationError={destinationError}
      maskedDestination={masked}
      code={code}
      onCodeChange={setCode}
      codeError={codeError}
      expiresInSeconds={expires}
      resendInSeconds={resend}
      submitting={submitting}
      onRequest={() => void request()}
      onVerify={() => void verify()}
      onResend={() => void request()}
      onChangeDestination={() => setStep('destination')}
      alternativeChannel={channel === 'whatsapp' ? 'sms' : undefined}
      onUseAlternative={() => {
        setChannel('sms');
        void request('sms');
      }}
      onBack={() => (step === 'code' ? setStep('destination') : navigate(-1))}
    />
  );
}

export function ConsentsRoute() {
  const navigate = useNavigate();
  const onNavigate = useTabNavigate();
  const { me, setMe, config } = useSession();
  const [saving, setSaving] = useState<'MARKETING' | 'UBICACION'>();
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string }>();
  const state = (p: string) => me?.consents.find((c) => c.purpose === p);

  const toggle = async (purpose: 'MARKETING' | 'UBICACION', granted: boolean) => {
    if (!me) return;
    setSaving(purpose);
    try {
      const consents = await identityApi.recordConsent({ purpose, granted, noticeVersion: config.legalNoticeVersion, source: 'perfil' });
      setMe({ ...me, consents });
      setNotice({ tone: 'success', message: 'Guardamos tu decisión.' });
    } catch {
      setNotice({ tone: 'error', message: 'No pudimos guardar el cambio. Intenta de nuevo.' });
    } finally {
      setSaving(undefined);
    }
  };

  const terms = state('TERMINOS_Y_PRIVACIDAD');
  return (
    <>
      {notice && (
        <div className="fixed top-2 inset-x-2 z-50 max-w-md mx-auto">
          <Toast tone={notice.tone} message={notice.message} onDismiss={() => setNotice(undefined)} />
        </div>
      )}
      <ConsentsView
        terms={{ granted: terms?.granted ?? false, noticeVersion: terms?.noticeVersion ?? undefined, updatedLabel: dateLabel(terms?.updatedAt ?? null) }}
        marketing={{ granted: state('MARKETING')?.granted ?? false }}
        location={{ granted: state('UBICACION')?.granted ?? false }}
        saving={saving}
        onToggle={(p, v) => void toggle(p, v)}
        termsHref="/legal/terminos"
        privacyHref="/legal/privacidad"
        onRight={(r) => (r === 'delete' ? navigate('/perfil?eliminar=1') : r === 'correct' ? navigate('/perfil') : navigate('/legal/derechos'))}
        onBack={() => navigate(-1)}
        onNavigate={onNavigate}
      />
    </>
  );
}
