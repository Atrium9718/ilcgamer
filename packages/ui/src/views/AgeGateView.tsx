import type { FormEvent } from 'react';
import bosqueNiebla from '../assets/placeholders/bosque-niebla.jpg';
import { Button } from '../components/Button.tsx';
import { Checkbox } from '../components/Checkbox.tsx';
import { DateOfBirthInput, type DateParts } from '../components/DateOfBirthInput.tsx';
import { Icon } from '../components/Icon.tsx';
import { type LegalLink, LegalNotice } from '../components/LegalNotice.tsx';
import { SealMark } from '../components/SealMark.tsx';

/**
 * Vista pura del control de edad +18.
 * Diseño: Stitch "01 · Control de edad +18" (design/stitch-exports/01-age-gate).
 * Fuentes: Instrucciones §5 paso 3; Guía Técnica §5.2 (mecanismo configurable por campaña), §9.4.
 *
 * No calcula la edad ni decide el acceso: el contenedor valida y el servidor registra el resultado.
 */
export interface AgeGateViewProps {
  headline?: string;
  birthDate: DateParts;
  onBirthDateChange: (value: DateParts) => void;
  confirmed: boolean;
  onConfirmedChange: (value: boolean) => void;
  /** El contenedor lo habilita cuando la fecha es válida y la casilla está marcada. */
  canSubmit: boolean;
  submitting?: boolean;
  error?: string;
  onSubmit: () => void;
  onUnderage: () => void;
  onHelp?: () => void;
  backgroundImageUrl?: string;
  privacyHref: string;
  termsHref: string;
  footerLinks?: LegalLink[];
}

export function AgeGateView({
  headline = 'Hay historias que empiezan mucho antes de llegar a la botella.',
  birthDate,
  onBirthDateChange,
  confirmed,
  onConfirmedChange,
  canSubmit,
  submitting = false,
  error,
  onSubmit,
  onUnderage,
  onHelp,
  backgroundImageUrl = bosqueNiebla,
  privacyHref,
  termsHref,
  footerLinks = [],
}: AgeGateViewProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (canSubmit && !submitting) onSubmit();
  };

  return (
    <div className="relative min-h-dvh flex flex-col bg-background text-on-surface overflow-x-hidden">
      <div aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none">
        <img src={backgroundImageUrl} alt="" className="w-full h-full object-cover object-top opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-b from-surface-dim/75 via-surface-dim/90 to-surface-container-lowest" />
      </div>

      <header className="relative z-10 w-full bg-surface border-b border-outline-variant">
        <div className="flex justify-between items-center w-full px-4 h-16 max-w-lg mx-auto">
          <span className="font-headline-md text-headline-md tracking-wider text-primary uppercase">ILC Origen</span>
          {onHelp && (
            <button
              type="button"
              aria-label="Ayuda"
              onClick={onHelp}
              className="w-12 h-12 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high active:scale-95"
            >
              <Icon name="help_outline" className="text-[22px]" />
            </button>
          )}
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-6 max-w-lg mx-auto w-full">
        <div className="mb-5 flex flex-col items-center">
          <SealMark />
          <span className="mt-2 font-label-sm text-label-sm text-secondary uppercase">Industria Licorera de Caldas</span>
        </div>

        <div className="text-center space-y-2 mb-6 max-w-md">
          <h1 className="font-headline-lg text-headline-lg text-primary">{headline}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">Para continuar confirma que eres mayor de edad.</p>
        </div>

        <div className="w-full bg-surface-container-low/90 backdrop-blur-md rounded-xl p-5 border border-outline-variant shadow-[0_8px_32px_rgba(0,0,0,0.55)]">
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <DateOfBirthInput value={birthDate} onChange={onBirthDateChange} error={error} />
            <Checkbox checked={confirmed} onChange={onConfirmedChange} label="Confirmo que soy mayor de 18 años" />
            <div className="space-y-3 pt-1">
              <Button type="submit" disabled={!canSubmit} loading={submitting} trailingIcon="arrow_forward">
                Continuar
              </Button>
              <Button variant="secondary" onClick={onUnderage} className="h-12 uppercase font-label-sm text-label-sm">
                Soy menor de edad
              </Button>
            </div>
          </form>
          <div className="mt-4 pt-3 border-t border-outline-variant flex justify-center items-center gap-4">
            <a
              href={privacyHref}
              className="inline-flex items-center min-h-12 font-label-lg text-[13px] text-on-surface-variant hover:text-primary hover:underline underline-offset-4"
            >
              Aviso de privacidad
            </a>
            <span aria-hidden="true" className="text-outline-variant">
              •
            </span>
            <a
              href={termsHref}
              className="inline-flex items-center min-h-12 font-label-lg text-[13px] text-on-surface-variant hover:text-primary hover:underline underline-offset-4"
            >
              Términos
            </a>
          </div>
        </div>
      </main>

      <LegalNotice showCompany links={footerLinks} className="relative z-10 bg-surface-container-lowest" />
    </div>
  );
}
