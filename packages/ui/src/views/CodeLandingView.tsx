import botellaBarrica from '../assets/placeholders/botella-barrica.jpg';
import { BrandChip } from '../components/BrandChip.tsx';
import { Button } from '../components/Button.tsx';
import { Icon } from '../components/Icon.tsx';
import { type LegalLink, LegalNotice } from '../components/LegalNotice.tsx';
import { RouteCard } from '../components/RouteCard.tsx';
import { SealMark } from '../components/SealMark.tsx';
import { type CodeStatus, VerificationSeal } from '../components/VerificationSeal.tsx';

/**
 * Vista pura de la landing tras escanear el QR de una botella.
 * Diseño: Stitch "02 · Landing tras escanear QR de botella" (design/stitch-exports/02-landing-codigo).
 * Fuentes: Instrucciones §4.2, §5 pasos 1-2, §13; Guía Técnica §2.2, §5.1, §5.6; Guía Gamificación §7.2, §8.
 *
 * Reglas que la vista respeta:
 * - Consultar el código no reclama nada; la acción de Ruta A es un paso explícito.
 * - Ruta B siempre disponible y sin exigir compra.
 * - Las acciones comerciales solo se muestran si el código está reconocido y la campaña lo permite.
 */
export interface CodeLandingViewProps {
  brandLabel: string;
  status: CodeStatus;
  productLabel?: string;
  heroImageUrl?: string;
  heroImageAlt?: string;
  /** Texto de Ruta A desde la campaña, ej. "+500 Puntos ILC". Omitir si la campaña no otorga puntos. */
  routeABadge?: string;
  /** El contenedor lo calcula: código reconocido + campaña activa + contexto elegible. */
  canActivate: boolean;
  /** Estado de la promoción de esta botella cuando no se puede activar (ya activada por ti, terminó…). */
  claimNotice?: string;
  /** Relato aprobado por la marca. Si no hay, se muestra el marcador. */
  originStory?: string;
  activating?: boolean;
  onBack: () => void;
  onExplainCode: () => void;
  onSelectRouteA: () => void;
  onSelectRouteB: () => void;
  onActivate: () => void;
  onJoinWithPin: () => void;
  footerLinks?: LegalLink[];
}

export function CodeLandingView({
  brandLabel,
  status,
  productLabel,
  heroImageUrl = botellaBarrica,
  heroImageAlt = 'Imagen ilustrativa del producto en el bosque de niebla',
  routeABadge,
  canActivate,
  claimNotice,
  originStory,
  activating = false,
  onBack,
  onExplainCode,
  onSelectRouteA,
  onSelectRouteB,
  onActivate,
  onJoinWithPin,
  footerLinks = [],
}: CodeLandingViewProps) {
  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <div className="w-full max-w-md mx-auto flex flex-col min-h-dvh bg-surface-container-lowest">
        <header className="sticky top-0 z-40 bg-surface-container-low/95 backdrop-blur-md border-b border-outline-variant px-4 h-14 flex items-center justify-between">
          <button
            type="button"
            aria-label="Volver"
            onClick={onBack}
            className="w-12 h-12 -ml-2 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-primary active:scale-95"
          >
            <Icon name="arrow_back" className="text-[20px]" />
          </button>
          <div className="flex items-center gap-2">
            <SealMark size="sm" />
            <BrandChip label={brandLabel} />
          </div>
          <span className="w-12" aria-hidden="true" />
        </header>

        <main className="flex-1 flex flex-col px-4 pt-3 pb-6">
          <section className="relative w-full rounded-2xl overflow-hidden aspect-[4/3] bg-surface-container-high border border-outline-variant shadow-md">
            <img src={heroImageUrl} alt={heroImageAlt} className="w-full h-full object-cover object-center" />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/20 to-transparent"
            />
          </section>

          <VerificationSeal status={status} productLabel={productLabel} onExplain={onExplainCode} className="mt-4" />
          {claimNotice && (
            <p
              role="status"
              className="mt-3 flex items-start gap-2 p-3 rounded-xl border border-outline-variant bg-surface-container font-body-md text-[14px] text-on-surface"
            >
              <Icon name="info" className="text-[20px] text-secondary" />
              {claimNotice}
            </p>
          )}

          <section className="mt-7" aria-labelledby="que-quieres-hacer">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 id="que-quieres-hacer" className="font-headline-md text-headline-md text-on-surface">
                ¿Qué quieres hacer?
              </h3>
              <span className="font-label-sm text-label-sm uppercase text-on-surface-variant">Elige tu senda</span>
            </div>
            <div className="flex flex-col gap-3.5">
              {canActivate && (
                <RouteCard
                  route="A"
                  title="Ruta A · Activa tu código"
                  description="Conoce tu beneficio y suma Puntos ILC. Revisa las reglas de la campaña."
                  badge={routeABadge}
                  footerLabel="Ver condiciones"
                  onSelect={onSelectRouteA}
                />
              )}
              <RouteCard
                route="B"
                title="Ruta B · Explora el origen"
                description="Resuelve la pista del bosque de niebla y gana insignias. No requiere compra."
                badge="Aventura y relatos"
                footerLabel="Relato interactivo"
                footerIcon="menu_book"
                onSelect={onSelectRouteB}
              />
            </div>
          </section>

          <section className="mt-6 p-3.5 rounded-xl bg-surface-container-low border border-outline-variant text-center">
            <p className="font-headline-md italic text-secondary text-[17px] leading-relaxed">
              «{originStory ?? 'Relato de origen pendiente de aprobación de marca'}»
            </p>
          </section>
        </main>

        <LegalNotice links={footerLinks} />

        <div className="sticky bottom-0 z-50 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant pt-3.5 px-4 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col gap-1">
            {canActivate && (
              <Button leadingIcon="lock_open" loading={activating} onClick={onActivate}>
                Activar código y crear mi Parche
              </Button>
            )}
            <Button variant="text" onClick={onJoinWithPin}>
              Unirme a un Parche con PIN
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
