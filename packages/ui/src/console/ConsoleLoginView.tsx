import type { FormEvent } from 'react';
import { Button } from '../components/Button.tsx';
import { PinInput } from '../components/PinInput.tsx';
import { SealMark } from '../components/SealMark.tsx';
import { TextField } from '../components/TextField.tsx';

/** Vista pura: ingreso del personal a la consola con código enviado al correo corporativo. */
export interface ConsoleLoginViewProps {
  step: 'email' | 'code';
  email: string;
  onEmailChange: (v: string) => void;
  code: string;
  onCodeChange: (v: string) => void;
  maskedEmail?: string;
  error?: string;
  submitting?: boolean;
  onRequest: () => void;
  onVerify: () => void;
  onBack: () => void;
}

export function ConsoleLoginView(p: ConsoleLoginViewProps) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (p.submitting) return;
    if (p.step === 'email') p.onRequest();
    else if (p.code.length === 6) p.onVerify();
  };
  return (
    <main className="min-h-dvh flex items-center justify-center bg-surface px-4">
      <form onSubmit={submit} noValidate className="w-full max-w-md p-8 rounded-3xl border border-outline-variant bg-surface-container-lowest space-y-6">
        <div className="flex items-center gap-3">
          <SealMark size="lg" className="w-12 h-12 shrink-0" />
          <div>
            <h1 className="font-headline-lg text-[28px] leading-8 text-on-surface">Consola ILC Origen</h1>
            <p className="font-body-md text-[13px] text-on-surface-variant">Acceso exclusivo para personal autorizado</p>
          </div>
        </div>
        {p.step === 'email' ? (
          <TextField
            label="Correo corporativo"
            type="email"
            autoComplete="email"
            value={p.email}
            onChange={p.onEmailChange}
            placeholder="nombre@ilc.com.co"
            error={p.error}
          />
        ) : (
          <div className="space-y-2">
            <p className="font-body-md text-body-md text-on-surface-variant">
              Escribe el código de 6 dígitos que enviamos a <strong className="text-on-surface">{p.maskedEmail}</strong>.
            </p>
            <PinInput label="Código de acceso" value={p.code} onChange={p.onCodeChange} length={6} size="compact" error={p.error} disabled={p.submitting} />
            <button type="button" onClick={p.onBack} className="min-h-11 font-label-lg text-[14px] text-primary">
              Usar otro correo
            </button>
          </div>
        )}
        <Button type="submit" loading={p.submitting} disabled={p.step === 'email' ? p.email.trim().length < 5 : p.code.length !== 6}>
          {p.step === 'email' ? 'Enviar código' : 'Ingresar'}
        </Button>
        <p className="font-body-md text-[12px] text-on-surface-variant">Tu actividad en la consola queda registrada en la bitácora de auditoría.</p>
      </form>
    </main>
  );
}
