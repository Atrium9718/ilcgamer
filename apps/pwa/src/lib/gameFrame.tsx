import { assertEmbeddable, createHost, IFRAME_SANDBOX, iframeAllow } from '@ilc/game-sdk';
import { useEffect, useRef } from 'react';

/**
 * Contenedor de un módulo de proveedor (Guía Técnica §5.4): iframe con `sandbox` mínimo, sin permisos de
 * dispositivo no aprobados y sin cookies ni datos de la persona. Solo recibe el identificador de partida.
 */
export function GameFrame({
  entryUrl,
  allowedOrigin,
  missionId,
  permissions,
  onReady,
  onFinish,
  onError,
}: {
  entryUrl: string;
  allowedOrigin: string;
  missionId: string;
  permissions: string[];
  onReady: () => void;
  onFinish: () => void;
  onError: (message: string) => void;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const cb = useRef({ onReady, onFinish, onError });
  cb.current = { onReady, onFinish, onError };

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    try {
      assertEmbeddable(entryUrl, allowedOrigin, window.location.origin);
    } catch (err) {
      cb.current.onError(err instanceof Error ? err.message : 'El módulo no se puede cargar.');
      return;
    }
    const host = createHost({
      frame: frame.contentWindow,
      allowedOrigin,
      missionId,
      locale: 'es-CO',
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      onReady: () => cb.current.onReady(),
      onFinish: () => cb.current.onFinish(),
      onError: (_code, message) => cb.current.onError(message ?? 'El juego reportó un error.'),
    });
    return () => host.dispose();
  }, [entryUrl, allowedOrigin, missionId]);

  return (
    <iframe
      ref={ref}
      title="Juego del proveedor"
      src={entryUrl}
      sandbox={IFRAME_SANDBOX}
      allow={iframeAllow(permissions)}
      referrerPolicy="origin"
      loading="eager"
      className="w-full h-[70dvh] bg-surface-container-low"
    />
  );
}
