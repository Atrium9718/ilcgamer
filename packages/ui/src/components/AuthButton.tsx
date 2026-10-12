import { Icon } from './Icon.tsx';

export type AuthProvider = 'google' | 'apple' | 'whatsapp' | 'email';

const PROVIDER: Record<AuthProvider, { label: string; icon: string }> = {
  google: { label: 'Continuar con Google', icon: 'account_circle' },
  apple: { label: 'Continuar con Apple', icon: 'phone_iphone' },
  whatsapp: { label: 'Recibir código por WhatsApp', icon: 'chat' },
  email: { label: 'Continuar con mi correo', icon: 'mail' },
};

/**
 * Botón de acceso. Marcador: al integrar cada proveedor se usarán sus botones oficiales
 * (lineamientos de marca de Google/Apple) — Guía Técnica §5.2.
 */
export function AuthButton({
  provider,
  onSelect,
  disabled,
  comingSoon,
}: {
  provider: AuthProvider;
  onSelect: () => void;
  disabled?: boolean;
  comingSoon?: boolean;
}) {
  const p = PROVIDER[provider];
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className="w-full h-14 flex items-center gap-3 px-4 rounded-xl border border-outline-variant bg-surface-container text-on-surface font-label-lg text-label-lg hover:border-primary/60 active:scale-[0.98] transition-all disabled:opacity-60"
    >
      <Icon name={p.icon} className="text-[24px] text-on-surface-variant" />
      <span className="flex-1 text-left">{p.label}</span>
      {comingSoon ? (
        <span className="px-2 py-0.5 rounded-full border border-outline-variant font-label-sm text-[10px] uppercase text-on-surface-variant">Próximamente</span>
      ) : (
        <Icon name="arrow_forward" className="text-[20px] text-on-surface-variant" />
      )}
    </button>
  );
}
