import type { FormEvent } from 'react';
import { Button } from '../components/Button.tsx';
import { formatClock } from '../components/EnergyMeter.tsx';
import { Icon } from '../components/Icon.tsx';
import { LegalNotice } from '../components/LegalNotice.tsx';
import { PinInput } from '../components/PinInput.tsx';
import { TextField } from '../components/TextField.tsx';
import { TopBar } from '../components/TopBar.tsx';

export type OtpChannelView = 'whatsapp' | 'sms' | 'email';
export type OtpStep = 'destination' | 'code';

const CHANNEL_LABEL: Record<OtpChannelView, string> = { whatsapp: 'WhatsApp', sms: 'SMS', email: 'correo' };

/**
 * Vista pura: acceso por código de un solo uso.
 * Diseño: Stitch "14 · Verificación por código". Fuentes: Instrucciones §3.1; Guía Técnica §5.2, §9.1.
 * Usa el teclado numérico nativo con autocompletado de código (one-time-code) en lugar de un teclado en pantalla.
 */
export interface OtpViewProps {
  step: OtpStep;
  channel: OtpChannelView;
  destination: string;
  onDestinationChange: (v: string) => void;
  destinationError?: string;
  maskedDestination?: string;
  code: string;
  onCodeChange: (v: string) => void;
  codeError?: string;
  expiresInSeconds?: number;
  resendInSeconds?: number;
  submitting?: boolean;
  onRequest: () => void;
  onVerify: () => void;
  onResend: () => void;
  onChangeDestination: () => void;
  /** Canal alternativo ofrecido (p. ej. SMS si falla WhatsApp). */
  alternativeChannel?: OtpChannelView;
  onUseAlternative?: () => void;
  onBack: () => void;
}

export function OtpView(props: OtpViewProps) {
  const { step, channel, submitting = false, onBack } = props;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (step === 'destination') props.onRequest();
    else if (props.code.length === 6) props.onVerify();
  };
  const isEmail = channel === 'email';

  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <form onSubmit={submit} noValidate className="w-full max-w-md mx-auto flex flex-col min-h-dvh bg-surface-container-lowest">
        <TopBar onBack={onBack} title={isEmail ? 'Verifica tu correo' : 'Verifica tu número'} />
        <main className="flex-1 px-4 pt-4 pb-6 space-y-5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-secondary/40 font-label-sm text-[11px] uppercase text-secondary">
            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-secondary" />
            Paso {step === 'destination' ? 1 : 2} de 2
          </span>

          {step === 'destination' ? (
            <>
              <div className="space-y-1.5">
                <h1 className="font-headline-lg text-headline-lg text-on-surface">{isEmail ? 'Escribe tu correo' : 'Escribe tu celular'}</h1>
                <p className="font-body-md text-body-md text-on-surface-variant">Te enviaremos un código de 6 dígitos por {CHANNEL_LABEL[channel]}.</p>
              </div>
              <TextField
                label={isEmail ? 'Correo electrónico' : 'Celular'}
                type={isEmail ? 'email' : 'tel'}
                inputMode={isEmail ? 'email' : 'tel'}
                autoComplete={isEmail ? 'email' : 'tel-national'}
                placeholder={isEmail ? 'nombre@correo.com' : '300 123 4567'}
                value={props.destination}
                onChange={props.onDestinationChange}
                error={props.destinationError}
                hint={isEmail ? undefined : 'Celular de Colombia (+57).'}
              />
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <h1 className="font-headline-lg text-headline-lg text-on-surface">Escribe el código</h1>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Te enviamos un código de 6 dígitos por {CHANNEL_LABEL[channel]} al{' '}
                  <strong className="text-on-surface tabular-nums">{props.maskedDestination}</strong>.
                </p>
                <button
                  type="button"
                  onClick={props.onChangeDestination}
                  className="inline-flex items-center gap-1 min-h-12 font-label-lg text-label-lg text-primary"
                >
                  {isEmail ? 'Cambiar correo' : 'Cambiar número'}
                  <Icon name="edit" className="text-[18px]" />
                </button>
              </div>
              <PinInput
                label="Código de verificación"
                value={props.code}
                onChange={props.onCodeChange}
                length={6}
                size="compact"
                error={props.codeError}
                disabled={submitting}
              />
              <div className="flex flex-col items-center gap-1 font-body-md text-[13px] text-on-surface-variant tabular-nums">
                {props.expiresInSeconds !== undefined && (
                  <p className="flex items-center gap-1">
                    <Icon name="timer" className="text-[18px]" />
                    {props.expiresInSeconds > 0 ? (
                      <>
                        El código vence en <strong className="text-on-surface">{formatClock(props.expiresInSeconds)}</strong>
                      </>
                    ) : (
                      'El código venció. Pide uno nuevo.'
                    )}
                  </p>
                )}
                <button
                  type="button"
                  disabled={(props.resendInSeconds ?? 0) > 0 || submitting}
                  onClick={props.onResend}
                  className="min-h-12 px-3 font-label-lg text-[14px] text-primary disabled:text-on-surface-variant"
                >
                  {(props.resendInSeconds ?? 0) > 0 ? `Reenviar código en ${formatClock(props.resendInSeconds ?? 0)}` : 'Reenviar código'}
                </button>
                {props.alternativeChannel && props.onUseAlternative && (
                  <button
                    type="button"
                    onClick={props.onUseAlternative}
                    className="inline-flex items-center gap-1 min-h-12 px-3 font-label-lg text-[14px] text-secondary"
                  >
                    <Icon name="sms" className="text-[18px]" />
                    Prefiero recibirlo por {CHANNEL_LABEL[props.alternativeChannel]}
                  </button>
                )}
              </div>
            </>
          )}

          <p className="flex items-start gap-2 p-3 rounded-xl border border-outline-variant bg-surface-container-low font-body-md text-[13px] text-on-surface-variant">
            <Icon name="shield" className="text-[20px] text-secondary" />
            {isEmail
              ? 'Usamos tu correo solo para proteger tu cuenta. No lo verá nadie más en El Parche.'
              : 'Usamos tu número solo para proteger tu cuenta. No lo verá nadie más en El Parche.'}
          </p>
        </main>
        <div className="sticky bottom-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button type="submit" loading={submitting} disabled={step === 'code' ? props.code.length !== 6 : props.destination.trim().length < 5}>
            {step === 'destination' ? 'Enviar código' : 'Verificar'}
          </Button>
        </div>
        <LegalNotice />
      </form>
    </div>
  );
}
