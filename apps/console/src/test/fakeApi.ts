import { type ApprovalStatus, type CampaignDraft, type CampaignView, defaultPartyManifest, type Me } from '@ilc/contracts';
import { vi } from 'vitest';

/**
 * API falsa en memoria para las pruebas de la consola. Las reglas reales (RBAC, separación de funciones,
 * hash de contenido, checklist) se prueban contra PostgreSQL en apps/api/test/campaigns.spec.ts.
 */
export const DRAFT: CampaignDraft = {
  internalName: 'Ruta del Origen',
  publicTitle: 'Descubre el origen',
  publicDescription: '',
  objective: 'Exploración de la Ruta B',
  kpi: 'Misiones completadas',
  ownerTeam: 'Marca',
  brandSlugs: ['ilc'],
  channels: ['EVENTO'],
  territories: ['Caldas'],
  minAge: 18,
  startsAt: '2026-11-01T05:00:00.000Z',
  endsAt: '2026-12-31T05:00:00.000Z',
  terms: '',
  rules: { pointsBySku: {}, multipliers: [], energyMinutes: 45, sessionEndsAtLocalTime: '06:00', limits: { activationsPerUserPerDay: 3 } },
  theme: { mode: 'dark', brand: 'ilc' },
  dataUsage: { location: false, extraData: false },
  modules: [],
};

const SERIES = [{ date: '2026-10-12', count: 3 }];
const ANALYTICS = {
  days: 30,
  from: '2026-09-13T00:00:00.000Z',
  routeA: { claims: 1240, pointsIssued: 512000, reversals: { count: 0, points: 0 }, redemptions: 5, staffLinked: 2, byDay: SERIES, bySku: [], byCampaign: [] },
  routeB: {
    missionsStarted: 10,
    missionsCompleted: 7,
    completionRate: 0.7,
    xpGranted: 100,
    badgesAwarded: 3,
    sessionsCreated: 2,
    sessionsJoined: 4,
    byDay: SERIES,
    byModule: [],
  },
  ops: {
    codeChecks: { total: 9, unrecognized: 1 },
    ageGate: { passed: 20 },
    consentUpdates: 4,
    securityEvents: { total: 1, open: 1, high: 0 },
    campaignsByStatus: { ACTIVA: 2 },
    rewardZonesLowStock: 0,
    modulesAwaitingApproval: 0,
    shareCards: 0,
  },
};

const VENUE = {
  id: '00000000-0000-7000-8000-0000000000c1',
  name: 'Bar de prueba',
  channel: 'ON_PREMISE',
  city: 'Manizales',
  department: 'Caldas',
  address: '',
  status: 'PENDIENTE',
  listed: false,
  personnel: [],
  campaigns: [],
};

const STAFF_DASH = {
  venue: { name: 'Bar de prueba', city: 'Manizales' },
  code: 'K7M2Q9XD',
  qrPath: '/s/K7M2Q9XD',
  counts: { today: 3, week: 14 },
  weeklyGoal: 40,
  recent: [{ at: '2026-10-12T23:00:00.000Z', campaignTitle: 'Feria de Manizales', tableName: 'Mesa 4' }],
};

const DEALER_DASH = {
  venue: { id: VENUE.id, name: 'Bar de prueba', city: 'Manizales', channel: 'ON_PREMISE' },
  counts: { today: 4, week: 21, month: 80 },
  series: [{ date: '2026-10-12', count: 4 }],
  rank: { position: 3, total: 12, city: 'Manizales' },
  campaigns: [{ slug: 'feria', title: 'Feria de Manizales' }],
  profile: { description: '', hours: '', address: '', listed: false },
};

const REWARD = {
  id: '00000000-0000-7000-8000-0000000000b1',
  slug: 'gorra-prueba',
  name: 'Gorra de prueba',
  description: '',
  type: 'MERCHANDISING',
  icon: 'redeem',
  cost: 300,
  conditions: ['Se retira en el punto de entrega'],
  maxPerUser: 1,
  startsAt: '2026-10-01T05:00:00.000Z',
  endsAt: '2027-01-01T05:00:00.000Z',
  active: false,
  fulfillment: 'Trade Marketing',
  campaignSlug: null,
  zones: [{ zone: 'Manizales', available: 2, lowStockAlert: 3, low: true }],
  counts: { reserved: 0, delivered: 0, cancelled: 0 },
};

const MODULE = {
  moduleId: 'explorador',
  provider: 'ILC propio',
  route: 'B',
  activeVersion: null,
  versions: [
    {
      version: '0.9.0',
      status: 'EN_PRUEBA',
      manifest: { title: 'El Explorador', delivery: { kind: 'engine', engine: 'chapters' } },
      manifestHash: 'h',
      approvals: [
        { kind: 'MARCA', required: true, status: 'pending', note: null },
        { kind: 'JURIDICA', required: true, status: 'pending', note: null },
      ],
      createdAt: '2026-10-01T15:00:00.000Z',
    },
  ],
};

const PARTY_MODULE = {
  moduleId: 'verdad-o-reto',
  provider: 'ILC propio',
  route: 'B',
  activeVersion: '1.0.0',
  versions: [
    {
      version: '1.0.0',
      status: 'ACTIVO',
      manifest: defaultPartyManifest('truth-dare'),
      manifestHash: 'p',
      approvals: [],
      createdAt: '2026-10-01T15:00:00.000Z',
    },
  ],
};

const pending = (kind: ApprovalStatus['kind'], required = true): ApprovalStatus => ({
  kind,
  required,
  status: required ? 'pending' : 'not_required',
  byAlias: null,
  at: null,
  note: null,
});

export function campaignView(over: { state?: CampaignView['workingVersion']['state']; status?: CampaignView['status'] } = {}): CampaignView {
  const state = over.state ?? 'EN_REVISION';
  return {
    id: '00000000-0000-7000-8000-0000000000c1',
    slug: 'ruta-origen',
    route: 'B_EXPERIENCIAL',
    status: over.status ?? (state === 'BORRADOR' ? 'BORRADOR' : state === 'APROBADA' ? 'APROBADA' : 'EN_REVISION'),
    activeVersion: null,
    workingVersion: {
      id: '00000000-0000-7000-8000-0000000000d1',
      version: 1,
      state,
      contentHash: 'a'.repeat(64),
      draft: DRAFT,
      createdAt: '2026-10-01T15:00:00.000Z',
      submittedAt: null,
      publishedAt: null,
      approvals:
        state === 'APROBADA'
          ? [
              { ...pending('MARCA'), status: 'approved', byAlias: 'Revisión Marca', at: '2026-10-02T15:00:00.000Z' },
              { ...pending('JURIDICA'), status: 'approved', byAlias: 'Revisión Jurídica', at: '2026-10-02T16:00:00.000Z' },
              pending('PRIVACIDAD', false),
            ]
          : [pending('MARCA'), pending('JURIDICA'), pending('PRIVACIDAD', false)],
    },
    versions: [{ version: 1, state, createdAt: '2026-10-01T15:00:00.000Z' }],
    publish: { allowed: state === 'APROBADA', missing: state === 'APROBADA' ? [] : ['Aprobación de Marca', 'Aprobación de Jurídica'] },
    updatedAt: '2026-10-01T15:00:00.000Z',
  };
}

export function installFakeApi(options: { roles?: string[]; loggedIn?: boolean; campaign?: CampaignView } = {}) {
  const me: Me = {
    id: '00000000-0000-7000-8000-000000000001',
    alias: 'Ana Admin',
    status: 'ACTIVA',
    ageVerified: true,
    credentials: [{ provider: 'otp:email', hint: 'a•••@ilc.com.co' }],
    consents: [],
    roles: options.roles ?? ['ADMIN_MARCA'],
  };
  const state = {
    loggedIn: options.loggedIn ?? true,
    campaign: options.campaign ?? campaignView(),
    requests: [] as Array<{ method: string; url: string; body?: unknown }>,
  };

  const json = (status: number, body?: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fail = (status: number, code: string, message: string, fields?: Record<string, string[]>) =>
    json(status, { error: { code, message, retryable: false, ...(fields ? { fields } : {}) } });

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace(/^.*\/api\/v1/, '');
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
    state.requests.push({ method, url, body });

    if (url === '/auth/otp/request') return json(200, { maskedDestination: 'a•••@ilc.com.co', expiresInSeconds: 300, resendInSeconds: 30 });
    if (url === '/auth/otp/verify') {
      if (body.code !== '123456') return fail(422, 'OTP_INVALID', 'El código no es correcto.');
      state.loggedIn = true;
      return json(200, me);
    }
    if (!state.loggedIn) return fail(401, 'UNAUTHENTICATED', 'Necesitas iniciar sesión para continuar.');
    if (url === '/me') return json(200, me);
    if (url === '/auth/logout') {
      state.loggedIn = false;
      return json(204);
    }
    const c = state.campaign;
    if (url === '/admin/campaigns' && method === 'GET')
      return json(200, [
        {
          slug: c.slug,
          internalName: c.workingVersion.draft.internalName,
          route: c.route,
          status: c.status,
          brandSlugs: c.workingVersion.draft.brandSlugs,
          startsAt: c.workingVersion.draft.startsAt,
          endsAt: c.workingVersion.draft.endsAt,
          version: c.workingVersion.version,
          approvals: c.workingVersion.approvals.map(({ kind, status }) => ({ kind, status })),
        },
      ]);
    if (url === '/admin/campaigns' && method === 'POST') {
      if (!body.draft.internalName) return fail(400, 'VALIDATION_FAILED', 'Revisa los datos.', { 'draft.internalName': ['Mínimo 3 caracteres'] });
      state.campaign = {
        ...campaignView({ state: 'BORRADOR' }),
        slug: body.slug,
        workingVersion: { ...campaignView({ state: 'BORRADOR' }).workingVersion, draft: body.draft },
      };
      return json(201, state.campaign);
    }
    if (url === `/admin/campaigns/${c.slug}` && method === 'GET') return json(200, c);
    if (url === `/admin/campaigns/${c.slug}/approvals`) {
      const approvals = c.workingVersion.approvals.map((a) =>
        a.kind === body.kind ? { ...a, status: body.decision === 'APROBADO' ? ('approved' as const) : ('rejected' as const), byAlias: me.alias } : a,
      );
      state.campaign = { ...c, workingVersion: { ...c.workingVersion, approvals } };
      return json(200, state.campaign);
    }
    if (url === `/admin/campaigns/${c.slug}/publish`) {
      if (Object.keys(body.checklist).length < 11) return fail(409, 'CONFLICT', 'No se puede publicar: checklist.');
      state.campaign = { ...c, status: 'PROGRAMADA', activeVersion: 1, workingVersion: { ...c.workingVersion, state: 'PUBLICADA' } };
      return json(200, state.campaign);
    }
    if (url === '/admin/smarttags/batches')
      return json(200, [
        {
          id: '00000000-0000-7000-8000-0000000000b1',
          sku: 'RVC-8',
          productName: 'Ron Viejo de Caldas 8 años',
          label: '4092',
          supplier: 'Imprenta A',
          total: 3,
          byStatus: { ASIGNADO_A_LOTE: 3 },
          revokedAt: null,
          campaigns: [],
          createdAt: '2026-10-01T15:00:00.000Z',
        },
      ]);
    if (url === '/admin/smarttags/products')
      return json(200, [
        {
          id: 'p1',
          sku: 'RVC-8',
          name: 'Ron Viejo de Caldas 8 años',
          brandSlug: 'ron-viejo-de-caldas',
          brandLabel: 'Ron Viejo de Caldas',
          active: true,
          codes: 3,
        },
      ]);
    if (url === '/admin/smarttags/settings') return json(200, { urlTemplate: 'https://ilc.app/v/{token}' });
    if (url.startsWith('/admin/smarttags/batches/') && url.endsWith('/link')) return json(200, { created: 3, skipped: 0 });
    const preview = (status: string) => ({
      id: '00000000-0000-7000-8000-0000000000f1',
      fileName: 'lote.csv',
      status,
      totalRows: 2,
      validRows: 2,
      duplicateRows: 0,
      errorRows: 0,
      warnings: [],
      issues: [],
      groups: [{ sku: 'RVC-8', batch: '4100', rows: 2 }],
      createdAt: '2026-10-01T15:00:00.000Z',
      confirmedAt: status === 'CONFIRMADA' ? '2026-10-01T15:01:00.000Z' : null,
    });
    if (url.startsWith('/admin/smarttags/imports?fileName=')) return json(201, preview('PREVISTA'));
    if (url.endsWith('/confirm')) return json(200, preview('CONFIRMADA'));
    const ACCOUNT = {
      userId: '00000000-0000-7000-8000-0000000000aa',
      alias: 'Jugador',
      status: 'ACTIVA',
      balance: 500,
      ledgerSum: 500,
      xp: 120,
      level: 2,
      entries: [
        {
          id: '00000000-0000-7000-8000-0000000000e1',
          kind: 'credit',
          type: 'CREDITO',
          amount: 500,
          description: 'Código activado',
          detail: 'Ruta del Origen',
          at: '2026-10-01T15:00:00.000Z',
          expiresAt: null,
          remaining: 500,
          compensated: false,
          reason: null,
          sourceType: 'claim',
          sourceId: 'c1',
        },
      ],
    };
    if (url.startsWith('/admin/economy/accounts?claimId=')) return fail(404, 'NOT_FOUND', 'No encontramos esa cuenta.');
    if (url.startsWith('/admin/economy/accounts?userId=')) return json(200, ACCOUNT);
    if (url.endsWith('/reverse')) return json(200, { ...ACCOUNT, balance: 0, ledgerSum: 0 });
    if (url === '/admin/economy/badges') return json(200, []);
    if (url.startsWith('/admin/analytics')) return json(200, ANALYTICS);
    if (url === '/admin/referrals/settings' && method === 'GET')
      return json(200, { enabled: false, referrerPoints: 0, referrerXp: 0, dailyCap: 5, weeklyCap: 20, attributionWindowDays: 7 });
    if (url === '/admin/referrals/settings' && method === 'PUT') return json(200, body);
    if (url.startsWith('/admin/referrals/summary')) return json(200, { days: 30, attributed: 4, rewardedByClaim: 1, rewardedByMission: 1, capped: 0 });
    if (url === '/admin/contacts/opt-ins')
      return json(200, {
        total: 1,
        rows: [{ alias: 'Ana', email: 'ana@ejemplo.test', phone: null, optedInAt: '2026-10-01T15:00:00.000Z', source: 'registro' }],
      });
    if (url === '/admin/venues') return json(200, [VENUE]);
    if (url.startsWith('/admin/venues/') && url.endsWith('/approve')) return json(200, { ...VENUE, status: 'APROBADO' });
    if (url === '/staff/me') return json(200, STAFF_DASH);
    if (url === '/dealer/me') return json(200, DEALER_DASH);
    if (url === '/admin/rewards') return json(200, [REWARD]);
    if (url.startsWith('/admin/rewards/claims')) return json(200, []);
    if (url.endsWith('/activate') && url.startsWith('/admin/rewards')) return json(200, { ...REWARD, active: true });
    if (url === '/admin/games/modules' && method === 'POST') return json(201, PARTY_MODULE);
    if (url === '/admin/games/modules') return json(200, [MODULE, PARTY_MODULE]);
    if (url === '/admin/games/guide') return json(200, { markdown: '# Guía de integración de juegos' });
    if (url === '/admin/games/defaults') return json(200, { modules: [] });
    if (url.includes('/approvals')) return json(200, MODULE);
    return fail(404, 'NOT_FOUND', `Sin ruta falsa para ${method} ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return state;
}
