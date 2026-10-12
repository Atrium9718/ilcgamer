import type { CampaignDetailData } from './CampaignDetailView.tsx';
import type { CampaignEditorValue } from './CampaignEditorView.tsx';
import type { CampaignRow } from './CampaignListView.tsx';

/** Datos ilustrativos para Storybook y pruebas (no son valores aprobados por ILC). */
export const CHECKLIST_DEMO = [
  { key: 'menores', label: 'Público, canales y distribución minimizan exposición a menores.' },
  { key: 'mecanica', label: 'La mecánica comercial, límites, multiplicadores y términos están aprobados.' },
  { key: 'sinPresion', label: 'Ningún reto premia velocidad de ingesta, intoxicación, tolerancia o presión social.' },
  { key: 'assets', label: 'Textos, logos, fotografía, música y assets están autorizados.' },
  { key: 'legales', label: 'Control de edad y advertencias legales aplicables están implementados.' },
  { key: 'premios', label: 'Los premios tienen inventario, condiciones, fechas, topes y responsable de entrega.' },
];

export const ROWS_DEMO: CampaignRow[] = [
  {
    slug: 'feria-manizales-2027',
    internalName: 'Feria de Manizales 2027',
    route: 'A_COMERCIAL',
    status: 'ACTIVA',
    brandLabels: ['Ron Viejo de Caldas'],
    windowLabel: '2–12 ene. 2027',
    version: 3,
    approvals: [
      { kind: 'MARCA', status: 'approved' },
      { kind: 'JURIDICA', status: 'approved' },
      { kind: 'PRIVACIDAD', status: 'not_required' },
    ],
  },
  {
    slug: 'ruta-origen',
    internalName: 'Ruta del Origen',
    route: 'B_EXPERIENCIAL',
    status: 'EN_REVISION',
    brandLabels: ['ILC corporativo'],
    windowLabel: '1 nov.–31 dic. 2026',
    version: 1,
    approvals: [
      { kind: 'MARCA', status: 'approved' },
      { kind: 'JURIDICA', status: 'pending' },
      { kind: 'PRIVACIDAD', status: 'pending' },
    ],
  },
  {
    slug: 'piloto-pereira',
    internalName: 'Piloto Pereira',
    route: 'A_COMERCIAL',
    status: 'BORRADOR',
    brandLabels: ['Aguardiente Cristal'],
    windowLabel: '1–28 feb. 2027',
    version: 1,
    approvals: [
      { kind: 'MARCA', status: 'pending' },
      { kind: 'JURIDICA', status: 'pending' },
      { kind: 'PRIVACIDAD', status: 'not_required' },
    ],
  },
];

export const DETAIL_DEMO: CampaignDetailData = {
  slug: 'fin-de-ano-2026',
  internalName: 'Temporada Fin de Año',
  publicTitle: 'Fin de año con historia',
  publicDescription: 'Explora el origen y activa tus códigos en establecimientos aliados.',
  objective: 'Activaciones comerciales válidas y exploración de la Ruta del Origen',
  kpi: 'Activaciones válidas y misiones completadas',
  ownerTeam: 'Trade Marketing',
  route: 'MIXTA',
  status: 'APROBADA',
  brandLabels: ['Aguardiente Amarillo de Manzanares'],
  channelLabels: ['On-premise', 'Eventos'],
  territories: ['Caldas', 'Risaralda'],
  windowLabel: '15–31 dic. 2026',
  minAge: 18,
  terms: 'Términos de prueba pendientes de revisión jurídica.',
  activeVersion: null,
  working: { version: 2, state: 'APROBADA', stateLabel: 'Aprobada' },
  versions: [
    { version: 2, stateLabel: 'Aprobada', createdLabel: '10 dic. 2026' },
    { version: 1, stateLabel: 'Reemplazada', createdLabel: '2 dic. 2026' },
  ],
  rules: {
    pointsBySku: [
      { sku: 'AA-750', points: 300 },
      { sku: 'RVC-8', points: 500 },
    ],
    multipliers: [{ label: 'Navidad', factor: 1.5, windowLabel: '24–26 dic.' }],
    energyMinutes: 45,
    sessionEndsAtLocalTime: '06:00',
    activationsPerUserPerDay: 3,
  },
  theme: { mode: 'dark', brand: 'aguardiente-amarillo' },
  dataUsage: { location: false, extraData: false },
};

export const EDITOR_DEMO: CampaignEditorValue = {
  slug: 'fin-de-ano-2026',
  route: 'MIXTA',
  internalName: 'Temporada Fin de Año',
  publicTitle: 'Fin de año con historia',
  publicDescription: '',
  objective: 'Activaciones comerciales válidas',
  kpi: 'Activaciones válidas',
  ownerTeam: 'Trade Marketing',
  brandSlugs: ['aguardiente-amarillo'],
  channels: ['ON_PREMISE'],
  territoriesText: 'Caldas, Risaralda',
  minAge: 18,
  startsAt: '2026-12-15T00:00',
  endsAt: '2026-12-31T23:59',
  terms: '',
  points: [{ sku: 'AA-750', points: 300 }],
  multipliers: [],
  energyMinutes: 45,
  sessionEndsAtLocalTime: '06:00',
  pointsExpiryDays: null,
  activationsPerUserPerDay: 3,
  xpPerActivation: 25,
  modules: [],
  themeMode: 'dark',
  themeBrand: 'aguardiente-amarillo',
  accent: null,
  location: false,
  extraData: false,
};

export const BRAND_OPTIONS = [
  { slug: 'ilc', label: 'ILC corporativo' },
  { slug: 'ron-viejo-de-caldas', label: 'Ron Viejo de Caldas' },
  { slug: 'aguardiente-amarillo', label: 'Aguardiente Amarillo de Manzanares' },
  { slug: 'aguardiente-cristal', label: 'Aguardiente Cristal' },
];

export const BATCHES_DEMO = [
  {
    id: 'b1',
    productName: 'Ron Viejo de Caldas 8 años',
    sku: 'RVC-8',
    label: '4092',
    supplier: 'Imprenta A',
    total: 12000,
    counts: { asignados: 0, distribuidos: 11950, alerta: 3, revocados: 0 },
    revoked: false,
    campaigns: [{ slug: 'feria-manizales-2027', title: 'Feria de Manizales 2027', codes: 11950, claimed: 2310 }],
  },
  {
    id: 'b2',
    productName: 'Aguardiente Amarillo de Manzanares',
    sku: 'AA-750',
    label: '118',
    supplier: 'Imprenta A',
    total: 8000,
    counts: { asignados: 8000, distribuidos: 0, alerta: 0, revocados: 0 },
    revoked: false,
    campaigns: [],
  },
  {
    id: 'b3',
    productName: 'Aguardiente Cristal',
    sku: 'AC-750',
    label: '77',
    supplier: null,
    total: 500,
    counts: { asignados: 0, distribuidos: 0, alerta: 0, revocados: 500 },
    revoked: true,
    campaigns: [],
  },
];

export const PRODUCTS_DEMO = [
  { sku: 'RVC-8', name: 'Ron Viejo de Caldas 8 años', brandLabel: 'Ron Viejo de Caldas', codes: 12000 },
  { sku: 'AA-750', name: 'Aguardiente Amarillo de Manzanares', brandLabel: 'Aguardiente Amarillo de Manzanares', codes: 8000 },
];

export const PREVIEW_DEMO = {
  fileName: 'lote-4093.csv',
  status: 'PREVISTA' as const,
  totalRows: 10000,
  validRows: 9980,
  duplicateRows: 15,
  errorRows: 5,
  warnings: ['12 tokens tienen menos de 10 caracteres: son más fáciles de adivinar. Pide a la imprenta tokens más largos.'],
  issues: [
    { line: 14, tokenHint: '••••7K2Q', message: 'Token repetido dentro del archivo' },
    { line: 220, tokenHint: '••••A1B2', message: 'SKU RVC-80 no existe en el catálogo' },
  ],
  groups: [{ sku: 'RVC-8', batch: '4093', rows: 9980 }],
};

export const ACCOUNT_DEMO = {
  idHint: '…3f9a',
  alias: 'Jugador',
  status: 'ACTIVA',
  balance: 1300,
  ledgerSum: 1300,
  xp: 420,
  level: 3,
  entries: [
    {
      id: 'e4',
      type: 'REVERSO' as const,
      kind: 'reversal' as const,
      amount: -300,
      description: 'Reverso auditado',
      detail: 'Código activado · Feria de Manizales',
      dateLabel: '12 oct. 2026',
      remaining: null,
      compensated: false,
      reason: 'Código reportado por el comercio como robado',
    },
    {
      id: 'e3',
      type: 'CREDITO' as const,
      kind: 'credit' as const,
      amount: 300,
      description: 'Código activado',
      detail: 'Feria de Manizales',
      dateLabel: '11 oct. 2026',
      remaining: 0,
      compensated: true,
      reason: null,
    },
    {
      id: 'e2',
      type: 'CREDITO' as const,
      kind: 'credit' as const,
      amount: 500,
      description: 'Código activado',
      detail: 'Feria de Manizales',
      dateLabel: '10 oct. 2026',
      expiresLabel: '30 abr. 2027',
      remaining: 500,
      compensated: false,
      reason: null,
    },
    {
      id: 'e1',
      type: 'CREDITO' as const,
      kind: 'credit' as const,
      amount: 800,
      description: 'Código activado',
      detail: 'Temporada Fin de Año',
      dateLabel: '2 oct. 2026',
      remaining: 800,
      compensated: false,
      reason: null,
    },
  ],
};

export const BADGES_DEMO = [
  { slug: 'guardian-del-bosque', name: 'Guardián del bosque', icon: 'filter_vintage', awarded: 124 },
  { slug: 'lector-de-pistas', name: 'Lector de pistas', icon: 'menu_book', awarded: 87 },
  { slug: 'parche-cooperativo', name: 'Parche cooperativo', icon: 'diversity_3', awarded: 40 },
];

export const MODULES_DEMO: import('./GamesView.tsx').ModuleRow[] = [
  {
    moduleId: 'trivia-origen',
    title: 'Trivia del origen',
    provider: 'ILC propio',
    route: 'A',
    delivery: 'engine',
    activeVersion: '1.0.0',
    versions: [
      {
        version: '1.0.0',
        status: 'ACTIVO',
        approvals: [
          { kind: 'MARCA', required: true, status: 'approved', note: null },
          { kind: 'JURIDICA', required: true, status: 'approved', note: null },
          { kind: 'PRIVACIDAD', required: false, status: 'not_required', note: null },
        ],
      },
    ],
  },
  {
    moduleId: 'explorador',
    title: 'El Explorador · Ruta del Origen',
    provider: 'ILC propio',
    route: 'B',
    delivery: 'engine',
    activeVersion: null,
    versions: [
      {
        version: '0.9.0',
        status: 'EN_PRUEBA',
        approvals: [
          { kind: 'MARCA', required: true, status: 'pending', note: null },
          { kind: 'JURIDICA', required: true, status: 'rejected', note: 'Falta la advertencia legal' },
        ],
      },
    ],
  },
  {
    moduleId: 'maestros-sabor',
    title: 'Maestros de sabor',
    provider: 'Branded Mini Games',
    route: 'B',
    delivery: 'iframe',
    activeVersion: '1.1.0',
    versions: [
      {
        version: '1.1.0',
        status: 'ACTIVO',
        approvals: [
          { kind: 'MARCA', required: true, status: 'approved', note: null },
          { kind: 'JURIDICA', required: true, status: 'approved', note: null },
          { kind: 'PRIVACIDAD', required: true, status: 'approved', note: null },
        ],
      },
      {
        version: '1.0.0',
        status: 'DESACTIVADO',
        approvals: [
          { kind: 'MARCA', required: true, status: 'approved', note: null },
          { kind: 'JURIDICA', required: true, status: 'approved', note: null },
        ],
      },
    ],
  },
];

export const REWARDS_ADMIN_DEMO: import('./RewardsAdminView.tsx').RewardAdminRow[] = [
  {
    id: 'r1',
    name: 'Gorra de prueba',
    slug: 'gorra-prueba',
    type: 'MERCHANDISING',
    cost: 300,
    active: true,
    fulfillment: 'Trade Marketing',
    campaignSlug: null,
    zones: [
      { zone: 'Manizales', available: 2, lowStockAlert: 3, low: true },
      { zone: 'Pereira', available: 40, lowStockAlert: 5, low: false },
      { zone: 'Armenia', available: 0, lowStockAlert: 5, low: true },
    ],
    counts: { reserved: 3, delivered: 12, cancelled: 1 },
  },
  {
    id: 'r2',
    name: 'Tour cultural de prueba',
    slug: 'tour-prueba',
    type: 'EXPERIENCIA',
    cost: 800,
    active: false,
    fulfillment: 'Equipo de visitas',
    campaignSlug: 'feria-manizales-2027',
    zones: [{ zone: 'Manizales', available: 10, lowStockAlert: 2, low: false }],
    counts: { reserved: 0, delivered: 0, cancelled: 0 },
  },
];

export const CLAIMS_ADMIN_DEMO: import('./RewardsAdminView.tsx').ClaimAdminRow[] = [
  {
    id: 'c1',
    code: 'K7M2Q9XD',
    rewardName: 'Gorra de prueba',
    zone: 'Manizales',
    status: 'RESERVADO',
    cost: 300,
    userAlias: 'Jugador 41',
    createdLabel: '12 oct.',
    expiresLabel: 'Vence el 26 oct.',
    cancelReason: null,
  },
  {
    id: 'c2',
    code: 'A1B2C3D4',
    rewardName: 'Gorra de prueba',
    zone: 'Pereira',
    status: 'ANULADO',
    cost: 300,
    userAlias: 'Jugador 12',
    createdLabel: '10 oct.',
    cancelReason: 'Producto dañado',
  },
];
