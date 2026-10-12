import { ConsoleLoginView } from '@ilc/ui';
import { useState } from 'react';
import { adminApi } from '../lib/adminApi.ts';
import { ApiRequestError } from '../lib/api.ts';
import { errorMessage, useSession } from '../lib/session.tsx';

/** Ingreso del personal con código al correo. Solo entra quien ya tiene un rol de consola asignado por TI. */
export function Login() {
  const { setMe } = useSession();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [masked, setMasked] = useState<string>();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setSubmitting(true);
    setError(undefined);
    try {
      await fn();
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'AGE_GATE_REQUIRED') setError('Este correo no tiene acceso a la consola. Solicítalo a TI.');
      else setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ConsoleLoginView
      step={step}
      email={email}
      onEmailChange={setEmail}
      code={code}
      onCodeChange={setCode}
      maskedEmail={masked}
      error={error}
      submitting={submitting}
      onRequest={() =>
        run(async () => {
          const res = await adminApi.requestOtp(email.trim());
          setMasked(res.maskedDestination);
          setCode('');
          setStep('code');
        })
      }
      onVerify={() =>
        run(async () => {
          const me = await adminApi.verifyOtp(email.trim(), code);
          setMe(me);
        })
      }
      onBack={() => {
        setStep('email');
        setError(undefined);
      }}
    />
  );
}
