/**
 * Almacenamiento local tolerante a fallos (modo privado, sitio bloqueado). Solo para comodidades del
 * dispositivo; nada económico ni de identidad se confía al navegador (Guía Técnica §2.3.5).
 */
export function readLocal<T>(key: string, fallback: T, store: 'local' | 'session' = 'local'): T {
  try {
    const raw = (store === 'local' ? localStorage : sessionStorage).getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown, store: 'local' | 'session' = 'local'): void {
  try {
    (store === 'local' ? localStorage : sessionStorage).setItem(key, JSON.stringify(value));
  } catch {
    /* sin almacenamiento disponible: la app sigue funcionando */
  }
}

export const KEYS = {
  referral: 'ilc.referral',
  returnTo: 'ilc.returnTo',
  campaignTheme: 'ilc.campaignTheme',
  /** Campaña cuya edad mínima debe aplicar el próximo control de edad (p. ej. +21). */
  pendingCampaign: 'ilc.pendingCampaign',
  /** Prefijo de la clave de idempotencia de una reclamación en curso, por código. */
  claimKey: 'ilc.claimKey',
  /** Pantalla a la que se vuelve después de guardar la cuenta (p. ej. el código que se quería activar). */
  afterSignup: 'ilc.afterSignup',
  /** Parche activo en esta pestaña: una activación de botella recarga su energía (Instrucciones §5 paso 5). */
  activeParche: 'ilc.activeParche',
  /** Código del Staff que atendió la mesa (QR /s/:code); vale unas horas para la activación siguiente. */
  staff: 'ilc.staff',
} as const;

export function removeLocal(key: string, store: 'local' | 'session' = 'local'): void {
  try {
    (store === 'local' ? localStorage : sessionStorage).removeItem(key);
  } catch {
    /* sin almacenamiento disponible */
  }
}

const STAFF_TTL_MS = 6 * 3_600_000;

/** Código de Staff recordado, si sigue vigente (una noche de servicio). */
export function readStaffCode(now = Date.now()): string | undefined {
  const saved = readLocal<{ code: string; at: number } | null>(KEYS.staff, null, 'session');
  return saved && /^[0-9A-Z]{8}$/.test(saved.code) && now - saved.at < STAFF_TTL_MS ? saved.code : undefined;
}
