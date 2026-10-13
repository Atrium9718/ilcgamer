import { z } from 'zod';

/**
 * Juegos de fiesta (Paso 15): trivia de preguntas y retos, verdad o reto, categorías con cronómetro, «yo nunca», adivinar en la
 * frente y pulso firme. Son un motor propio de la plataforma (`engine: 'party'`): no hay código de terceros; lo que se
 * personaliza es la **configuración** (textos, listas, colores y el aspecto del girador) y cada cambio es una versión nueva del
 * módulo que pasa por las aprobaciones de Marca y Jurídica antes de activarse.
 *
 * Reglas del producto que este contrato impone:
 *  - Ningún texto puede presionar ni incentivar el consumo de alcohol («toma un shot», «fondo blanco», penalizar con tragos…):
 *    la validación lo rechaza al registrar, igual en la consola que en el servidor. Se permiten las marcas como nombre.
 *  - El girador usa una flecha o una aguja, nunca una botella ni una copa (reglas de contenido de ILC).
 *  - Los juegos de fiesta no puntúan: no suman al Parche, no dan XP y jamás Puntos ILC.
 */

export const PARTY_GAMES = ['spinner', 'truth-dare', 'categories', 'never-never', 'headband', 'steady-hand'] as const;
export const PartyGameSchema = z.enum(PARTY_GAMES);
export type PartyGame = z.infer<typeof PartyGameSchema>;

export const PARTY_GAME_LABEL: Record<PartyGame, string> = {
  spinner: 'Girador de retos',
  'truth-dare': 'Verdad o reto',
  categories: 'Categorías con cronómetro',
  'never-never': 'Yo nunca nunca',
  headband: 'Adivina en la frente',
  'steady-hand': 'Pulso firme',
};

// ─────────────── Regla de contenido: sin presión para consumir alcohol ───────────────

const norm = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Expresiones que incitan o penalizan con consumo de alcohol (se comparan sin tildes ni mayúsculas). */
const ALCOHOL_PRESSURE: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /\bshots?\b/, label: 'shot' },
  { re: /\btrag(o|os|uito|uitos)\b/, label: 'trago' },
  { re: /fondo\s+blanco/, label: 'fondo blanco' },
  { re: /\b(emborrach|embriag|borrach|ebri)\w*/, label: 'borracho' },
  { re: /\b(guayabo|resaca|cruda)\b/, label: 'resaca' },
  { re: /\bbrind\w*/, label: 'brindar' },
  { re: /\b(tomate|tomarse|tomar|toma|tomen|tome)\s+(un|una|unos|unas|dos|tres|otro|otra|algo)\b/, label: 'tomar' },
];

/** Devuelve el motivo si el texto incita al consumo de alcohol; null si está bien. */
export function partyTextIssue(text: string): string | null {
  const t = norm(text);
  const hit = ALCOHOL_PRESSURE.find((p) => p.re.test(t));
  return hit ? `Menciona «${hit.label}». Las reglas de ILC no permiten incentivar ni penalizar con consumo de alcohol en los juegos: reescríbelo.` : null;
}

const Safe = (max: number, min = 1) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .superRefine((v, ctx) => {
      const issue = partyTextIssue(v);
      if (issue) ctx.addIssue({ code: 'custom', message: issue });
    });
const List = (itemMax: number, min: number, max: number) => z.array(Safe(itemMax)).min(min).max(max);
const Hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color en formato #RRGGBB');

/** Aspecto común: colores de acento y fondo. */
export const PartyLookSchema = z
  .object({
    accent: Hex.default('#EC0E15'),
    accent2: Hex.default('#FFD700'),
    bgFrom: Hex.default('#1A0808'),
    bgTo: Hex.default('#080808'),
  })
  .strict();
export type PartyLook = z.infer<typeof PartyLookSchema>;

const base = {
  look: PartyLookSchema.default({ accent: '#EC0E15', accent2: '#FFD700', bgFrom: '#1A0808', bgTo: '#080808' }),
  heading: Safe(40),
};

export const SpinnerConfigSchema = z
  .object({
    game: z.literal('spinner'),
    ...base,
    badge: Safe(40, 0).default(''),
    spinner: z
      .object({
        /** Forma del girador: flecha o aguja. Nunca una botella ni una copa. */
        shape: z.enum(['flecha', 'aguja']).default('flecha'),
        body: Hex.default('#E8C340'),
        tip: Hex.default('#2E6B3B'),
        labelColor: Hex.default('#2E6B3B'),
        /** Texto grande y pequeño sobre el girador (p. ej. el nombre de la marca). */
        labelTop: Safe(20, 0).default(''),
        labelBottom: Safe(30, 0).default(''),
      })
      .strict()
      .default({ shape: 'flecha', body: '#E8C340', tip: '#2E6B3B', labelColor: '#2E6B3B', labelTop: '', labelBottom: '' }),
    spinLabel: Safe(30).default('¡GIRAR!'),
    hint: Safe(120, 0).default('Pon varios dedos en la pantalla o presiona Girar'),
    modalTag: Safe(40).default('EL DESTINO DECIDIÓ'),
    continueLabel: Safe(40).default('¡CONTINUAR LA RUMBA!'),
    prompts: List(160, 3, 60),
  })
  .strict();

export const TruthDareConfigSchema = z
  .object({
    game: z.literal('truth-dare'),
    ...base,
    badge: Safe(40, 0).default(''),
    chooseTag: Safe(30).default('ELIGE TU DESTINO'),
    intro: Safe(200),
    truthLabel: Safe(20).default('VERDAD'),
    dareLabel: Safe(20).default('RETO'),
    skipButton: Safe(40).default('¿SE REHUSÓ? ¡PENITENCIA!'),
    skipTitle: Safe(40).default('¡PENITENCIA!'),
    skipText: Safe(200),
    truths: List(200, 3, 80),
    dares: List(200, 3, 80),
  })
  .strict();

export const CategoriesConfigSchema = z
  .object({
    game: z.literal('categories'),
    ...base,
    subtitle: Safe(120, 0).default(''),
    topicLabel: Safe(60).default('Pide nombres de:'),
    exampleLabel: Safe(30).default('Por ejemplo:'),
    seconds: z.number().int().min(3).max(30).default(5),
    goodLabel: Safe(50).default('¡RESPONDIÓ BIEN! (SIGUIENTE)'),
    lostLabel: Safe(50).default('¡SE EQUIVOCÓ / PERDIÓ!'),
    changeLabel: Safe(40).default('CAMBIAR TEMA'),
    lostMessage: Safe(200),
    topics: z
      .array(z.object({ topic: Safe(90), example: Safe(60) }).strict())
      .min(3)
      .max(60),
  })
  .strict();

export const NeverNeverConfigSchema = z
  .object({
    game: z.literal('never-never'),
    ...base,
    subtitle: Safe(120, 0).default(''),
    tag: Safe(40).default('CONFESIÓN DE RUMBA'),
    rule: Safe(80),
    nextLabel: Safe(40).default('SIGUIENTE CONFESIÓN'),
    phrases: List(200, 3, 100),
  })
  .strict();

export const HeadbandConfigSchema = z
  .object({
    game: z.literal('headband'),
    ...base,
    intro: Safe(200),
    startLabel: Safe(30).default('¡INICIAR RONDA!'),
    seconds: z.number().int().min(20).max(180).default(60),
    passLabel: Safe(20).default('PASAR'),
    correctLabel: Safe(20).default('¡ACERTÓ!'),
    /** Usa {n} donde va el número de aciertos. */
    endMessage: Safe(120).default('¡TIEMPO! Acertaste: {n} palabras.'),
    words: List(60, 5, 200),
  })
  .strict();

export const SteadyHandConfigSchema = z
  .object({
    game: z.literal('steady-hand'),
    ...base,
    instructions: Safe(160),
    footer: Safe(160, 0).default(''),
    /** Usa {t} donde va el tiempo logrado en segundos. */
    lostMessage: Safe(160).default('¡PERDISTE EL PULSO! Tiempo logrado: {t}s.'),
    restartHint: Safe(40).default('Toca para reiniciar'),
    safeRadius: z.number().int().min(25).max(70).default(40),
  })
  .strict();

export const PartyConfigSchema = z.discriminatedUnion('game', [
  SpinnerConfigSchema,
  TruthDareConfigSchema,
  CategoriesConfigSchema,
  NeverNeverConfigSchema,
  HeadbandConfigSchema,
  SteadyHandConfigSchema,
]);
export type PartyConfig = z.infer<typeof PartyConfigSchema>;
export type SpinnerConfig = z.infer<typeof SpinnerConfigSchema>;
export type TruthDareConfig = z.infer<typeof TruthDareConfigSchema>;
export type CategoriesConfig = z.infer<typeof CategoriesConfigSchema>;
export type NeverNeverConfig = z.infer<typeof NeverNeverConfigSchema>;
export type HeadbandConfig = z.infer<typeof HeadbandConfigSchema>;
export type SteadyHandConfig = z.infer<typeof SteadyHandConfigSchema>;

// ─────────────── Plantillas (contenido inicial, adaptado a las reglas de contenido) ───────────────

const LOOK = { accent: '#EC0E15', accent2: '#FFD700', bgFrom: '#1A0808', bgTo: '#080808' };

/** Datos de cabecera de cada plantilla (el manifiesto completo se arma con `defaultPartyManifest`). */
export const PARTY_TEMPLATES: Record<
  PartyGame,
  { moduleId: string; title: string; description: string; icon: string; minutes: number; players: { min: number; max: number }; config: PartyConfig }
> = {
  spinner: {
    moduleId: 'pico-de-flecha',
    title: 'Pico de Flecha',
    description: 'Gira la flecha y cumple el reto que te toque. Varios dedos en la pantalla, un solo destino.',
    icon: 'rotate_right',
    minutes: 10,
    players: { min: 2, max: 12 },
    config: {
      game: 'spinner',
      look: LOOK,
      heading: 'PICO DE FLECHA',
      badge: 'Rumba Caldense Oficial',
      spinner: { shape: 'flecha', body: '#E8C340', tip: '#2E6B3B', labelColor: '#2E6B3B', labelTop: 'AMARILLO', labelBottom: 'DE MANZANARES' },
      spinLabel: '¡GIRAR!',
      hint: 'Pon varios dedos en la pantalla o presiona Girar',
      modalTag: 'EL DESTINO DECIDIÓ',
      continueLabel: '¡CONTINUAR LA RUMBA!',
      prompts: [
        'Cuenta tu mejor anécdota de rumba en 30 segundos.',
        'Choca los cinco con la persona a tu derecha y dile un piropo bonito.',
        'Imita a tu cantante favorito durante 20 segundos.',
        'Muestra la última foto de tu galería de fotos.',
        'Elige a alguien del grupo para que baile contigo 10 segundos.',
        'Baila una canción de salsa o reguetón sin música durante 30 segundos.',
        'Confiesa tu amor platónico o cuenta una anécdota graciosa.',
        'Cuenta un secreto que nadie en esta sala sepa.',
        'Cambia de asiento con la persona que tienes enfrente y choca los cinco con ella.',
        'Habla con acento costeño o paisa hasta tu próximo turno.',
      ],
    },
  },
  'truth-dare': {
    moduleId: 'verdad-o-reto',
    title: 'Verdad o Reto',
    description: 'Elige verdad o reto. Si alguien se rehúsa, cumple una penitencia.',
    icon: 'forum',
    minutes: 10,
    players: { min: 2, max: 12 },
    config: {
      game: 'truth-dare',
      look: LOOK,
      heading: 'VERDAD O RETO',
      badge: 'Edición Rumba Caldense',
      chooseTag: 'ELIGE TU DESTINO',
      intro: 'Toca VERDAD o RETO abajo para comenzar a jugar. Si alguien se rehúsa, ¡cumple una penitencia!',
      truthLabel: 'VERDAD',
      dareLabel: 'RETO',
      skipButton: '¿SE REHUSÓ? ¡PENITENCIA!',
      skipTitle: '¡PENITENCIA!',
      skipText: '¡Se rehusó! Te toca cantar el coro de tu canción favorita o hacer 10 sentadillas.',
      truths: [
        '¿De quién de este grupo has estado enamorado/a en secreto?',
        '¿Cuál ha sido tu peor experiencia en una cita o salida nocturna?',
        '¿Qué es lo más vergonzoso que has hecho en una fiesta?',
        '¿Alguna vez has sido infiel o te han descubierto coqueteando?',
        'Si tuvieras que eliminar a un amigo de tu vida, ¿a quién elegirías?',
        '¿Qué es lo peor que has dicho de alguien en esta habitación a sus espaldas?',
        '¿Cuál fue el motivo real de tu última ruptura sentimental?',
        '¿Has robado algo alguna vez de un bar, motel o casa ajena?',
        '¿Cuál es el lugar más extraño donde has tenido un romance?',
        '¿Alguna vez te has arrepentido de un beso? ¿Con quién fue?',
      ],
      dares: [
        'Haz tu mejor cara de actor de telenovela sin usar las manos.',
        'Deja que el grupo te dibuje algo en la frente con marcador.',
        'Dile algo bonito a la persona a tu derecha y baila 15 segundos.',
        'Baila sin música durante 30 segundos en el medio del grupo.',
        'Haz una videollamada a alguien y dile que te vas a casar con alguien del grupo.',
        'Muestra los últimos 3 mensajes de tu chat de WhatsApp.',
        'Imita a alguien del grupo hasta que adivinen quién es.',
        'Aguanta la risa 20 segundos mirando a la persona frente a ti.',
      ],
    },
  },
  categories: {
    moduleId: 'cultura-rumbera',
    title: 'Cultura Rumbera',
    description: '1, 2, 3… ¡por ejemplo! Di un nombre del tema antes de que se acabe el tiempo.',
    icon: 'timer',
    minutes: 10,
    players: { min: 3, max: 12 },
    config: {
      game: 'categories',
      look: LOOK,
      heading: 'CULTURA RUMBERA',
      subtitle: '1, 2, 3... ¡Por ejemplo!',
      topicLabel: 'La rumba pide nombres de:',
      exampleLabel: 'Por ejemplo:',
      seconds: 5,
      goodLabel: '¡RESPONDIÓ BIEN! (SIGUIENTE)',
      lostLabel: '¡SE EQUIVOCÓ / PERDIÓ!',
      changeLabel: 'CAMBIAR TEMA',
      lostMessage: '¡TIEMPO AGOTADO O SE EQUIVOCÓ! ¡Te toca una penitencia!',
      topics: [
        { topic: 'Marcas colombianas de alimentos', example: 'Colombina' },
        { topic: 'Equipos del fútbol colombiano', example: 'Once Caldas' },
        { topic: 'Comidas típicas colombianas', example: 'Bandeja Paisa' },
        { topic: 'Excusas para no ir a trabajar o estudiar', example: 'Se me dañó la moto' },
        { topic: 'Nombres de abuelos tradicionales', example: 'Rigoberto' },
        { topic: 'Cosas que haces cuando estás emocionado', example: 'Llamar a tu mejor amigo' },
        { topic: 'Expresiones paisas', example: 'Parce' },
        { topic: 'Canciones de reguetón viejito', example: 'La Gasolina' },
        { topic: 'Cosas que te dan sueño', example: 'Una novela larga' },
        { topic: 'Novelas colombianas famosas', example: 'Pasión de Gavilanes' },
        { topic: 'Cantantes de música popular o vallenato', example: 'Darío Gómez' },
      ],
    },
  },
  'never-never': {
    moduleId: 'yo-nunca-nunca',
    title: 'Yo Nunca Nunca',
    description: 'Confesiones de rumba: si lo has hecho, levanta la mano.',
    icon: 'record_voice_over',
    minutes: 10,
    players: { min: 3, max: 12 },
    config: {
      game: 'never-never',
      look: LOOK,
      heading: 'YO NUNCA NUNCA',
      subtitle: 'Si lo has hecho... ¡levanta la mano!',
      tag: 'CONFESIÓN DE RUMBA',
      rule: '✋ SI LO HICISTE, LEVANTA LA MANO',
      nextLabel: 'SIGUIENTE CONFESIÓN',
      phrases: [
        'Yo nunca nunca he revisado el celular de mi pareja a escondidas.',
        'Yo nunca nunca he fingido una llamada para salir de una mala cita.',
        'Yo nunca nunca he besado a alguien en esta misma habitación.',
        'Yo nunca nunca he dicho una mentira en este juego.',
        'Yo nunca nunca he robado un cenicero o vaso de un bar o restaurante.',
        'Yo nunca nunca me he caído en la calle por estar mirando el celular.',
        'Yo nunca nunca he mandado un mensaje picante al chat equivocado.',
        'Yo nunca nunca he llorado para librarme de una multa de tránsito.',
        'Yo nunca nunca he stalkeado tanto a alguien que le di like a una foto vieja.',
        'Yo nunca nunca he vuelto con un/a ex después de jurar que jamás lo haría.',
      ],
    },
  },
  headband: {
    moduleId: 'el-frentazo',
    title: 'El Frentazo',
    description: 'Ponte el teléfono en la frente y adivina tantas palabras como puedas en 60 segundos.',
    icon: 'smartphone',
    minutes: 5,
    players: { min: 2, max: 12 },
    config: {
      game: 'headband',
      look: { accent: '#EC0E15', accent2: '#FFD700', bgFrom: '#000000', bgTo: '#000000' },
      heading: 'EL FRENTAZO',
      intro: 'Colócate el teléfono en la frente y adivina tantas palabras como puedas en 60 segundos.',
      startLabel: '¡INICIAR RONDA!',
      seconds: 60,
      passLabel: 'PASAR',
      correctLabel: '¡ACERTÓ!',
      endMessage: '¡TIEMPO! Acertaste: {n} palabras.',
      words: [
        'Shakira',
        'Maluma',
        'Bandeja Paisa',
        'Aguardiente Cristal',
        'Once Caldas',
        'Termales de Santa Rosa',
        'Café de Colombia',
        'Chiva Rumbera',
        'Arepa con Queso',
        'Salsa Choque',
        'Vallenato',
        'Feria de Manizales',
        'Sombrero Vueltiao',
      ],
    },
  },
  'steady-hand': {
    moduleId: 'mano-de-cirujano',
    title: 'Mano de Cirujano',
    description: 'Mantén presionado y sigue el punto verde sin salirte del círculo.',
    icon: 'pan_tool',
    minutes: 5,
    players: { min: 1, max: 12 },
    config: {
      game: 'steady-hand',
      look: LOOK,
      heading: 'MANO DE CIRUJANO',
      instructions: 'Mantén presionado y sigue el punto verde sin salirte del círculo',
      footer: 'Si te sales del círculo, ¡pierdes el turno!',
      lostMessage: '¡PERDISTE EL PULSO! Tiempo logrado: {t}s. ¡Pierdes el turno!',
      restartHint: 'Toca para reiniciar',
      safeRadius: 40,
    },
  },
};

/** Manifiesto completo de un juego de fiesta (Ruta A, sin puntuación). `overrides` permite cambiar identificador o versión. */
export function defaultPartyManifest(game: PartyGame, overrides: { moduleId?: string; version?: string; title?: string } = {}) {
  const t = PARTY_TEMPLATES[game];
  return {
    moduleId: overrides.moduleId ?? t.moduleId,
    provider: 'ILC propio',
    version: overrides.version ?? '1.0.0',
    title: overrides.title ?? t.title,
    description: t.description,
    route: 'A' as const,
    icon: t.icon,
    minutes: t.minutes,
    players: { ...t.players },
    languages: ['es-CO'],
    aspect: 'portrait' as const,
    permissions: [] as string[],
    dataPolicy: { collectsPersonalData: false, trackers: false },
    accessibility: { screenReader: true, reducedMotion: true },
    delivery: { kind: 'engine' as const, engine: 'party' as const, config: JSON.parse(JSON.stringify(t.config)) as unknown as Record<string, unknown> },
    scoring: { parcheScoreMax: 0, xpMax: 0, attemptsPerDay: 50, maxSeconds: 3600 },
  };
}
