import type { Experience, LedgerEntryView, Participant, QuickGame, RewardDetail, RewardView } from '@ilc/ui';

/**
 * DATOS DE DEMOSTRACIÓN — solo con VITE_DEMO_DATA=true. Valores de puntos, productos y lotes son
 * ilustrativos (los define ILC por campaña). Nada de esto debe llegar a producción.
 */
export const DEMO = {
  currencyName: 'Puntos ILC',
  campaignLabel: 'Feria de Manizales',
  energyMinutes: 45,
  codes: {
    'demo-reconocido': {
      status: 'recognized',
      brand: 'Ron Viejo de Caldas',
      theme: 'ron-viejo-de-caldas',
      product: 'Ron Viejo de Caldas Gran Reserva Especial · Lote #4092',
      points: 500,
      canActivate: true,
    },
    'demo-amarillo': {
      status: 'recognized',
      brand: 'Aguardiente Amarillo de Manzanares',
      theme: 'aguardiente-amarillo',
      product: 'Aguardiente Amarillo de Manzanares · Lote #1180',
      points: 300,
      canActivate: true,
    },
    'demo-reclamado': {
      status: 'already_claimed',
      brand: 'Ron Viejo de Caldas',
      theme: 'ron-viejo-de-caldas',
      product: 'Ron Viejo de Caldas · Lote #4092',
      points: 0,
      canActivate: false,
    },
    'demo-revision': { status: 'needs_review', brand: 'Industria Licorera de Caldas', theme: 'ilc', product: undefined, points: 0, canActivate: false },
  } as Record<
    string,
    { status: 'recognized' | 'already_claimed' | 'needs_review'; brand: string; theme: string; product?: string; points: number; canActivate: boolean }
  >,
  parche: { id: 'demo-parche', pin: '4729', name: 'Los del bosque de niebla', brand: 'Ron Viejo de Caldas' },
  participants: [
    { id: 'yo', alias: 'Tú', isHost: true, status: 'connected' },
    { id: 'u2', alias: 'Valentina', status: 'connected' },
    { id: 'u3', alias: 'Juan', status: 'connected' },
    { id: 'u4', alias: 'Caro', status: 'reconnecting' },
  ] satisfies Participant[],
  quickGames: [
    { id: 'trivia', title: 'Trivia del origen', icon: 'psychology', minutes: 3, players: '1-8' },
    { id: 'ruleta', title: 'La ruleta ILC', icon: 'rotate_right', minutes: 1, players: '2-8' },
    { id: 'charadas', title: 'Charadas de Caldas', icon: 'theater_comedy', minutes: 5, players: '3-10' },
    { id: 'verdad-reto', title: 'Verdad o reto cultural', icon: 'forum', minutes: 5, players: '2-8' },
  ] satisfies QuickGame[],
  experiences: [
    {
      id: 'explorador',
      title: 'El Explorador · Ruta del Origen',
      subtitle: 'Recorre por capítulos el agua, el paisaje, el roble y la historia de Caldas.',
      progress: { current: 2, total: 6 },
      tag: 'En progreso',
    },
    { id: 'mixologia', title: 'Maestros de sabor · Mixología', subtitle: 'Aromas, ingredientes y preparaciones, con alternativas sin alcohol.', tag: 'Nuevo' },
  ] satisfies Experience[],
  progress: {
    xp: 1840,
    level: { number: 5, fromXp: 1500, nextAt: 3000 },
    badges: [
      { slug: 'guardianes-del-bosque', name: 'Guardianes del bosque', icon: 'filter_vintage', earned: true, awardedAt: '2026-10-01T15:00:00.000Z' },
      { slug: 'lector-de-pistas', name: 'Lector de pistas', icon: 'menu_book', earned: true, awardedAt: '2026-10-03T15:00:00.000Z' },
      { slug: 'parche-cooperativo', name: 'Parche cooperativo', icon: 'diversity_3', earned: true, awardedAt: '2026-10-05T15:00:00.000Z' },
      { slug: 'alquimia-del-roble', name: 'Alquimia del roble', icon: 'park', earned: false, awardedAt: null },
      { slug: 'custodio-del-tiempo', name: 'Custodio del tiempo', icon: 'hourglass_empty', earned: false, awardedAt: null },
      { slug: 'gran-maestro', name: 'Gran maestro', icon: 'workspace_premium', earned: false, awardedAt: null },
    ],
  },
  balance: 2300,
  ledger: [
    { id: '1', kind: 'credit', amount: 500, description: 'Código activado', detail: 'Ron Viejo de Caldas · Feria de Manizales', dateLabel: '11 oct.' },
    { id: '2', kind: 'debit', amount: -1200, description: 'Canje: Gorra oficial ILC', detail: 'Recompensa', dateLabel: '5 oct.' },
    { id: '3', kind: 'credit', amount: 300, description: 'Código activado', detail: 'Aguardiente Amarillo', dateLabel: '2 oct.' },
    { id: '4', kind: 'credit', amount: 50, description: 'Referido completó su perfil', dateLabel: '28 sep.' },
    { id: '5', kind: 'reversal', amount: -50, description: 'Reverso: código anulado', dateLabel: '27 sep.' },
  ] satisfies LedgerEntryView[],
  rewards: [
    { id: 'insignia', name: 'Insignia digital Feria', cost: 200, icon: 'military_tech', availability: 'Entrega inmediata' },
    { id: 'gorra', name: 'Gorra oficial ILC', cost: 1200, icon: 'styler', availability: 'Quedan 14 en Manizales' },
    { id: 'camiseta', name: 'Camiseta Ruta del Origen', cost: 1800, icon: 'apparel' },
    { id: 'visita', name: 'Visita guiada a ILC', cost: 5000, icon: 'tour' },
  ] satisfies RewardView[],
  rewardConditions: [
    'Disponible en Manizales y Pereira',
    'Retiro en punto aliado en 15 días',
    'Máximo 1 por persona',
    'Vigencia del canje: hasta 31 dic. 2026',
  ],
} as const;

export function demoRewardDetail(id: string): RewardDetail | undefined {
  const r = DEMO.rewards.find((x) => x.id === id);
  return r ? { ...r, conditions: [...DEMO.rewardConditions], termsHref: '#terminos-recompensa' } : undefined;
}
