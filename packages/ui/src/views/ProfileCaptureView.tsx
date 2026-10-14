import type { FormEvent } from 'react';
import { Button } from '../components/Button.tsx';
import { Checkbox } from '../components/Checkbox.tsx';
import { SealMark } from '../components/SealMark.tsx';
import { TextField } from '../components/TextField.tsx';

export interface ProfileCaptureValue {
  fullName: string;
  email: string;
  phone: string;
  acceptDataTreatment: boolean;
  acceptMarketing: boolean;
}

export interface ProfileCaptureViewProps {
  value: ProfileCaptureValue;
  onChange: (v: ProfileCaptureValue) => void;
  /** Errores por campo (`fullName`, `email`, `phone`, `acceptDataTreatment`) que devuelve la API o la validación local. */
  errors?: Partial<Record<keyof ProfileCaptureValue, string>>;
  /** Error general (conexión, aviso cambiado…). */
  error?: string;
  submitting?: boolean;
  privacyHref: string;
  onSubmit: () => void;
}

/**
 * Registro al entrar a la app: nombre, correo, celular y autorización del tratamiento de datos (obligatoria). Las novedades y
 * promociones son una autorización aparte y opcional. Es explícita sobre para qué se usan los datos y cómo retirarlos.
 */
export function ProfileCaptureView({ value, onChange, errors = {}, error, submitting, privacyHref, onSubmit }: ProfileCaptureViewProps) {
  const set = <K extends keyof ProfileCaptureValue>(key: K, v: ProfileCaptureValue[K]) => onChange({ ...value, [key]: v });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!submitting) onSubmit();
  };
  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <div className="w-full max-w-md mx-auto flex flex-col min-h-dvh bg-surface-container-lowest">
        <main className="flex-1 px-5 pt-8 pb-8">
          <form onSubmit={submit} noValidate className="space-y-5">
            <div className="flex items-center gap-3">
              <SealMark size="lg" className="w-12 h-12 shrink-0" />
              <h1 className="font-headline-lg text-[28px] leading-8">Bienvenido a ILC Origen</h1>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Regístrate para jugar, participar en concursos y recibir lo que ILC prepara para ti.
            </p>

            <TextField
              label="Nombre completo"
              autoComplete="name"
              value={value.fullName}
              onChange={(v) => set('fullName', v)}
              error={errors.fullName}
              maxLength={80}
            />
            <TextField
              label="Correo electrónico"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={value.email}
              onChange={(v) => set('email', v)}
              error={errors.email}
              placeholder="nombre@correo.com"
            />
            <TextField
              label="Celular"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={value.phone}
              onChange={(v) => set('phone', v)}
              error={errors.phone}
              hint="Celular colombiano, ej.: 300 123 4567"
            />

            <fieldset className="space-y-1">
              <legend className="font-title-md text-title-md text-on-surface mb-1">Tus autorizaciones</legend>
              <Checkbox
                checked={value.acceptDataTreatment}
                onChange={(v) => set('acceptDataTreatment', v)}
                label="Autorizo a la Industria Licorera de Caldas el tratamiento de mis datos personales (nombre, correo y celular) para gestionar mi participación y contactarme."
              />
              {errors.acceptDataTreatment && (
                <p role="alert" className="pl-1 font-body-md text-[13px] text-error">
                  {errors.acceptDataTreatment}
                </p>
              )}
              <p className="pl-1 font-body-md text-[12px] text-on-surface-variant">
                Puedes conocer, actualizar o pedir que eliminemos tus datos cuando quieras. Lee la{' '}
                <a href={privacyHref} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
                  política de tratamiento de datos
                </a>
                .
              </p>
              <Checkbox
                checked={value.acceptMarketing}
                onChange={(v) => set('acceptMarketing', v)}
                label="Quiero recibir novedades y promociones de ILC y sus marcas (opcional)."
              />
            </fieldset>

            {error && (
              <p role="alert" className="font-body-md text-[13px] text-error">
                {error}
              </p>
            )}
            <Button type="submit" fullWidth loading={submitting}>
              Continuar
            </Button>
            <p className="font-body-md text-[11px] text-on-surface-variant">
              EL EXCESO DE ALCOHOL ES PERJUDICIAL PARA LA SALUD. PROHÍBASE EL EXPENDIO DE BEBIDAS EMBRIAGANTES A MENORES DE EDAD.
            </p>
          </form>
        </main>
      </div>
    </div>
  );
}
