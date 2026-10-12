import { Button, ConsoleLayout, type ConsoleSection, StatusMessage } from '@ilc/ui';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router';
import { roleLabel } from './lib/mapping.ts';
import { SessionProvider, useSession } from './lib/session.tsx';
import { CampaignDetail } from './routes/CampaignDetail.tsx';
import { CampaignEditor } from './routes/CampaignEditor.tsx';
import { CampaignList } from './routes/CampaignList.tsx';
import { Economy } from './routes/Economy.tsx';
import { Games } from './routes/Games.tsx';
import { Login } from './routes/Login.tsx';
import { Rewards } from './routes/Rewards.tsx';
import { SmartTags } from './routes/SmartTags.tsx';

const CONSOLE_ROLES = ['SUPERADMIN', 'ADMIN_MARCA', 'EDITOR_CONTENIDO', 'REVISOR_MARCA', 'REVISOR_JURIDICO', 'RESPONSABLE_PRIVACIDAD'];

/** Smart Tags y Economía: Admin de Marca y SuperAdmin/TI (la API aplica el detalle de cada permiso). */
const SMARTTAG_ROLES = ['SUPERADMIN', 'ADMIN_MARCA'];
const SECTION_PATHS: Partial<Record<ConsoleSection, string>> = {
  campanas: '/campanas',
  juegos: '/juegos',
  recompensas: '/recompensas',
  'smart-tags': '/smart-tags',
  economia: '/economia',
};

function breadcrumbsFor(pathname: string, go: (to: string) => void) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'smart-tags') return [{ label: 'Smart Tags' }];
  if (parts[0] === 'economia') return [{ label: 'Economía' }];
  if (parts[0] === 'juegos') return [{ label: 'Juegos' }];
  if (parts[0] === 'recompensas') return [{ label: 'Recompensas' }];
  const crumbs: Array<{ label: string; onSelect?: () => void }> = [{ label: 'Campañas', onSelect: parts.length > 1 ? () => go('/campanas') : undefined }];
  if (parts[1] === 'nueva') crumbs.push({ label: 'Nueva campaña' });
  else if (parts[1]) {
    crumbs.push({ label: decodeURIComponent(parts[1]), onSelect: parts[2] ? () => go(`/campanas/${parts[1]}`) : undefined });
    if (parts[2] === 'editar') crumbs.push({ label: 'Editar borrador' });
  }
  return crumbs;
}

/** Protege la consola: sin sesión → ingreso; con sesión sin rol de consola → sin acceso. */
function Shell() {
  const { status, me, logout } = useSession();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (status === 'loading') return <StatusMessage kind="pending" title="Abriendo la consola" body="Un momento…" />;
  if (status === 'error') return <StatusMessage kind="offline" title="No pudimos conectar con el servidor" body="Revisa tu conexión e intenta de nuevo." />;
  if (!me) return <Login />;
  if (!me.roles.some((r) => CONSOLE_ROLES.includes(r)))
    return (
      <main className="min-h-dvh flex items-center justify-center bg-surface">
        <StatusMessage
          kind="error"
          title="Tu cuenta no tiene acceso a la consola"
          body="Solicita a TI el rol que corresponde a tu función."
          action={
            <Button variant="secondary" onClick={() => void logout()}>
              Salir
            </Button>
          }
        />
      </main>
    );

  const smartTags = me.roles.some((r) => SMARTTAG_ROLES.includes(r));
  const sections: ConsoleSection[] = smartTags ? ['campanas', 'juegos', 'recompensas', 'smart-tags', 'economia'] : ['campanas', 'juegos'];
  const active = (Object.entries(SECTION_PATHS).find(([, path]) => pathname.startsWith(path ?? '-'))?.[0] ?? 'campanas') as ConsoleSection;
  return (
    <ConsoleLayout
      active={active}
      sections={sections}
      restricted={smartTags ? [] : ['recompensas', 'smart-tags', 'economia']}
      userAlias={me.alias}
      roleLabel={roleLabel(me.roles)}
      onNavigate={(section) => navigate(SECTION_PATHS[section] ?? '/campanas')}
      onLogout={() => void logout()}
      breadcrumbs={breadcrumbsFor(pathname, navigate)}
    >
      <Outlet />
    </ConsoleLayout>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/campanas" replace />} />
        <Route path="campanas" element={<CampaignList />} />
        <Route path="campanas/nueva" element={<CampaignEditor />} />
        <Route path="campanas/:slug" element={<CampaignDetail />} />
        <Route path="campanas/:slug/editar" element={<CampaignEditor />} />
        <Route path="juegos" element={<Games />} />
        <Route path="recompensas" element={<Rewards />} />
        <Route path="smart-tags" element={<SmartTags />} />
        <Route path="economia" element={<Economy />} />
        <Route path="*" element={<Navigate to="/campanas" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </SessionProvider>
  );
}
