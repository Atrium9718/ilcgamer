/**
 * Protocolo del Game SDK v1 (Guía Técnica §5.4: "SDK/bridge definido: inicio, progreso, fin, error").
 *
 * Principios:
 * - El módulo NUNCA le dice a la PWA cuánto ganó: solo avisa que terminó. El resultado lo confirma el servidor del
 *   proveedor llamando a la API de ILC con una firma (el cliente no puede autoasignarse recompensa).
 * - Todo mensaje es un objeto plano `{ ilc: 1, type, … }` que se valida estrictamente; lo demás se ignora.
 * - Nunca se usa `targetOrigin: "*"`.
 */
export const PROTOCOL_VERSION = 1;

export type HostMessage = { ilc: 1; type: 'init'; missionId: string; locale: string; reducedMotion: boolean };

export type ModuleMessage =
  | { ilc: 1; type: 'ready' }
  | { ilc: 1; type: 'progress'; percent: number }
  | { ilc: 1; type: 'finish' }
  | { ilc: 1; type: 'error'; code: string; message?: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const exactKeys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every((k) => allowed.includes(k));
const ERROR_CODE = /^[a-z0-9_]{1,40}$/;
const MISSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valida un mensaje que llega del módulo. Devuelve null ante cualquier cosa fuera del contrato. */
export function parseModuleMessage(data: unknown): ModuleMessage | null {
  if (!isRecord(data) || data.ilc !== PROTOCOL_VERSION) return null;
  switch (data.type) {
    case 'ready':
    case 'finish':
      return exactKeys(data, ['ilc', 'type']) ? ({ ilc: 1, type: data.type } as ModuleMessage) : null;
    case 'progress':
      return exactKeys(data, ['ilc', 'type', 'percent']) && typeof data.percent === 'number' && Number.isFinite(data.percent)
        ? { ilc: 1, type: 'progress', percent: Math.min(100, Math.max(0, Math.round(data.percent))) }
        : null;
    case 'error':
      if (!exactKeys(data, ['ilc', 'type', 'code', 'message']) || typeof data.code !== 'string' || !ERROR_CODE.test(data.code)) return null;
      if (data.message !== undefined && (typeof data.message !== 'string' || data.message.length > 200)) return null;
      return { ilc: 1, type: 'error', code: data.code, ...(data.message !== undefined ? { message: data.message as string } : {}) };
    default:
      return null;
  }
}

/** Valida un mensaje que llega de la PWA (lo usa el módulo). */
export function parseHostMessage(data: unknown): HostMessage | null {
  if (!isRecord(data) || data.ilc !== PROTOCOL_VERSION || data.type !== 'init') return null;
  if (!exactKeys(data, ['ilc', 'type', 'missionId', 'locale', 'reducedMotion'])) return null;
  if (typeof data.missionId !== 'string' || !MISSION_ID.test(data.missionId)) return null;
  if (typeof data.locale !== 'string' || data.locale.length > 16 || typeof data.reducedMotion !== 'boolean') return null;
  return { ilc: 1, type: 'init', missionId: data.missionId, locale: data.locale, reducedMotion: data.reducedMotion };
}

/**
 * `sandbox` del iframe. Sin `allow-top-navigation`, `allow-popups`, `allow-forms` ni `allow-modals`: el módulo
 * no puede redirigir la PWA ni abrir ventanas. `allow-same-origin` solo es seguro porque la dirección del módulo
 * DEBE ser de otro origen que la PWA (ver `assertEmbeddable`): así conserva su propio origen y la PWA puede
 * validar de dónde vienen sus mensajes, pero no puede tocar las cookies ni el almacenamiento de la PWA.
 */
export const IFRAME_SANDBOX = 'allow-scripts allow-same-origin';

/** Permisos del dispositivo: ninguno salvo los que el manifiesto pidió y Privacidad aprobó. */
export function iframeAllow(permissions: readonly string[]): string {
  const map: Record<string, string> = { camera: 'camera', microphone: 'microphone', geolocation: 'geolocation' };
  return permissions
    .map((p) => map[p])
    .filter(Boolean)
    .join('; ');
}

/** Comprobaciones previas a incrustar un módulo de proveedor. Lanza un Error con el motivo. */
export function assertEmbeddable(entryUrl: string, allowedOrigin: string, hostOrigin: string): URL {
  let url: URL;
  try {
    url = new URL(entryUrl);
  } catch {
    throw new Error('La dirección del módulo no es válida.');
  }
  if (url.protocol !== 'https:') throw new Error('El módulo debe servirse por HTTPS.');
  if (url.username || url.password) throw new Error('La dirección del módulo no puede incluir credenciales.');
  if (url.origin !== allowedOrigin) throw new Error('La dirección del módulo no pertenece al origen permitido.');
  if (url.origin === hostOrigin) throw new Error('Un módulo de proveedor no puede ser del mismo origen que la aplicación.');
  return url;
}
