import { type HostMessage, parseHostMessage } from './protocol.ts';

export interface GameClientOptions {
  /**
   * Origen de la aplicación de ILC que incrusta el juego (p. ej. https://app.ilc.com.co). Si no se indica se toma de
   * `location.ancestorOrigins` o de `document.referrer`; si no se puede determinar, no se envía nada (nunca "*").
   */
  hostOrigin?: string;
}

export interface GameClient {
  /** Avisa a la aplicación que el juego cargó. Responde con `init` (misión, idioma, movimiento reducido). */
  ready: () => Promise<HostMessage>;
  progress: (percent: number) => void;
  /** El juego terminó. No envía puntaje: el resultado lo confirma el servidor del proveedor con ILC. */
  finish: () => void;
  error: (code: string, message?: string) => void;
}

function detectHostOrigin(): string | undefined {
  const ancestor = (location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins?.[0];
  if (ancestor && ancestor !== 'null') return ancestor;
  try {
    return document.referrer ? new URL(document.referrer).origin : undefined;
  } catch {
    return undefined;
  }
}

/** Lado del juego (módulo del proveedor) del Game SDK. */
export function createGameClient(options: GameClientOptions = {}): GameClient {
  const hostOrigin = options.hostOrigin ?? detectHostOrigin();
  const post = (message: Record<string, unknown>) => {
    if (!hostOrigin) throw new Error('No se pudo determinar el origen de la aplicación anfitriona; indica `hostOrigin`.');
    window.parent.postMessage({ ilc: 1, ...message }, hostOrigin);
  };
  return {
    ready: () =>
      new Promise((resolve) => {
        const onMessage = (event: MessageEvent) => {
          if (event.source !== window.parent || event.origin !== hostOrigin) return;
          const init = parseHostMessage(event.data);
          if (!init) return;
          window.removeEventListener('message', onMessage);
          resolve(init);
        };
        window.addEventListener('message', onMessage);
        post({ type: 'ready' });
      }),
    progress: (percent) => post({ type: 'progress', percent }),
    finish: () => post({ type: 'finish' }),
    error: (code, message) => post({ type: 'error', code, ...(message ? { message } : {}) }),
  };
}
