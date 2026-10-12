import type { ApprovalStatus, CampaignDraft, CampaignView, Me } from '@ilc/contracts';
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
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
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
    return fail(404, 'NOT_FOUND', `Sin ruta falsa para ${method} ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return state;
}
