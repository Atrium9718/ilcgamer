import { API_PREFIX, type CreateParche, type ParcheState, ParcheStateSchema } from '@ilc/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEMO } from '../demo/fixtures.ts';
import { ApiRequestError, apiRequest } from './api.ts';
import { data } from './data.ts';

/** Cliente del Parche (Guía Técnica §5.5, §7). El servidor es autoritativo: aquí solo se refleja su estado. */
const realApi = {
  create: (body: CreateParche) => apiRequest<ParcheState>('/sessions', { method: 'POST', body }),
  joinByPin: (pin: string, alias: string) => apiRequest<ParcheState>('/sessions/join', { method: 'POST', body: { pin, alias } }),
  joinByInvite: (id: string, invite: string, alias: string) =>
    apiRequest<ParcheState>(`/sessions/${encodeURIComponent(id)}/join`, { method: 'POST', body: { invite, alias } }),
  state: (id: string) => apiRequest<ParcheState>(`/sessions/${encodeURIComponent(id)}`),
  leave: (id: string) => apiRequest<void>(`/sessions/${encodeURIComponent(id)}/leave`, { method: 'POST' }),
  close: (id: string) => apiRequest<ParcheState>(`/sessions/${encodeURIComponent(id)}/close`, { method: 'POST' }),
};

/** Parche de demostración en memoria (VITE_DEMO_DATA=true): permite recorrer la experiencia sin servidor. */
function demoState(over: Partial<ParcheState> = {}): ParcheState {
  const now = Date.now();
  return {
    id: '00000000-0000-7000-8000-00000000da5e',
    name: DEMO.parche.name,
    route: 'MIXTA',
    mode: 'MULTI_DISPOSITIVO',
    status: 'ABIERTA',
    isHost: true,
    pin: DEMO.parche.pin,
    invitePath: '/parche/00000000-0000-7000-8000-00000000da5e/unirse?i=demo-invitacion-0000',
    capacity: 12,
    participants: DEMO.participants.map((p, i) => ({ id: p.id, alias: p.alias, isHost: !!p.isHost, isYou: i === 0, status: p.status })),
    localPlayers: [],
    energy: { minutes: DEMO.energyMinutes, endsAt: new Date(now + 32 * 60_000).toISOString() },
    expiresAt: new Date(now + 6 * 3_600_000).toISOString(),
    score: 1250,
    activations: 1,
    campaign: { slug: 'feria', title: DEMO.campaignLabel, themeId: 'ron-viejo-de-caldas' },
    stateVersion: 1,
    serverTime: new Date(now).toISOString(),
    ...over,
  };
}

/** Último Parche creado en la demostración (solo en memoria de la pestaña). */
let demoCurrent: ParcheState | null = null;

const demoApi: typeof realApi = {
  create: async (body) => {
    demoCurrent = demoState({ name: body.name, mode: body.mode ?? 'MULTI_DISPOSITIVO', localPlayers: body.localPlayers ?? [] });
    return demoCurrent;
  },
  joinByPin: async (pin) => {
    if (pin !== DEMO.parche.pin) throw new ApiRequestError('SESSION_PIN_INVALID', 'PIN incorrecto o vencido. Te quedan 4 intentos.', false);
    return demoState({ isHost: false });
  },
  joinByInvite: async () => demoState({ isHost: false }),
  state: async () => demoCurrent ?? demoState(),
  leave: async () => {
    demoCurrent = null;
  },
  close: async () => demoState({ status: 'FINALIZADA' }),
};

export const parcheApi = data.demo ? demoApi : realApi;

export type Connection = 'live' | 'reconnecting' | 'offline';

/**
 * Estado en vivo del Parche: canal SSE con reconexión automática del navegador. Cada evento trae el estado completo
 * con versión creciente; se ignoran los más viejos. Si el canal falla repetidamente, cae a consulta cada 5 s
 * (modo degradado — Guía Técnica §8). `clockOffset` corrige la hora del celular con la del servidor.
 */
export function useParcheLive(sessionId: string) {
  const [state, setState] = useState<ParcheState | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [connection, setConnection] = useState<Connection>('reconnecting');
  const [clockOffset, setClockOffset] = useState(0);
  const version = useRef(-1);

  const accept = useCallback((s: ParcheState) => {
    if (s.stateVersion < version.current && !['FINALIZADA', 'EXPIRADA', 'CANCELADA'].includes(s.status)) return;
    version.current = s.stateVersion;
    setClockOffset(new Date(s.serverTime).getTime() - Date.now());
    setState(s);
  }, []);

  const refresh = useCallback(() => parcheApi.state(sessionId).then(accept, setError), [sessionId, accept]);

  useEffect(() => {
    version.current = -1;
    void refresh();
    if (data.demo || typeof EventSource === 'undefined') {
      setConnection('live');
      return;
    }
    let failures = 0;
    let poll: ReturnType<typeof setInterval> | undefined;
    const base = import.meta.env.VITE_API_URL ?? API_PREFIX;
    const source = new EventSource(`${base}/sessions/${encodeURIComponent(sessionId)}/events`, { withCredentials: true });
    source.addEventListener('state', (e) => {
      failures = 0;
      setConnection('live');
      if (poll) {
        clearInterval(poll);
        poll = undefined;
      }
      const parsed = ParcheStateSchema.safeParse(JSON.parse((e as MessageEvent<string>).data));
      if (parsed.success) accept(parsed.data);
    });
    source.onerror = () => {
      failures++;
      setConnection(navigator.onLine ? 'reconnecting' : 'offline');
      if (failures >= 3 && !poll) poll = setInterval(() => void refresh(), 5000);
    };
    return () => {
      source.close();
      if (poll) clearInterval(poll);
    };
  }, [sessionId, refresh, accept]);

  return { state, error, connection, clockOffset, refresh, setState: accept };
}
