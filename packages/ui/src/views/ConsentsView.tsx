import { BottomNav, type NavTab } from '../components/BottomNav.tsx';
import { Icon } from '../components/Icon.tsx';
import { type SettingsItem, SettingsList } from '../components/SettingsList.tsx';
import { Switch } from '../components/Switch.tsx';
import { TopBar } from '../components/TopBar.tsx';

export interface ConsentView {
  granted: boolean;
  /** Fecha legible de la última decisión, ej. "12 oct. 2026". */
  updatedLabel?: string;
  noticeVersion?: string;
}

/**
 * Vista pura: autorizaciones y derechos sobre los datos.
 * Diseño: Stitch "15 · Consentimientos". Fuentes: Guía Técnica §5.2, §9.3, §12.2; Ley 1581 de 2012.
 * Cada interruptor registra una decisión independiente; rechazar marketing o ubicación no limita la app.
 */
export interface ConsentsViewProps {
  terms: ConsentView;
  marketing: ConsentView;
  location: ConsentView;
  saving?: 'MARKETING' | 'UBICACION';
  onToggle: (purpose: 'MARKETING' | 'UBICACION', granted: boolean) => void;
  termsHref: string;
  privacyHref: string;
  onRight: (right: 'download' | 'correct' | 'delete') => void;
  onBack: () => void;
  onNavigate: (tab: NavTab) => void;
}

export function ConsentsView({ terms, marketing, location, saving, onToggle, termsHref, privacyHref, onRight, onBack, onNavigate }: ConsentsViewProps) {
  const rights: SettingsItem[] = [
    { id: 'download', label: 'Descargar mis datos', icon: 'download', onSelect: () => onRight('download') },
    { id: 'correct', label: 'Corregir mis datos', icon: 'edit_square', onSelect: () => onRight('correct') },
    { id: 'delete', label: 'Eliminar mi cuenta', icon: 'delete_forever', tone: 'danger', onSelect: () => onRight('delete') },
  ];
  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <div className="w-full max-w-md mx-auto flex flex-col min-h-dvh bg-surface-container-lowest">
        <TopBar onBack={onBack} title={<span className="font-headline-md text-headline-md text-primary">Tus autorizaciones</span>} />
        <main className="flex-1 px-4 pt-4 pb-6 space-y-5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-secondary/40 font-label-sm text-[11px] text-secondary">
            <Icon name="shield_lock" className="text-[14px]" />
            Habeas Data · Ley 1581 de 2012
          </span>
          <div className="space-y-1">
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Tú decides cómo usamos tus datos.</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">Puedes cambiar estas opciones cuando quieras.</p>
          </div>

          <section aria-labelledby="consent-terms" className="p-4 rounded-2xl border border-outline-variant bg-surface-container-low space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h2 id="consent-terms" className="flex items-center gap-2 font-title-md text-[16px] text-on-surface">
                <Icon name="verified" filled className="text-[20px] text-secondary" />
                Términos y aviso de privacidad
              </h2>
              <span className="shrink-0 px-2 py-0.5 rounded-full bg-secondary-container font-label-sm text-[10px] uppercase text-on-secondary-container">
                Necesario
              </span>
            </div>
            <p className="font-body-md text-[13px] text-on-surface-variant">
              {terms.granted
                ? `Versión ${terms.noticeVersion ?? '—'} · Aceptado el ${terms.updatedLabel ?? '—'}`
                : 'Aún no aceptado: se pide al crear tu cuenta.'}
            </p>
            <p className="flex flex-wrap gap-x-4">
              <a href={termsHref} className="inline-flex items-center min-h-12 font-label-lg text-[13px] text-primary underline underline-offset-4">
                Ver términos
              </a>
              <a href={privacyHref} className="inline-flex items-center min-h-12 font-label-lg text-[13px] text-primary underline underline-offset-4">
                Ver aviso de privacidad
              </a>
            </p>
          </section>

          <section className="p-4 rounded-2xl border border-outline-variant bg-surface-container-low">
            <Switch
              label="Novedades y promociones de ILC y sus marcas"
              description="Recibe invitaciones a experiencias y campañas. Si lo desactivas, todo sigue funcionando igual."
              checked={marketing.granted}
              disabled={saving !== undefined}
              onChange={(v) => onToggle('MARKETING', v)}
            />
          </section>
          <section className="p-4 rounded-2xl border border-outline-variant bg-surface-container-low">
            <Switch
              label="Ubicación aproximada"
              description="Solo para campañas que la necesiten, como actividades en tu ciudad. Nunca usamos GPS continuo."
              checked={location.granted}
              disabled={saving !== undefined}
              onChange={(v) => onToggle('UBICACION', v)}
            />
          </section>

          <section aria-labelledby="derechos" className="space-y-2">
            <h2 id="derechos" className="font-title-md text-title-md text-on-surface">
              Tus derechos sobre tus datos
            </h2>
            <p className="font-body-md text-[13px] text-on-surface-variant">
              Conoce, actualiza, rectifica o suprime tu información personal en cualquier momento.
            </p>
            <SettingsList label="Derechos sobre tus datos" items={rights} />
          </section>
        </main>
        <BottomNav active="perfil" onNavigate={onNavigate} />
      </div>
    </div>
  );
}
