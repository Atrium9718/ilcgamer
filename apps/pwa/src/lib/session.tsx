import type { Me, PublicConfig } from '@ilc/contracts';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiRequestError } from './api.ts';
import { identityApi } from './identity.ts';

const FALLBACK_CONFIG: PublicConfig = { currencyName: 'Puntos ILC', legalNoticeVersion: '1.0', minAge: 18, otpChannels: [], oauthProviders: [] };

export interface SessionState {
  status: 'loading' | 'anonymous' | 'ready' | 'error';
  me: Me | null;
  config: PublicConfig;
  setMe: (me: Me | null) => void;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

/** Sesión del navegador: la fuente de verdad es la API (cookie HttpOnly); aquí solo se refleja. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionState['status']>('loading');
  const [me, setMeState] = useState<Me | null>(null);
  const [config, setConfig] = useState<PublicConfig>(FALLBACK_CONFIG);

  const setMe = useCallback((value: Me | null) => {
    setMeState(value);
    setStatus(value ? 'ready' : 'anonymous');
  }, []);

  const refresh = useCallback(async () => {
    try {
      setMe(await identityApi.me());
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'UNAUTHENTICATED') setMe(null);
      else setStatus('error');
    }
  }, [setMe]);

  useEffect(() => {
    void refresh();
    identityApi.config().then(setConfig, () => undefined);
  }, [refresh]);

  const value = useMemo(() => ({ status, me, config, setMe, refresh }), [status, me, config, setMe, refresh]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession fuera de SessionProvider');
  return ctx;
}
