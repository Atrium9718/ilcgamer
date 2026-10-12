import { type HostMessage, type ModuleMessage, parseModuleMessage } from './protocol.ts';

export interface HostOptions {
  /** Ventana del iframe (`iframe.contentWindow`). */
  frame: Window | null;
  /** Origen exacto permitido del módulo (manifiesto). */
  allowedOrigin: string;
  missionId: string;
  locale: string;
  reducedMotion: boolean;
  onReady?: () => void;
  onProgress?: (percent: number) => void;
  /** El módulo avisa que terminó. NO trae resultado: la PWA le pide al servidor que lo verifique. */
  onFinish: () => void;
  onError?: (code: string, message?: string) => void;
  /** Dónde escuchar (la ventana de la PWA). */
  target?: Window;
  /** Máximo de mensajes por segundo aceptados del módulo. */
  maxMessagesPerSecond?: number;
  now?: () => number;
}

export interface Host {
  dispose: () => void;
}

/**
 * Lado anfitrión (PWA) del Game SDK. Solo acepta mensajes que vengan de la ventana del iframe Y del origen permitido,
 * con el formato exacto del protocolo, con límite de ritmo, y ignora todo lo posterior a `finish`.
 */
export function createHost(options: HostOptions): Host {
  const target = options.target ?? window;
  const limit = options.maxMessagesPerSecond ?? 20;
  const now = options.now ?? (() => Date.now());
  let finished = false;
  let windowStart = now();
  let count = 0;

  const send = (message: HostMessage) => options.frame?.postMessage(message, options.allowedOrigin);

  const listener = (event: MessageEvent) => {
    if (finished) return;
    if (event.source !== options.frame || event.origin !== options.allowedOrigin) return;
    if (now() - windowStart > 1000) {
      windowStart = now();
      count = 0;
    }
    if (++count > limit) return;
    const message: ModuleMessage | null = parseModuleMessage(event.data);
    if (!message) return;
    switch (message.type) {
      case 'ready':
        send({ ilc: 1, type: 'init', missionId: options.missionId, locale: options.locale, reducedMotion: options.reducedMotion });
        options.onReady?.();
        break;
      case 'progress':
        options.onProgress?.(message.percent);
        break;
      case 'finish':
        finished = true;
        options.onFinish();
        break;
      case 'error':
        options.onError?.(message.code, message.message);
        break;
    }
  };

  target.addEventListener('message', listener);
  return { dispose: () => target.removeEventListener('message', listener) };
}
