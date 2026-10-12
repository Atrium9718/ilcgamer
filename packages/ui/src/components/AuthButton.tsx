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
export function AuthButton({ provider, onSelect, disabled }: { provider: AuthProvider; onSelect: () => void; disabled?: boolean }) {
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
      <Icon name="arrow_forward" className="text-[20px] text-on-surface-variant" />
    </button>
  );
}
