import { AgeGateView, type DateParts } from '@ilc/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { checkBirthDate } from '../lib/age.ts';
import { KEYS, readLocal, writeLocal } from '../lib/storage.ts';
import type { AgeGateResult } from './shell.tsx';

const LINKS = [
  { label: 'Términos y condiciones', href: '/legal/terminos' },
  { label: 'Política de privacidad', href: '/legal/privacidad' },
  { label: 'Consumo responsable', href: '/legal/consumo-responsable' },
];

/**
 * Control +18. Guarda solo el resultado (no la fecha) en esta pestaña; el Paso 4 lo registra en servidor
 * con el mecanismo aprobado por campaña (Guía Técnica §5.2: no almacenar fecha de nacimiento completa).
 */
export function AgeGateRoute() {
  const navigate = useNavigate();
  const [birthDate, setBirthDate] = useState<DateParts>({ day: '', month: '', year: '' });
  const [confirmed, setConfirmed] = useState(false);
  const [touched, setTouched] = useState(false);
  const check = checkBirthDate(birthDate);

  const error = !touched
    ? undefined
    : check.kind === 'invalid'
      ? 'La fecha no es válida. Revisa el día, el mes y el año.'
      : check.kind === 'underage'
        ? 'Este contenido es solo para mayores de 18 años.'
        : undefined;

  return (
    <AgeGateView
      birthDate={birthDate}
      onBirthDateChange={(v) => {
        setBirthDate(v);
        setTouched(v.year.length === 4);
      }}
      confirmed={confirmed}
      onConfirmedChange={setConfirmed}
      canSubmit={confirmed && check.kind === 'ok'}
      error={error}
      onSubmit={() => {
        const result: AgeGateResult = { passedAt: new Date().toISOString(), method: 'fecha_y_declaracion' };
        writeLocal(KEYS.ageGate, result, 'session');
        const returnTo = readLocal<string>(KEYS.returnTo, '/', 'session');
        navigate(returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/', { replace: true });
      }}
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
