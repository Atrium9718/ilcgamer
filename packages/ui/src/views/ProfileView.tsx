import { BottomNav, type NavTab } from '../components/BottomNav.tsx';
import { Button } from '../components/Button.tsx';
import { Icon } from '../components/Icon.tsx';
import { type SettingsItem, SettingsList } from '../components/SettingsList.tsx';
import { TopBar } from '../components/TopBar.tsx';

/**
 * Vista pura: perfil, referidos y privacidad.
 * Diseño: Stitch "11 · Perfil". Fuentes: Instrucciones §3.1, §8; Guía Técnica §5.2, §5.10, §9.3.
 * Sin acceso a contactos: compartir usa el menú nativo del sistema.
 */
export interface ProfileViewProps {
  alias: string;
  verified: boolean;
  referral: { code: string; rewardText: string; joined: number };
  marketingOptIn: boolean;
  onEdit: () => void;
  onCopyCode: () => void;
  onShareLink: () => void;
  onShowQr: () => void;
  onOpenSetting: (id: string) => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
  onNavigate: (tab: NavTab) => void;
}

export function ProfileView({ alias, verified, referral, marketingOptIn, onEdit, onCopyCode, onShareLink, onShowQr, onOpenSetting, onLogout, onDeleteAccount, onNavigate }: ProfileViewProps) {
  const initials = alias.slice(0, 2).toUpperCase();
  const settings: SettingsItem[] = [
    { id: 'datos', label: 'Mis datos', icon: 'badge' },
    { id: 'consentimientos', label: 'Consentimientos y comunicaciones', icon: 'verified_user', value: `Marketing: ${marketingOptIn ? 'activado' : 'desactivado'}` },
    { id: 'privacidad', label: 'Aviso de privacidad', icon: 'policy' },
    { id: 'terminos', label: 'Términos y condiciones', icon: 'gavel' },
    { id: 'consumo-responsable', label: 'Consumo responsable', icon: 'volunteer_activism' },
    { id: 'ayuda', label: 'Ayuda y soporte', icon: 'support_agent' },
  ].map((s) => ({ ...s, onSelect: () => onOpenSetting(s.id) }));

  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <div className="w-full max-w-md mx-auto flex flex-col min-h-dvh bg-surface-container-lowest">
        <TopBar title={<span className="font-headline-md text-headline-md text-primary">Perfil</span>} />
        <main className="flex-1 px-4 pt-4 pb-6 space-y-5">
          <section aria-label="Tu cuenta" className="flex items-center gap-3 p-4 rounded-2xl border border-outline-variant bg-surface-container-low">
            <span aria-hidden="true" className="w-16 h-16 rounded-full p-1 border border-primary/50">
              <span className="w-full h-full rounded-full border-2 border-primary-container bg-surface-container-high flex items-center justify-center font-headline-md text-[22px] text-primary">{initials}</span>
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-headline-md text-headline-md text-on-surface truncate">{alias}</p>
              {verified && (
                <p className="flex items-center gap-1 font-body-md text-[13px] text-secondary">
                  <Icon name="verified" filled className="text-[16px]" />
                  Cuenta verificada · mayor de 18
                </p>
              )}
            </div>
            <Button variant="secondary" fullWidth={false} onClick={onEdit} className="h-12 px-4">
              Editar
            </Button>
          </section>

          <section aria-labelledby="invita" className="p-4 rounded-2xl border border-primary/40 bg-surface-container space-y-3">
            <h2 id="invita" className="font-title-md text-title-md text-primary">
              Invita a tu gente
            </h2>
            <div className="flex items-center gap-2">
              <p className="flex-1 font-numeric-xl text-[26px] tracking-widest text-on-surface tabular-nums">{referral.code}</p>
              <button type="button" aria-label="Copiar código" onClick={onCopyCode} className="w-12 h-12 rounded-xl border border-outline-variant flex items-center justify-center text-on-surface hover:border-primary">
                <Icon name="content_copy" className="text-[22px]" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" leadingIcon="share" onClick={onShareLink} className="h-12">
                Compartir enlace
              </Button>
              <Button variant="secondary" leadingIcon="qr_code_2" onClick={onShowQr} className="h-12">
                Mostrar mi QR
              </Button>
            </div>
            <p className="font-body-md text-[13px] text-on-surface-variant">{referral.rewardText}</p>
            <p className="font-label-lg text-[13px] text-secondary tabular-nums">
              {referral.joined} {referral.joined === 1 ? 'invitado se unió' : 'invitados se unieron'}
            </p>
          </section>

          <SettingsList label="Ajustes de la cuenta" items={settings} />

          <div className="flex flex-col items-center gap-1 pt-2">
            <button type="button" onClick={onLogout} className="min-h-12 px-4 font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface">
              Cerrar sesión
            </button>
            <button type="button" onClick={onDeleteAccount} className="min-h-12 px-4 font-label-lg text-label-lg text-error hover:underline">
              Eliminar mi cuenta
            </button>
          </div>
        </main>
        <BottomNav active="perfil" onNavigate={onNavigate} />
      </div>
    </div>
  );
}
