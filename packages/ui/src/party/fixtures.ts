import type {
  CategoriesConfigView,
  HeadbandConfigView,
  NeverNeverConfigView,
  PartyLookView,
  SpinnerConfigView,
  SteadyHandConfigView,
  TruthDareConfigView,
} from './types.ts';

/** Configuraciones de ejemplo para historias y pruebas (contenido de prueba). */
export const LOOK: PartyLookView = { accent: '#EC0E15', accent2: '#FFD700', bgFrom: '#1A0808', bgTo: '#080808' };

export const SPINNER: SpinnerConfigView = {
  game: 'spinner',
  look: LOOK,
  heading: 'PICO DE FLECHA',
  badge: 'Rumba Caldense Oficial',
  spinner: { shape: 'flecha', body: '#E8C340', tip: '#2E6B3B', labelColor: '#2E6B3B', labelTop: 'AMARILLO', labelBottom: 'DE MANZANARES' },
  spinLabel: '¡GIRAR!',
  hint: 'Pon un dedo cada quien, espera 1–2 segundos y la flecha señala a uno; o presiona Girar',
  modalTag: 'EL DESTINO DECIDIÓ',
  continueLabel: '¡CONTINUAR LA RUMBA!',
  prompts: ['Reto de prueba uno', 'Reto de prueba dos', 'Reto de prueba tres'],
};
export const TRUTH_DARE: TruthDareConfigView = {
  game: 'truth-dare',
  look: LOOK,
  heading: 'VERDAD O RETO',
  badge: 'Edición Rumba Caldense',
  chooseTag: 'ELIGE TU DESTINO',
  intro: 'Toca VERDAD o RETO abajo para comenzar a jugar.',
  truthLabel: 'VERDAD',
  dareLabel: 'RETO',
  skipButton: '¿SE REHUSÓ? ¡PENITENCIA!',
  skipTitle: '¡PENITENCIA!',
  skipText: 'Te toca cantar el coro de tu canción favorita.',
  truths: ['Verdad de prueba uno', 'Verdad de prueba dos', 'Verdad de prueba tres'],
  dares: ['Reto de prueba uno', 'Reto de prueba dos', 'Reto de prueba tres'],
};
export const CATEGORIES: CategoriesConfigView = {
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
    { topic: 'Equipos del fútbol colombiano', example: 'Once Caldas' },
    { topic: 'Comidas típicas colombianas', example: 'Bandeja Paisa' },
    { topic: 'Novelas colombianas famosas', example: 'Pasión de Gavilanes' },
  ],
};
export const NEVER_NEVER: NeverNeverConfigView = {
  game: 'never-never',
  look: LOOK,
  heading: 'YO NUNCA NUNCA',
  subtitle: 'Si lo has hecho... ¡levanta la mano!',
  tag: 'CONFESIÓN DE RUMBA',
  rule: '✋ SI LO HICISTE, LEVANTA LA MANO',
  nextLabel: 'SIGUIENTE CONFESIÓN',
  phrases: ['Yo nunca nunca he cantado en la ducha.', 'Yo nunca nunca he llegado tarde a una fiesta.', 'Yo nunca nunca he bailado sin música.'],
};
export const HEADBAND: HeadbandConfigView = {
  game: 'headband',
  look: { accent: '#EC0E15', accent2: '#FFD700', bgFrom: '#000000', bgTo: '#000000' },
  heading: 'EL FRENTAZO',
  intro: 'Colócate el teléfono en la frente y adivina tantas palabras como puedas en 60 segundos.',
  startLabel: '¡INICIAR RONDA!',
  seconds: 60,
  passLabel: 'PASAR',
  correctLabel: '¡ACERTÓ!',
  endMessage: '¡TIEMPO! Acertaste: {n} palabras.',
  words: ['Shakira', 'Vallenato', 'Bandeja Paisa', 'Once Caldas', 'Café de Colombia'],
};
export const STEADY_HAND: SteadyHandConfigView = {
  game: 'steady-hand',
  look: LOOK,
  heading: 'MANO DE CIRUJANO',
  instructions: 'Mantén presionado y sigue el punto verde sin salirte del círculo',
  footer: 'Si te sales del círculo, ¡pierdes el turno!',
  lostMessage: '¡PERDISTE EL PULSO! Tiempo logrado: {t}s. ¡Pierdes el turno!',
  restartHint: 'Toca para reiniciar',
  safeRadius: 40,
};
