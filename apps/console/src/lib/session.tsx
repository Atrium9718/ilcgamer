import type { Me } from '@ilc/contracts';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { adminApi } from './adminApi.ts';
import { ApiRequestError } from './api.ts';

export interface ConsoleSession {
  status: 'loading' | 'anonymous' | 'ready' | 'error';
  me: Me | null;
  setMe: (me: Me | null) => void;
  logout: () => Promise<void>;
}

const Ctx = createContext<ConsoleSession | null>(null);

/** La sesión vive en la cookie HttpOnly de la API; aquí solo se refleja quién es y qué roles tiene. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConsoleSession['status']>('loading');
  const [me, setMeState] = useState<Me | null>(null);

  const setMe = useCallback((value: Me | null) => {
    setMeState(value);
    setStatus(value ? 'ready' : 'anonymous');
  }, []);

  useEffect(() => {
    adminApi.me().then(setMe, (err) => {
      if (err instanceof ApiRequestError && err.code === 'UNAUTHENTICATED') setMe(null);
      else setStatus('error');
    });
  }, [setMe]);

  const logout = useCallback(async () => {
    await adminApi.logout().catch(() => undefined);
    setMe(null);
  }, [setMe]);

  const value = useMemo(() => ({ status, me, setMe, logout }), [status, me, setMe, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): ConsoleSession {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession fuera de SessionProvider');
  return ctx;
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Ocurrió un error inesperado.');
