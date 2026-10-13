import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/Button.tsx';
import { StatusMessage } from '../components/StatusMessage.tsx';
import { TextField } from '../components/TextField.tsx';
import { cx } from '../lib/cx.ts';
import { PartyGameView } from '../party/PartyGames.tsx';
import { getPath, setPath } from '../party/paths.ts';
import type { PartyConfigView } from '../party/types.ts';

export type PartyGameKind = PartyConfigView['game'];

// ───────────────────────── Definición de campos del editor ─────────────────────────

type Field =
  | { kind: 'text'; path: string; label: string; max?: number; hint?: string }
  | { kind: 'long'; path: string; label: string; max?: number; hint?: string }
  | { kind: 'number'; path: string; label: string; min: number; max: number; hint?: string }
  | { kind: 'color'; path: string; label: string }
  | { kind: 'select'; path: string; label: string; options: Array<{ value: string; label: string }>; hint?: string }
  | { kind: 'lines'; path: string; label: string; hint: string }
  | { kind: 'pairs'; path: string; label: string; hint: string };

const LOOK_FIELDS: Field[] = [
  { kind: 'color', path: 'look.accent', label: 'Color de acento (botones y bordes)' },
  { kind: 'color', path: 'look.accent2', label: 'Color dorado (títulos y detalles)' },
  { kind: 'color', path: 'look.bgFrom', label: 'Fondo (centro)' },
  { kind: 'color', path: 'look.bgTo', label: 'Fondo (bordes)' },
];

/** Qué se edita en cada juego: aspecto, textos y contenido. Los textos no pueden incitar al consumo de alcohol (la API y esta pantalla lo validan). */
export const PARTY_EDITOR: Record<PartyGameKind, { appearance: Field[]; texts: Field[]; content: Field[] }> = {
  spinner: {
    appearance: [
      ...LOOK_FIELDS,
      {
        kind: 'select',
        path: 'spinner.shape',
        label: 'Forma del girador',
        options: [
          { value: 'flecha', label: 'Flecha' },
          { value: 'aguja', label: 'Aguja' },
        ],
        hint: 'Los juegos no usan botellas ni copas (reglas de contenido de ILC).',
      },
      { kind: 'color', path: 'spinner.body', label: 'Color del girador' },
      { kind: 'color', path: 'spinner.tip', label: 'Color de la punta' },
      { kind: 'color', path: 'spinner.labelColor', label: 'Color del nombre sobre el girador' },
      { kind: 'text', path: 'spinner.labelTop', label: 'Nombre sobre el girador (arriba)', max: 20, hint: 'Ej.: AMARILLO' },
      { kind: 'text', path: 'spinner.labelBottom', label: 'Texto pequeño (abajo)', max: 30, hint: 'Ej.: DE MANZANARES' },
    ],
    texts: [
      { kind: 'text', path: 'heading', label: 'Título en pantalla', max: 40 },
      { kind: 'text', path: 'badge', label: 'Insignia bajo el título', max: 40 },
      { kind: 'text', path: 'spinLabel', label: 'Botón de girar', max: 30 },
      { kind: 'text', path: 'hint', label: 'Indicación bajo el botón', max: 120 },
      { kind: 'text', path: 'modalTag', label: 'Etiqueta del resultado', max: 40 },
      { kind: 'text', path: 'continueLabel', label: 'Botón para continuar', max: 40 },
    ],
    content: [{ kind: 'lines', path: 'prompts', label: 'Retos (uno por línea)', hint: 'Mínimo 3. Cada reto, máx. 160 caracteres.' }],
  },
  'truth-dare': {
    appearance: LOOK_FIELDS,
    texts: [
      { kind: 'text', path: 'heading', label: 'Título en pantalla', max: 40 },
      { kind: 'text', path: 'badge', label: 'Insignia bajo el título', max: 40 },
      { kind: 'text', path: 'chooseTag', label: 'Etiqueta inicial', max: 30 },
      { kind: 'long', path: 'intro', label: 'Mensaje inicial', max: 200 },
      { kind: 'text', path: 'truthLabel', label: 'Botón «verdad»', max: 20 },
      { kind: 'text', path: 'dareLabel', label: 'Botón «reto»', max: 20 },
      { kind: 'text', path: 'skipButton', label: 'Botón de penitencia', max: 40 },
      { kind: 'text', path: 'skipTitle', label: 'Título de la penitencia', max: 40 },
      { kind: 'long', path: 'skipText', label: 'Texto de la penitencia', max: 200 },
    ],
    content: [
      { kind: 'lines', path: 'truths', label: 'Verdades (una por línea)', hint: 'Mínimo 3.' },
      { kind: 'lines', path: 'dares', label: 'Retos (uno por línea)', hint: 'Mínimo 3.' },
    ],
  },
  categories: {
    appearance: LOOK_FIELDS,
    texts: [
      { kind: 'text', path: 'heading', label: 'Título en pantalla', max: 40 },
      { kind: 'text', path: 'subtitle', label: 'Subtítulo', max: 120 },
      { kind: 'text', path: 'topicLabel', label: 'Encabezado del tema', max: 60 },
      { kind: 'text', path: 'exampleLabel', label: 'Palabra antes del ejemplo', max: 30 },
      { kind: 'number', path: 'seconds', label: 'Segundos por turno', min: 3, max: 30 },
      { kind: 'text', path: 'goodLabel', label: 'Botón «respondió bien»', max: 50 },
      { kind: 'text', path: 'lostLabel', label: 'Botón «se equivocó»', max: 50 },
      { kind: 'text', path: 'changeLabel', label: 'Botón «cambiar tema»', max: 40 },
      { kind: 'long', path: 'lostMessage', label: 'Mensaje al perder', max: 200 },
    ],
    content: [
      { kind: 'pairs', path: 'topics', label: 'Temas (uno por línea: tema | ejemplo)', hint: 'Mínimo 3. Ej.: Equipos del fútbol colombiano | Once Caldas' },
    ],
  },
  'never-never': {
    appearance: LOOK_FIELDS,
    texts: [
      { kind: 'text', path: 'heading', label: 'Título en pantalla', max: 40 },
      { kind: 'text', path: 'subtitle', label: 'Subtítulo', max: 120 },
      { kind: 'text', path: 'tag', label: 'Etiqueta de la tarjeta', max: 40 },
      { kind: 'text', path: 'rule', label: 'Regla bajo la frase', max: 80 },
      { kind: 'text', path: 'nextLabel', label: 'Botón siguiente', max: 40 },
    ],
    content: [{ kind: 'lines', path: 'phrases', label: 'Frases (una por línea)', hint: 'Mínimo 3. Se muestran en este orden.' }],
  },
  headband: {
    appearance: LOOK_FIELDS,
    texts: [
      { kind: 'text', path: 'heading', label: 'Título en pantalla', max: 40 },
      { kind: 'long', path: 'intro', label: 'Instrucciones', max: 200 },
      { kind: 'text', path: 'startLabel', label: 'Botón de inicio', max: 30 },
      { kind: 'number', path: 'seconds', label: 'Segundos por ronda', min: 20, max: 180 },
      { kind: 'text', path: 'passLabel', label: 'Botón «pasar»', max: 20 },
      { kind: 'text', path: 'correctLabel', label: 'Botón «acertó»', max: 20 },
      { kind: 'text', path: 'endMessage', label: 'Mensaje final', max: 120, hint: 'Usa {n} donde va el número de aciertos.' },
    ],
    content: [{ kind: 'lines', path: 'words', label: 'Palabras (una por línea)', hint: 'Mínimo 5.' }],
  },
  'steady-hand': {
    appearance: LOOK_FIELDS,
    texts: [
      { kind: 'text', path: 'heading', label: 'Título en pantalla', max: 40 },
      { kind: 'text', path: 'instructions', label: 'Instrucciones', max: 160 },
      { kind: 'text', path: 'footer', label: 'Texto al pie', max: 160 },
      { kind: 'text', path: 'lostMessage', label: 'Mensaje al perder', max: 160, hint: 'Usa {t} donde va el tiempo logrado.' },
      { kind: 'text', path: 'restartHint', label: 'Indicación para reiniciar', max: 40 },
      { kind: 'number', path: 'safeRadius', label: 'Tamaño del círculo (dificultad)', min: 25, max: 70, hint: 'Más grande = más fácil.' },
    ],
    content: [],
  },
};

/** Lista de líneas ↔ texto del cuadro (una línea por elemento, sin vacías). */
const linesToText = (v: unknown): string => (Array.isArray(v) ? v.join('\n') : '');
const textToLines = (t: string): string[] =>
  t
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
const pairsToText = (v: unknown): string => (Array.isArray(v) ? v.map((p: { topic: string; example: string }) => `${p.topic} | ${p.example}`).join('\n') : '');
const textToPairs = (t: string): Array<{ topic: string; example: string }> =>
  textToLines(t).map((l) => {
    const [topic = '', ...rest] = l.split('|');
    return { topic: topic.trim(), example: rest.join('|').trim() };
  });

// ───────────────────────── Lista de juegos de fiesta ─────────────────────────

export interface PartyGameRow {
  moduleId: string;
  title: string;
  game: PartyGameKind;
  gameLabel: string;
  activeVersion: string | null;
  latestVersion: string;
  latestStatus: string;
}

export interface PartyListViewProps {
  rows: PartyGameRow[];
  templates: Array<{ game: PartyGameKind; label: string }>;
  loading?: boolean;
  error?: string;
  onEdit: (moduleId: string) => void;
  onNew: (game: PartyGameKind) => void;
  onGoToCatalog: () => void;
  onRetry: () => void;
}

export function PartyListView({ rows, templates, loading, error, onEdit, onNew, onGoToCatalog, onRetry }: PartyListViewProps) {
  return (
    <div className="p-8 space-y-8 max-w-5xl">
      <header className="space-y-2">
        <h1 className="font-headline-lg text-[28px] leading-8 text-on-surface">Juegos de fiesta</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Personaliza los textos, listas, colores y el girador de cada juego. Cada cambio crea una versión nueva que Marca y Jurídica aprueban en el Catálogo
          antes de activarse. No se permiten textos que inciten al consumo de alcohol, ni botellas ni copas.
        </p>
        <Button variant="secondary" onClick={onGoToCatalog}>
          Ir al Catálogo (probar, aprobar y activar)
        </Button>
      </header>
      {loading && <StatusMessage kind="pending" title="Cargando juegos…" />}
      {error && <StatusMessage kind="error" title="No pudimos cargar los juegos" body={error} action={<Button onClick={onRetry}>Reintentar</Button>} />}
      <section aria-labelledby="mis-juegos" className="space-y-3">
        <h2 id="mis-juegos" className="font-headline-md text-headline-md text-on-surface">
          Juegos instalados
        </h2>
        {rows.length === 0 && !loading && (
          <p className="font-body-md text-body-md text-on-surface-variant">Aún no hay juegos de fiesta. Crea el primero desde una plantilla.</p>
        )}
        <ul className="divide-y divide-outline-variant rounded-2xl border border-outline-variant bg-surface-container-lowest">
          {rows.map((r) => (
            <li key={r.moduleId} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-label-lg text-label-lg text-on-surface">{r.title}</p>
                <p className="font-body-md text-[13px] text-on-surface-variant">
                  {r.gameLabel} · {r.activeVersion ? `activo: v${r.activeVersion}` : 'sin versión activa'} · última: v{r.latestVersion} (
                  {r.latestStatus.toLowerCase()})
                </p>
              </div>
              <Button variant="secondary" onClick={() => onEdit(r.moduleId)}>
                Personalizar
              </Button>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="nuevo" className="space-y-3">
        <h2 id="nuevo" className="font-headline-md text-headline-md text-on-surface">
          Crear un juego nuevo desde una plantilla
        </h2>
        <div className="flex flex-wrap gap-3">
          {templates.map((t) => (
            <Button key={t.game} variant="secondary" leadingIcon="add" onClick={() => onNew(t.game)}>
              {t.label}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}

// ───────────────────────── Editor ─────────────────────────

export interface PartyEditorViewProps {
  game: PartyGameKind;
  gameLabel: string;
  isNew: boolean;
  moduleId: string;
  onModuleIdChange: (v: string) => void;
  title: string;
  onTitleChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  config: PartyConfigView;
  onConfigChange: (c: PartyConfigView) => void;
  /** Versión que se guardará (la siguiente a la última). */
  nextVersion: string;
  /** Errores por campo, con las rutas que devuelve la validación (`delivery.config.dares.0`, `title`…). */
  errors: Record<string, string[]>;
  busy?: boolean;
  notice?: string;
  saved?: boolean;
  onSave: () => void;
  onBack: () => void;
  onGoToCatalog: () => void;
}

const errorsAt = (errors: Record<string, string[]>, ...paths: string[]): string[] =>
  Object.entries(errors).flatMap(([k, v]) =>
    paths.some((p) => k === p || k.startsWith(`${p}.`))
      ? v.map((m) => (k.split('.').pop()?.match(/^\d+$/) ? `Línea ${Number(k.split('.').pop()) + 1}: ${m}` : m))
      : [],
  );

/**
 * Cuadro de texto que conserva lo que se escribe (espacios y saltos de línea al final) y solo entrega al formulario
 * la versión limpia; se resincroniza si el valor externo cambia por otra vía.
 */
function BufferedTextarea({
  value,
  parse,
  onParsed,
  ...rest
}: {
  value: string;
  parse: (text: string) => unknown;
  onParsed: (v: unknown) => void;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'>) {
  const [text, setText] = useState(value);
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setText(value);
    }
  }, [value]);
  return (
    <textarea
      {...rest}
      value={text}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        const parsed = parse(t);
        last.current = Array.isArray(parsed) ? (typeof parsed[0] === 'object' ? pairsToText(parsed) : linesToText(parsed)) : String(parsed);
        onParsed(parsed);
      }}
    />
  );
}

function FieldInput({
  f,
  config,
  onChange,
  errors,
}: {
  f: Field;
  config: PartyConfigView;
  onChange: (c: PartyConfigView) => void;
  errors: Record<string, string[]>;
}) {
  const full = `delivery.config.${f.path}`;
  const errs = errorsAt(errors, full);
  const set = (value: unknown) => onChange(setPath(config, f.path, value));
  const value = getPath(config, f.path);
  const errNode = errs.length > 0 && (
    <div role="alert" className="font-body-md text-[13px] text-error space-y-1">
      {errs.map((e) => (
        <p key={e}>{e}</p>
      ))}
    </div>
  );
  if (f.kind === 'text')
    return (
      <div className="space-y-1">
        <TextField label={f.label} value={String(value ?? '')} onChange={set} maxLength={f.max} hint={f.hint} error={errs[0]} />
      </div>
    );
  if (f.kind === 'number')
    return (
      <div className="space-y-1">
        <TextField
          label={f.label}
          type="number"
          value={String(value ?? '')}
          onChange={(v) => set(Number(v))}
          min={f.min}
          max={f.max}
          hint={f.hint ?? `Entre ${f.min} y ${f.max}`}
          error={errs[0]}
        />
      </div>
    );
  if (f.kind === 'color')
    return (
      <div className="space-y-1">
        <label className="flex items-center gap-3 min-h-12 font-label-lg text-label-lg text-on-surface">
          <input
            type="color"
            value={String(value ?? '#000000')}
            onChange={(e) => set(e.target.value.toUpperCase())}
            className="h-10 w-14 rounded border border-outline-variant bg-transparent p-0"
          />
          <span className="flex-1">{f.label}</span>
          <span className="font-body-md text-[13px] text-on-surface-variant">{String(value ?? '')}</span>
        </label>
        {errNode}
      </div>
    );
  if (f.kind === 'select')
    return (
      <div className="space-y-1">
        <label className="block font-label-lg text-label-lg text-on-surface" htmlFor={full}>
          {f.label}
        </label>
        <select
          id={full}
          value={String(value ?? '')}
          onChange={(e) => set(e.target.value)}
          className="min-h-12 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-on-surface"
        >
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {f.hint && <p className="font-body-md text-[12px] text-on-surface-variant">{f.hint}</p>}
        {errNode}
      </div>
    );
  const isPairs = f.kind === 'pairs';
  const isLong = f.kind === 'long';
  return (
    <div className="space-y-1">
      <label className="block font-label-lg text-label-lg text-on-surface" htmlFor={full}>
        {f.label}
      </label>
      <BufferedTextarea
        id={full}
        value={f.kind === 'lines' ? linesToText(value) : isPairs ? pairsToText(value) : String(value ?? '')}
        parse={(t) => (f.kind === 'lines' ? textToLines(t) : isPairs ? textToPairs(t) : t)}
        onParsed={set}
        rows={isLong ? 3 : 10}
        maxLength={isLong ? f.max : undefined}
        className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-3 font-body-md text-body-md text-on-surface"
      />
      {'hint' in f && f.hint && <p className="font-body-md text-[12px] text-on-surface-variant">{f.hint}</p>}
      {errNode}
    </div>
  );
}

/**
 * Editor de un juego de fiesta: formulario a la izquierda y vista previa jugable a la derecha. Guardar crea una versión nueva
 * (borrador) del módulo; Marca y Jurídica la aprueban antes de activarla. La validación (incluida la regla de que ningún texto
 * incite al consumo de alcohol) corre en vivo y de nuevo en el servidor.
 */
export function PartyEditorView(p: PartyEditorViewProps) {
  const spec = PARTY_EDITOR[p.game];
  const hasErrors = Object.keys(p.errors).length > 0;
  const previewKey = useMemo(() => JSON.stringify(p.config), [p.config]);
  const section = (id: string, title: string, fields: Field[]) =>
    fields.length > 0 && (
      <section aria-labelledby={id} className="space-y-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
        <h2 id={id} className="font-headline-md text-headline-md text-on-surface">
          {title}
        </h2>
        {fields.map((f) => (
          <FieldInput key={f.path} f={f} config={p.config} onChange={p.onConfigChange} errors={p.errors} />
        ))}
      </section>
    );

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button variant="text" leadingIcon="arrow_back" onClick={p.onBack}>
          Juegos de fiesta
        </Button>
        <h1 className="font-headline-lg text-[28px] leading-8 text-on-surface">
          {p.isNew ? 'Nuevo' : 'Personalizar'}: {p.gameLabel}
        </h1>
      </div>
      <div aria-live="polite">
        {p.notice && (
          <p
            role="status"
            className={cx(
              'mb-4 rounded-xl px-4 py-3 font-body-md text-body-md',
              p.saved ? 'bg-secondary-container text-on-secondary-container' : 'bg-error-container text-on-error-container',
            )}
          >
            {p.notice}
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <section aria-labelledby="datos" className="space-y-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
            <h2 id="datos" className="font-headline-md text-headline-md text-on-surface">
              Datos del juego
            </h2>
            <TextField
              label="Identificador"
              value={p.moduleId}
              onChange={p.onModuleIdChange}
              disabled={!p.isNew}
              hint={p.isNew ? 'Minúsculas con guiones. No se puede cambiar después.' : 'No cambia entre versiones.'}
              error={errorsAt(p.errors, 'moduleId')[0]}
            />
            <TextField label="Nombre del juego" value={p.title} onChange={p.onTitleChange} maxLength={60} error={errorsAt(p.errors, 'title')[0]} />
            <TextField
              label="Descripción corta"
              value={p.description}
              onChange={p.onDescriptionChange}
              maxLength={200}
              error={errorsAt(p.errors, 'description')[0]}
            />
          </section>
          {section('aspecto', 'Aspecto', spec.appearance)}
          {section('textos', 'Textos', spec.texts)}
          {section('contenido', 'Contenido', spec.content)}
        </div>

        <aside aria-label="Vista previa" className="lg:sticky lg:top-6 self-start space-y-4">
          <p className="font-label-lg text-label-lg text-on-surface">Vista previa (puedes jugarla)</p>
          <div className="mx-auto h-[640px] w-[340px] overflow-auto rounded-[28px] border-4 border-outline-variant bg-black shadow-lg">
            <PartyGameView key={previewKey} config={p.config} onExit={() => undefined} compact />
          </div>
          <div className="space-y-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
            <p className="font-body-md text-[13px] text-on-surface-variant">
              Al guardar se crea la <strong>versión {p.nextVersion}</strong> como borrador. Márcala para prueba y apruébala (Marca y Jurídica) en el Catálogo
              para activarla.
            </p>
            {hasErrors && <p className="font-body-md text-[13px] text-error">Hay campos por corregir antes de guardar.</p>}
            <div className="flex flex-wrap gap-3">
              <Button onClick={p.onSave} disabled={hasErrors} loading={p.busy}>
                Guardar versión {p.nextVersion}
              </Button>
              {p.saved && (
                <Button variant="secondary" onClick={p.onGoToCatalog}>
                  Ir al Catálogo
                </Button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
