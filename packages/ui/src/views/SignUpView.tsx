import { AuthButton, type AuthProvider } from '../components/AuthButton.tsx';
import { Button } from '../components/Button.tsx';
import { Checkbox } from '../components/Checkbox.tsx';
import { Icon } from '../components/Icon.tsx';
import { LegalNotice } from '../components/LegalNotice.tsx';
import { TopBar } from '../components/TopBar.tsx';
import { formatNumber } from '../lib/format.ts';

/**
 * Vista pura: login progresivo y consentimientos.
 * Diseño: Stitch "13 · Guarda tu progreso". Fuentes: Instrucciones §3.1, §7; Guía Técnica §5.2 (alias temporal,
 * login solo cuando hace falta, marketing separado y opcional), §9.3; Guía Gamificación §7.3.
 *
 * - Los términos/privacidad son requisito funcional; el marketing es opcional y empieza desmarcado (lo controla el contenedor).
 * - "Seguir sin registrarme" siempre disponible: no bloquear funciones básicas por rechazar marketing.
 */
export interface SignUpViewProps {
  tempAlias: string;
  /** Lo que se conservará al crear la cuenta (separado por ruta). */
  pending: { points: number; xp: number; badges: number };
  currencyName?: string;
  termsAccepted: boolean;
  onTermsAcceptedChange: (v: boolean) => void;
  marketingOptIn: boolean;
  onMarketingOptInChange: (v: boolean) => void;
  termsHref: string;
  privacyHref: string;
  /** Proveedor en curso (deshabilita los demás). */
  busyProvider?: AuthProvider;
  /** Proveedores habilitados por la plataforma; los demás se muestran como "próximamente". */
  availableProviders?: AuthProvider[];
  onAuth: (provider: AuthProvider) => void;
  onSkip: () => void;
  onBack: () => void;
}

export function SignUpView({
  tempAlias,
  pending,
  currencyName = 'Puntos ILC',
  termsAccepted,
  onTermsAcceptedChange,
  marketingOptIn,
  onMarketingOptInChange,
  termsHref,
  privacyHref,
  busyProvider,
  availableProviders = ['google', 'apple', 'whatsapp', 'email'],
  onAuth,
  onSkip,
  onBack,
}: SignUpViewProps) {
  const providers: AuthProvider[] = ['google', 'apple', 'whatsapp'];
  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <div className="w-full max-w-md mx-auto flex flex-col min-h-dvh bg-surface-container-lowest">
        <TopBar onBack={onBack} title={<span className="font-headline-md text-headline-md text-primary">ILC Origen</span>} />
        <main className="flex-1 px-4 pt-4 pb-6 space-y-5">
          <div className="space-y-1.5">
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Guarda tu progreso</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Hasta ahora juegas como <strong className="text-on-surface">“{tempAlias}”</strong> (alias temporal). Crea tu cuenta para conservar tus{' '}
              {currencyName} e insignias en cualquier dispositivo y poder canjear.
            </p>
          </div>

          <section aria-label="Lo que vas a conservar" className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-primary/40 bg-surface-container">
              <p className="font-label-sm text-[11px] uppercase text-primary">Ruta A</p>
              <p className="font-label-lg text-[15px] text-on-surface tabular-nums">
                {formatNumber(pending.points)} {currencyName}
              </p>
            </div>
            <div className="p-3 rounded-xl border border-secondary/40 bg-surface-container-low">
              <p className="font-label-sm text-[11px] uppercase text-secondary">Ruta B</p>
              <p className="font-label-lg text-[15px] text-on-surface tabular-nums">
                {formatNumber(pending.xp)} XP · {pending.badges} {pending.badges === 1 ? 'insignia' : 'insignias'}
              </p>
            </div>
          </section>

          <fieldset className="space-y-2">
            <legend className="font-title-md text-title-md text-on-surface mb-1">Tus autorizaciones</legend>
            <Checkbox checked={termsAccepted} onChange={onTermsAcceptedChange} label="Acepto los Términos y el Aviso de privacidad para usar la plataforma." />
            <p className="flex gap-4 pl-1">
              <a href={termsHref} className="inline-flex items-center min-h-12 font-label-lg text-[13px] text-primary underline underline-offset-4">
                Términos
              </a>
              <a href={privacyHref} className="inline-flex items-center min-h-12 font-label-lg text-[13px] text-primary underline underline-offset-4">
                Aviso de privacidad
              </a>
            </p>
            <Checkbox
              checked={marketingOptIn}
              onChange={onMarketingOptInChange}
              label="Quiero recibir novedades y promociones de ILC y sus marcas (opcional)."
            />
            <p className="pl-1 font-body-md text-[12px] text-on-surface-variant">Puedes cambiarlo cuando quieras en tu perfil.</p>
          </fieldset>

          <section aria-label="Elige cómo crear tu cuenta" className="space-y-2">
            {providers.map((p) => (
              <AuthButton
                key={p}
                provider={p}
                comingSoon={!availableProviders.includes(p)}
                disabled={!termsAccepted || !availableProviders.includes(p) || (busyProvider !== undefined && busyProvider !== p)}
                onSelect={() => onAuth(p)}
              />
            ))}
            {availableProviders.includes('email') && (
              <Button variant="text" leadingIcon="mail" disabled={!termsAccepted} onClick={() => onAuth('email')}>
                Prefiero usar mi correo
              </Button>
            )}
            {!termsAccepted && <p className="font-body-md text-[12px] text-on-surface-variant text-center">Acepta los términos para crear tu cuenta.</p>}
          </section>

          <Button variant="secondary" leadingIcon="sports_esports" onClick={onSkip}>
            Seguir jugando sin registrarme
          </Button>
          <p className="flex items-start justify-center gap-1.5 font-body-md text-[12px] text-on-surface-variant text-center">
            <Icon name="verified_user" className="text-[16px] text-secondary" />
            Solo pedimos los datos necesarios. Nunca accedemos a tus contactos.
          </p>
        </main>
        <LegalNotice />
      </div>
    </div>
  );
}
