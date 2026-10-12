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
} as const;
