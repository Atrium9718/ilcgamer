import { useId } from 'react';

export interface DateParts {
  day: string;
  month: string;
  year: string;
}

export interface DateOfBirthInputProps {
  value: DateParts;
  onChange: (value: DateParts) => void;
  legend?: string;
  /** Mensaje de error ya redactado por el contenedor. */
  error?: string;
}

const FIELDS = [
  { key: 'day', label: 'Día', placeholder: 'DD', maxLength: 2, autoComplete: 'bday-day' },
  { key: 'month', label: 'Mes', placeholder: 'MM', maxLength: 2, autoComplete: 'bday-month' },
  { key: 'year', label: 'Año', placeholder: 'AAAA', maxLength: 4, autoComplete: 'bday-year' },
] as const;

/** Fecha de nacimiento en tres casillas numéricas grandes (DD / MM / AAAA). */
export function DateOfBirthInput({ value, onChange, legend = 'Ingresa tu fecha de nacimiento', error }: DateOfBirthInputProps) {
  const baseId = useId();
  const errorId = `${baseId}-error`;
  return (
    <fieldset className="space-y-2" aria-describedby={error ? errorId : undefined}>
      <legend className="font-label-sm text-label-sm uppercase text-secondary block w-full text-center mb-1">{legend}</legend>
      <div className="grid grid-cols-3 gap-2.5">
        {FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col items-center">
            <label htmlFor={`${baseId}-${f.key}`} className="font-label-sm text-label-sm text-on-surface-variant mb-1.5">
              {f.label}
            </label>
            <input
              id={`${baseId}-${f.key}`}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete={f.autoComplete}
              maxLength={f.maxLength}
              placeholder={f.placeholder}
              value={value[f.key]}
              aria-invalid={error ? true : undefined}
              onChange={(e) => onChange({ ...value, [f.key]: e.target.value.replace(/\D/g, '').slice(0, f.maxLength) })}
              className="w-full h-14 rounded-lg text-center bg-surface-container border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none font-title-lg text-title-lg text-primary placeholder:text-outline tabular-nums transition-colors"
            />
          </div>
        ))}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-center font-label-lg text-[13px] p-2 rounded-lg bg-error-container text-on-error-container">
          {error}
        </p>
      )}
    </fieldset>
  );
}
