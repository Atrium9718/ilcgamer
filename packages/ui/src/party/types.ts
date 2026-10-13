/**
 * Tipos de la configuración de los juegos de fiesta tal como las vistas la reciben. Reflejan `PartyConfig` de @ilc/contracts
 * (la API los valida; la PWA pasa la respuesta directamente y el compilador avisa si dejan de coincidir).
 */
export interface PartyLookView {
  accent: string;
  accent2: string;
  bgFrom: string;
  bgTo: string;
}

interface Base {
  look: PartyLookView;
  heading: string;
}

export interface SpinnerConfigView extends Base {
  game: 'spinner';
  badge: string;
  spinner: { shape: 'flecha' | 'aguja'; body: string; tip: string; labelColor: string; labelTop: string; labelBottom: string; image?: string };
  spinLabel: string;
  hint: string;
  modalTag: string;
  continueLabel: string;
  prompts: string[];
}
export interface TruthDareConfigView extends Base {
  game: 'truth-dare';
  badge: string;
  chooseTag: string;
  intro: string;
  truthLabel: string;
  dareLabel: string;
  skipButton: string;
  skipTitle: string;
  skipText: string;
  truths: string[];
  dares: string[];
}
export interface CategoriesConfigView extends Base {
  game: 'categories';
  subtitle: string;
  topicLabel: string;
  exampleLabel: string;
  seconds: number;
  goodLabel: string;
  lostLabel: string;
  changeLabel: string;
  lostMessage: string;
  topics: Array<{ topic: string; example: string }>;
}
export interface NeverNeverConfigView extends Base {
  game: 'never-never';
  subtitle: string;
  tag: string;
  rule: string;
  nextLabel: string;
  phrases: string[];
}
export interface HeadbandConfigView extends Base {
  game: 'headband';
  intro: string;
  startLabel: string;
  seconds: number;
  passLabel: string;
  correctLabel: string;
  endMessage: string;
  words: string[];
}
export interface SteadyHandConfigView extends Base {
  game: 'steady-hand';
  instructions: string;
  footer: string;
  lostMessage: string;
  restartHint: string;
  safeRadius: number;
}

export type PartyConfigView = SpinnerConfigView | TruthDareConfigView | CategoriesConfigView | NeverNeverConfigView | HeadbandConfigView | SteadyHandConfigView;
