import { applyCampaignTheme, Button, type NavTab, OfflineBanner, StatusMessage } from '@ilc/ui';
import { useEffect } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { data } from '../lib/data.ts';
import { useSession } from '../lib/session.tsx';
import { KEYS, writeLocal } from '../lib/storage.ts';
import { useOnline } from '../lib/useOnline.ts';

export const TAB_PATH: Record<NavTab, string> = { inicio: '/', jugar: '/jugar', billetera: '/billetera', perfil: '/perfil' };

export function useTabNavigate() {
  const navigate = useNavigate();
  return (tab: NavTab) => navigate(TAB_PATH[tab]);
}

/** Marco común: tema base, aviso sin conexión y aviso de datos de demostración. */
export function RootLayout() {
  const online = useOnline();
  useEffect(() => {
    applyCampaignTheme({ mode: 'dark', brand: 'ilc' });
  }, []);
  return (
    <>
      {!online && <OfflineBanner />}
      {data.demo && (
        <p role="note" className="bg-tertiary-container text-on-tertiary-container text-center font-label-sm text-[11px] uppercase py-1">
          Modo demostración · datos ilustrativos
        </p>
      )}
      <Outlet />
    </>
  );
}

/** Ninguna pantalla promocional se muestra sin control de edad registrado en el servidor (Guía Técnica §5.1, §12.2). */
export function RequireAge() {
  const location = useLocation();
  const { status, me, refresh } = useSession();
  if (status === 'loading') return <StatusMessage kind="pending" title="Cargando…" body="Un momento." className="min-h-dvh justify-center bg-surface" />;
  if (status === 'error')
    return (
      <StatusMessage
        kind="error"
        title="No pudimos conectar"
        body="Revisa tu conexión e intenta de nuevo."
        className="min-h-dvh justify-center bg-surface"
        action={<Button onClick={() => void refresh()}>Reintentar</Button>}
      />
    );
  if (!me?.ageVerified) {
    writeLocal(KEYS.returnTo, `${location.pathname}${location.search}`, 'session');
    return <Navigate to="/edad" replace />;
  }
  return <Outlet />;
}

export function NotFound() {
  const navigate = useNavigate();
  return (
    <main className="min-h-dvh flex items-center justify-center bg-surface">
      <StatusMessage
        kind="empty"
        title="No encontramos esta página"
        body="Puede que el enlace haya cambiado o expirado."
        action={<Button onClick={() => navigate('/')}>Ir al inicio</Button>}
      />
    </main>
  );
}
