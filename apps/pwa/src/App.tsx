import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { ProfileRoute, ProgressRoute, RewardsRoute, ShareRoute, SignUpRoute, WalletRoute } from './routes/Account.tsx';
import { AgeGateRoute, UnderageRoute } from './routes/AgeGate.tsx';
import { CodeLandingRoute } from './routes/CodeLanding.tsx';
import { EventEntryRoute, ReferralEntryRoute } from './routes/Entry.tsx';
import { GameResultRoute, GamesRoute } from './routes/Games.tsx';
import { CreateParcheRoute, JoinParcheRoute, ParcheRoomRoute } from './routes/Parche.tsx';
import { NotFound, RequireAge, RootLayout } from './routes/shell.tsx';

/**
 * Mapa de rutas. Entradas por QR diferenciadas (Guía Técnica §5.1): /v producto, /c campaña,
 * /p sesión (PIN en enlace), /e evento/experiencia, /r referido. Todo lo promocional exige control de edad.
 */
export const routes = [
  {
    element: <RootLayout />,
    children: [
      { path: '/edad', element: <AgeGateRoute /> },
      { path: '/menor-de-edad', element: <UnderageRoute /> },
      { path: '/r/:ref', element: <ReferralEntryRoute /> },
      {
        element: <RequireAge />,
        children: [
          { path: '/', element: <Navigate to="/jugar" replace /> },
          { path: '/v/:token', element: <CodeLandingRoute /> },
          { path: '/c/:token', element: <CodeLandingRoute /> },
          { path: '/e/:slug', element: <EventEntryRoute /> },
          { path: '/p/:pin', element: <JoinParcheRoute /> },
          { path: '/parche/nuevo', element: <CreateParcheRoute /> },
          { path: '/parche/unirse', element: <JoinParcheRoute /> },
          { path: '/parche/:id', element: <ParcheRoomRoute /> },
          { path: '/jugar', element: <GamesRoute /> },
          { path: '/jugar/:gameId/resultado', element: <GameResultRoute /> },
          { path: '/billetera', element: <WalletRoute /> },
          { path: '/recompensas', element: <RewardsRoute /> },
          { path: '/progreso', element: <ProgressRoute /> },
          { path: '/perfil', element: <ProfileRoute /> },
          { path: '/compartir', element: <ShareRoute /> },
          { path: '/registro', element: <SignUpRoute /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
];

const router = createBrowserRouter(routes);

export function App() {
  return <RouterProvider router={router} />;
}
