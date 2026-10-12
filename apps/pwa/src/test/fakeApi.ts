import type { ConsentState, Me } from '@ilc/contracts';
import { vi } from 'vitest';

/**
 * API falsa en memoria para pruebas de la PWA. Replica los contratos y reglas de identidad de la API real
 * (las reglas reales se prueban en apps/api/test/identity.spec.ts contra PostgreSQL y Redis).
 */
export function installFakeApi(options: { loggedIn?: boolean } = {}) {
  const purposes = ['TERMINOS_Y_PRIVACIDAD', 'MARKETING', 'UBICACION'] as const;
  const state = {
    me: null as Me | null,
    consentLog: [] as Array<{ purpose: string; granted: boolean; source: string }>,
    otpCode: '123456',
    requests: [] as string[],
    lastAgeGate: undefined as unknown,
  };
  const consents = (): ConsentState[] =>
    purposes.map((purpose) => {
      const last = [...state.consentLog].reverse().find((c) => c.purpose === purpose);
      return { purpose, granted: last?.granted ?? false, noticeVersion: last ? '1.0' : null, updatedAt: last ? '2026-10-12T12:00:00.000Z' : null };
    });
  const newMe = (): Me => ({
    id: '00000000-0000-7000-8000-000000000001',
    alias: 'Jugador',
    status: 'TEMPORAL',
    ageVerified: true,
    credentials: [],
    consents: consents(),
    roles: [],
  });
  if (options.loggedIn) state.me = newMe();

  const json = (status: number, body?: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fail = (status: number, code: string, message: string) => json(status, { error: { code, message, retryable: false } });

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace(/^.*\/api\/v1/, '');
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    state.requests.push(`${method} ${url}`);

    if (url === '/config')
      return json(200, { currencyName: 'Puntos ILC', legalNoticeVersion: '1.0', minAge: 18, otpChannels: ['whatsapp', 'sms', 'email'], oauthProviders: [] });
    if (url === '/campaigns/feria-cristal')
      return json(200, {
        slug: 'feria-cristal',
        title: 'Feria con Cristal',
        description: '',
        route: 'B_EXPERIENCIAL',
        minAge: 21,
        startsAt: '2026-10-01T05:00:00.000Z',
        endsAt: '2027-01-31T05:00:00.000Z',
        theme: { mode: 'light', brand: 'aguardiente-cristal' },
        energyMinutes: 45,
        terms: '',
      });
    if (url === '/age-gate' && method === 'POST') {
      state.lastAgeGate = body;
      const year = Number(String(body.birthDate).slice(0, 4));
      if (new Date().getFullYear() - year < 18) return fail(403, 'AGE_REQUIREMENT_NOT_MET', 'Este contenido es solo para mayores de 18 años.');
      state.me = state.me ?? newMe();
      return json(200, state.me);
    }
    if (!state.me) return fail(401, 'UNAUTHENTICATED', 'Necesitas iniciar sesión para continuar.');
    if (url === '/me' && method === 'GET') return json(200, { ...state.me, consents: consents() });
    if (url === '/me' && method === 'PATCH') {
      state.me = { ...state.me, alias: body.alias };
      return json(200, state.me);
    }
    if (url === '/me' && method === 'DELETE') {
      state.me = null;
      return json(204);
    }
    if (url === '/consents' && method === 'POST') {
      state.consentLog.push(body);
      return json(200, consents());
    }
    if (url === '/auth/otp/request') return json(200, { maskedDestination: '+57 300 •••• 567', expiresInSeconds: 300, resendInSeconds: 60 });
    if (url === '/auth/otp/verify') {
      if (body.code !== state.otpCode) return fail(422, 'OTP_INVALID', 'Código incorrecto. Te quedan 4 intentos.');
      if (!consents().find((c) => c.purpose === 'TERMINOS_Y_PRIVACIDAD')?.granted) return fail(409, 'CONSENT_REQUIRED', 'Acepta los términos.');
      state.me = { ...state.me, status: 'ACTIVA', credentials: [{ provider: 'otp:whatsapp', hint: '+57 300 •••• 567' }], consents: consents() };
      return json(200, state.me);
    }
    if (url === '/auth/logout') {
      state.me = null;
      return json(204);
    }
    return fail(404, 'NOT_FOUND', 'No encontramos lo que buscas.');
  });
  vi.stubGlobal('fetch', fetchMock);
  return state;
}
