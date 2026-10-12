import { AgeGateView, type DateParts } from '@ilc/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { checkBirthDate } from '../lib/age.ts';
import { ApiRequestError } from '../lib/api.ts';
import { campaignSlugFromPath } from '../lib/campaign.ts';
import { identityApi } from '../lib/identity.ts';
import { useSession } from '../lib/session.tsx';
import { KEYS, readLocal } from '../lib/storage.ts';

const LINKS = [
  { label: 'Términos y condiciones', href: '/legal/terminos' },
  { label: 'Política de privacidad', href: '/legal/privacidad' },
  { label: 'Consumo responsable', href: '/legal/consumo-responsable' },
];

const pad = (v: string) => v.padStart(2, '0');

/**
 * Control +18 contra la API: el servidor calcula la edad, registra solo el resultado y abre una cuenta
 * temporal con alias (Guía Técnica §5.2). La validación local solo mejora la experiencia.
 */
export function AgeGateRoute() {
  const navigate = useNavigate();
  const { setMe } = useSession();
  const [birthDate, setBirthDate] = useState<DateParts>({ day: '', month: '', year: '' });
  const [confirmed, setConfirmed] = useState(false);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string>();
  const check = checkBirthDate(birthDate);

  const localError = !touched
    ? undefined
    : check.kind === 'invalid'
      ? 'La fecha no es válida. Revisa el día, el mes y el año.'
      : check.kind === 'underage'
        ? 'Este contenido es solo para mayores de 18 años.'
        : undefined;

  const submit = async () => {
    setSubmitting(true);
    setServerError(undefined);
    try {
      const returnTo = readLocal<string>(KEYS.returnTo, '/', 'session');
      // Una campaña puede exigir más de 18 años: el servidor aplica su edad mínima (Guía Técnica §5.1).
      const campaignSlug = campaignSlugFromPath(returnTo);
      const me = await identityApi.ageGate({
        birthDate: `${birthDate.year}-${pad(birthDate.month)}-${pad(birthDate.day)}`,
        declaration: true,
        ...(campaignSlug ? { campaignSlug } : {}),
      });
      setMe(me);
      navigate(returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/', { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'AGE_REQUIREMENT_NOT_MET') navigate('/menor-de-edad', { replace: true });
      else setServerError(err instanceof ApiRequestError ? err.message : 'No pudimos continuar. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AgeGateView
      birthDate={birthDate}
      onBirthDateChange={(v) => {
        setBirthDate(v);
        setTouched(v.year.length === 4);
        setServerError(undefined);
      }}
      confirmed={confirmed}
      onConfirmedChange={setConfirmed}
      canSubmit={confirmed && check.kind === 'ok'}
      submitting={submitting}
      error={serverError ?? localError}
      onSubmit={submit}
      onUnderage={() => navigate('/menor-de-edad', { replace: true })}
      privacyHref="/legal/privacidad"
      termsHref="/legal/terminos"
      footerLinks={LINKS}
    />
  );
}

export function UnderageRoute() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-3 px-6 text-center bg-surface">
      <h1 className="font-headline-lg text-headline-lg text-primary">Vuelve cuando seas mayor de edad</h1>
      <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
        Este sitio es solo para personas mayores de 18 años. Gracias por tu honestidad.
      </p>
    </main>
  );
}
