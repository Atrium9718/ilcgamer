import type { FormEvent } from 'react';
import { BrandChip } from '../components/BrandChip.tsx';
import { Button } from '../components/Button.tsx';
import { Icon } from '../components/Icon.tsx';
import { LegalNotice } from '../components/LegalNotice.tsx';
import { SegmentedControl } from '../components/SegmentedControl.tsx';
import { TextField } from '../components/TextField.tsx';
import { TopBar } from '../components/TopBar.tsx';

export type ParcheMode = 'multi' | 'single';

/**
 * Vista pura: el anfitrión arma El Parche.
 * Diseño: Stitch "03 · Crear El Parche" (design/stitch-exports/03-crear-parche).
 * Fuentes: Instrucciones §3.2, §5 paso 4; Guía Técnica §5.5 (alias, modo de un solo dispositivo,
 * duración configurable, la expiración no afecta el saldo individual).
 */
export interface CreateParcheViewProps {
  brandLabel?: string;
  parcheName: string;
  onParcheNameChange: (value: string) => void;
  alias: string;
  onAliasChange: (value: string) => void;
  mode: ParcheMode;
  onModeChange: (mode: ParcheMode) => void;
  /** Duración de energía configurada por la campaña, en minutos. */
  energyMinutes: number;
  canSubmit: boolean;
  submitting?: boolean;
  nameError?: string;
  aliasError?: string;
  onSubmit: () => void;
  onBack: () => void;
}

const MODE_HELP: Record<ParcheMode, string> = {
  multi: 'Cada integrante entra con el PIN desde su propio celular y juegan al mismo tiempo.',
  single: 'Se pasan un solo celular por turnos. No hace falta que los demás se registren.',
};

export function CreateParcheView({
  brandLabel,
  parcheName,
  onParcheNameChange,
  alias,
  onAliasChange,
  mode,
  onModeChange,
  energyMinutes,
  canSubmit,
  submitting = false,
  nameError,
  aliasError,
  onSubmit,
  onBack,
}: CreateParcheViewProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (canSubmit && !submitting) onSubmit();
  };

  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <form onSubmit={handleSubmit} noValidate className="w-full max-w-md mx-auto flex flex-col min-h-dvh bg-surface-container-lowest">
        <TopBar title={<span className="font-headline-md text-headline-md text-primary">Tu Parche</span>} onBack={onBack} trailing={brandLabel && <BrandChip label={brandLabel} />} />

        <main className="flex-1 px-4 pt-4 pb-6 space-y-5">
          <div className="flex items-center justify-between">
            <p className="font-label-sm text-label-sm uppercase text-primary">
              Paso 1 de 2 <span className="text-on-surface-variant normal-case tracking-normal font-body-md">· Configuración inicial</span>
            </p>
            <div aria-hidden="true" className="flex gap-1">
              <span className="h-1 w-10 rounded-full bg-primary" />
              <span className="h-1 w-4 rounded-full bg-outline-variant" />
            </div>
          </div>

          <div className="space-y-1.5">
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Arma tu Parche</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Ponle nombre a la mesa y comparte el código para que tu grupo se una. Cada quien juega a su ritmo.
            </p>
          </div>

          <TextField
            label="Nombre del Parche"
            placeholder="Los del bosque de niebla"
            value={parcheName}
            onChange={onParcheNameChange}
            maxLength={24}
            showCount
            autoComplete="off"
            error={nameError}
          />

          <div className="space-y-1.5">
            <TextField label="Tu alias en el Parche" placeholder="Andrés" value={alias} onChange={onAliasChange} maxLength={20} autoComplete="nickname" error={aliasError} />
            <p className="flex items-start gap-1.5 font-body-md text-[13px] text-on-surface-variant">
              <Icon name="verified_user" className="text-[18px] text-secondary" />
              Solo verán tu alias. Nunca mostramos tu nombre completo ni tu teléfono.
            </p>
          </div>

          <div className="space-y-2">
            <SegmentedControl
              label="Modo de juego"
              value={mode}
              onChange={onModeChange}
              options={[
                { value: 'multi', label: 'Varios celulares', icon: 'devices' },
                { value: 'single', label: 'Un solo celular', icon: 'smartphone' },
              ]}
            />
            <p className="flex items-start gap-2 p-3 rounded-xl bg-surface-container-low border border-outline-variant font-body-md text-[13px] text-on-surface-variant">
              <Icon name="hub" className="text-[18px] text-tertiary" />
              {MODE_HELP[mode]}
            </p>
          </div>

          <section className="flex items-start gap-3 p-4 rounded-2xl bg-surface-container border border-outline-variant">
            <span className="w-10 h-10 shrink-0 rounded-full border border-primary/40 flex items-center justify-center text-primary">
              <Icon name="schedule" className="text-[22px]" />
            </span>
            <div>
              <h2 className="font-title-md text-title-md text-on-surface">
                Energía del Parche: <span className="tabular-nums">{energyMinutes}</span> min
              </h2>
              <p className="font-body-md text-[13px] text-on-surface-variant">La duración la define la campaña. Al terminar la sesión tu saldo individual se conserva.</p>
            </div>
          </section>
        </main>

        <div className="sticky bottom-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button type="submit" disabled={!canSubmit} loading={submitting} trailingIcon="arrow_forward">
            Crear Parche
          </Button>
        </div>
        <LegalNotice />
      </form>
    </div>
  );
}
