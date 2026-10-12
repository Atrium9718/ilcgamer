import type { ReactNode } from 'react';
import { Icon } from './Icon.tsx';

export interface QrScannerFrameProps {
  /** Elemento <video> de la cámara que inyecta el contenedor. Sin él se muestra el estado sin cámara. */
  video?: ReactNode;
  hint?: string;
  /** Alternativa obligatoria si no hay cámara o permiso (Guía Gamificación §7.3). */
  onManualEntry: () => void;
  cameraDenied?: boolean;
}

/** Visor QR con esquinas doradas. La lectura del código la hace el contenedor (BarcodeDetector/biblioteca). */
export function QrScannerFrame({ video, hint = 'Apunta al código QR', onManualEntry, cameraDenied = false }: QrScannerFrameProps) {
  const corner = 'absolute w-10 h-10 border-primary';
  return (
    <div className="space-y-4">
      <div className="relative mx-auto w-full max-w-72 aspect-square rounded-2xl overflow-hidden bg-surface-container-lowest border border-outline-variant">
        {video && !cameraDenied ? (
          <div className="absolute inset-0 [&>video]:w-full [&>video]:h-full [&>video]:object-cover">{video}</div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
            <Icon name={cameraDenied ? 'no_photography' : 'photo_camera'} className="text-[40px] text-on-surface-variant" />
            <p className="font-body-md text-body-md text-on-surface-variant">
              {cameraDenied ? 'No tenemos permiso para usar la cámara. Puedes ingresar el código a mano.' : 'Preparando la cámara…'}
            </p>
          </div>
        )}
        <span aria-hidden="true" className={`${corner} top-3 left-3 border-t-4 border-l-4 rounded-tl-xl`} />
        <span aria-hidden="true" className={`${corner} top-3 right-3 border-t-4 border-r-4 rounded-tr-xl`} />
        <span aria-hidden="true" className={`${corner} bottom-3 left-3 border-b-4 border-l-4 rounded-bl-xl`} />
        <span aria-hidden="true" className={`${corner} bottom-3 right-3 border-b-4 border-r-4 rounded-br-xl`} />
      </div>
      <p className="text-center font-body-md text-body-md text-on-surface-variant">{hint}</p>
      <button type="button" onClick={onManualEntry} className="mx-auto flex items-center gap-1 min-h-12 px-3 font-label-lg text-label-lg text-primary hover:underline underline-offset-4">
        <Icon name="keyboard" className="text-[20px]" />
        Ingresar el código manualmente
      </button>
    </div>
  );
}
