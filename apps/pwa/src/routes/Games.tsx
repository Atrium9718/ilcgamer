import { GameResultView, GamesCatalogView, type ResultState } from '@ilc/ui';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { DEMO } from '../demo/fixtures.ts';
import { useTabNavigate } from './shell.tsx';

export function GamesRoute() {
  const navigate = useNavigate();
  const onNavigate = useTabNavigate();
  return (
    <GamesCatalogView
      campaignLabel={DEMO.campaignLabel}
      currencyName={DEMO.currencyName}
      quickGames={[...DEMO.quickGames]}
      experiences={[...DEMO.experiences]}
      onSelectGame={(id) => navigate(`/jugar/${id}/resultado`)}
      onSelectExperience={() => navigate('/progreso')}
      onNavigate={onNavigate}
    />
  );
}

/** Resultado: primero "verificando" (el servidor confirma, Guía Técnica §5.4) y luego el resultado. */
export function GameResultRoute() {
  const navigate = useNavigate();
  const [state, setState] = useState<ResultState>({ status: 'verifying' });
  useEffect(() => {
    const t = setTimeout(
      () =>
        setState({
          status: 'verified',
          result: {
            headline: '¡El Parche resolvió el origen!',
            summary: '8 de 10 respuestas correctas',
            xpEarned: 120,
            badgeName: 'Guardianes del bosque de niebla',
            pointsEarned: 0,
            pointsNote: `Esta partida no otorga ${DEMO.currencyName} en esta campaña.`,
          },
        }),
      900,
    );
    return () => clearTimeout(t);
  }, []);
  return (
    <GameResultView
      gameTitle="Trivia del origen"
      state={state}
      currencyName={DEMO.currencyName}
      onClose={() => navigate('/jugar')}
      onBackToParche={() => navigate(`/parche/${DEMO.parche.id}`)}
      onShare={() => navigate('/compartir')}
      onPlayAgain={() => navigate(0)}
      onRetry={() => setState({ status: 'verifying' })}
    />
  );
}
