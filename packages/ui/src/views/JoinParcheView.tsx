import type { FormEvent, ReactNode } from 'react';
import { BrandChip } from '../components/BrandChip.tsx';
import { Button } from '../components/Button.tsx';
import { Icon } from '../components/Icon.tsx';
import { LegalNotice } from '../components/LegalNotice.tsx';
import { PinInput } from '../components/PinInput.tsx';
import { QrScannerFrame } from '../components/QrScannerFrame.tsx';
import { SegmentedControl } from '../components/SegmentedControl.tsx';
import { TextField } from '../components/TextField.tsx';
import { TopBar } from '../components/TopBar.tsx';

export type JoinMethod = 'pin' | 'qr';

/** Vista previa del Parche encontrado. Nunca incluye nombres de personas. */
export interface ParchePreview {
  name: string;
  brandLabel?: string;
  members: number;
}

/**
 * Vista pura: unirse a un Parche con PIN o QR.
 * Diseño: Stitch "04 · Unirme a un Parche" (design/stitch-exports/04-unirse-parche).
 * Fuentes: Instrucciones §3.2, §5 paso 4; Guía Técnica §5.5, §7 (POST /sessions/{id}/join), §9.2.
 * Los intentos restantes y la validez del PIN los decide el servidor; la vista solo los muestra.
 */
export interface JoinParcheViewProps {
  method: JoinMethod;
  onMethodChange: (method: JoinMethod) => void;
  pin: string;
  onPinChange: (pin: string) => void;
  pinLength?: number;
  attemptsLeft?: number;
  pinError?: string;
  alias: string;
  onAliasChange: (value: string) => void;
  preview?: ParchePreview;
  canSubmit: boolean;
  submitting?: boolean;
  onSubmit: () => void;
  onBack: () => void;
  /** Video de la cámara para el modo QR (lo controla el contenedor). */
  qrVideo?: ReactNode;
  cameraDenied?: boolean;
}

export function JoinParcheView({
  method,
  onMethodChange,
  pin,
  onPinChange,
  pinLength = 4,
  attemptsLeft,
  pinError,
  alias,
  onAliasChange,
  preview,
  canSubmit,
  submitting = false,
  onSubmit,
  onBack,
  qrVideo,
  cameraDenied,
}: JoinParcheViewProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (canSubmit && !submitting) onSubmit();
  };
  const hint =
    attemptsLeft !== undefined ? `Te quedan ${attemptsLeft} intentos. El PIN cambia si el Parche se cierra.` : 'El PIN cambia si el Parche se cierra.';

  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <form onSubmit={handleSubmit} noValidate className="w-full max-w-md mx-auto flex flex-col min-h-dvh bg-surface-container-lowest">
        <TopBar title={<span className="font-headline-md text-headline-md text-primary">Unirme a un Parche</span>} onBack={onBack} />

        <main className="flex-1 px-4 pt-4 pb-6 space-y-6">
          <SegmentedControl
            label="Cómo quieres unirte"
            showLabel={false}
            value={method}
            onChange={onMethodChange}
            options={[
              { value: 'qr', label: 'Escanear QR', icon: 'qr_code_scanner' },
              { value: 'pin', label: 'Ingresar PIN', icon: 'pin' },
            ]}
          />

          <div className="text-center space-y-1">
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Entra al Parche de tu mesa</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {method === 'pin' ? 'Pide el PIN a quien creó el Parche.' : 'Escanea el QR que muestra quien creó el Parche.'}
            </p>
          </div>

          {method === 'pin' ? (
            <PinInput value={pin} onChange={onPinChange} length={pinLength} hint={hint} error={pinError} disabled={submitting || attemptsLeft === 0} />
          ) : (
            <QrScannerFrame video={qrVideo} cameraDenied={cameraDenied} hint="Apunta al QR del Parche" onManualEntry={() => onMethodChange('pin')} />
          )}

          {preview && (
            <section aria-label="Parche encontrado" className="flex items-center gap-3 p-3.5 rounded-2xl bg-surface-container border border-secondary/40">
              <span className="w-10 h-10 shrink-0 rounded-full border-2 border-secondary text-secondary flex items-center justify-center">
                <Icon name="groups" className="text-[22px]" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-title-md text-title-md text-on-surface truncate">{preview.name}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                  {preview.brandLabel && <BrandChip label={preview.brandLabel} />}
                  <span className="font-body-md text-[13px] text-on-surface-variant tabular-nums">{preview.members} integrantes</span>
                </div>
              </div>
              <span className="font-label-sm text-[11px] uppercase text-secondary">Abierto</span>
            </section>
          )}

          <div className="space-y-1.5">
            <TextField label="Tu alias" placeholder="Valentina" value={alias} onChange={onAliasChange} maxLength={20} autoComplete="nickname" />
            <p className="flex items-start gap-1.5 font-body-md text-[13px] text-on-surface-variant">
              <Icon name="info" className="text-[18px]" />
              Así te verá tu grupo en el Parche.
            </p>
          </div>
        </main>

        <div className="sticky bottom-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-1">
          <Button type="submit" disabled={!canSubmit} loading={submitting} trailingIcon="arrow_forward">
            Unirme
          </Button>
          {method === 'pin' && (
            <Button variant="text" leadingIcon="qr_code" onClick={() => onMethodChange('qr')}>
              Prefiero escanear el QR
            </Button>
          )}
        </div>
        <LegalNotice />
      </form>
    </div>
  );
}
