import { applyCampaignTheme, Button, CodeLandingView, Sheet, StatusMessage } from '@ilc/ui';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { type CodeLookup, data } from '../lib/data.ts';

/** /v/:token (código de producto) y /c/:code (código de campaña) — Instrucciones §4; Guía Técnica §5.1, §5.6. */
export function CodeLandingRoute() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [lookup, setLookup] = useState<CodeLookup | 'loading' | 'error'>('loading');
  const [explain, setExplain] = useState(false);

  useEffect(() => {
    let alive = true;
    setLookup('loading');
    data
      .lookupCode(token)
      .then((r) => {
        if (!alive) return;
        setLookup(r);
        applyCampaignTheme({ brand: r.themeId });
      })
      .catch(() => alive && setLookup('error'));
    return () => {
      alive = false;
    };
  }, [token]);

  if (lookup === 'loading')
    return (
      <StatusMessage
        kind="pending"
        title="Consultando el código…"
        body="Un momento, estamos verificando su estado."
        className="min-h-dvh justify-center bg-surface"
      />
    );
  if (lookup === 'error')
    return (
      <StatusMessage
        kind="error"
        title="No pudimos consultar el código"
        className="min-h-dvh justify-center bg-surface"
        action={<Button onClick={() => navigate(0)}>Reintentar</Button>}
      />
    );

  return (
    <>
      <CodeLandingView
        brandLabel={lookup.brandLabel}
        status={lookup.status}
        productLabel={lookup.productLabel}
        routeABadge={lookup.routeABadge}
        canActivate={lookup.canActivate}
        onBack={() => navigate('/')}
        onExplainCode={() => setExplain(true)}
        onSelectRouteA={() => navigate('/parche/nuevo', { state: { token } })}
        onSelectRouteB={() => navigate('/jugar')}
        onActivate={() => navigate('/parche/nuevo', { state: { token } })}
        onJoinWithPin={() => navigate('/parche/unirse')}
        footerLinks={[
          { label: 'Consumo responsable', href: '/legal/consumo-responsable' },
          { label: 'Términos y condiciones', href: '/legal/terminos' },
        ]}
      />
      <Sheet
        open={explain}
        onClose={() => setExplain(false)}
        title="¿Qué verifica este código?"
        actions={<Button onClick={() => setExplain(false)}>Entendido</Button>}
      >
        Confirma que el código existe en el sistema de ILC y su estado (por ejemplo, si ya registra una reclamación). Por sí solo no prueba que el envase físico
        sea auténtico. Consultarlo no usa ningún beneficio.
      </Sheet>
    </>
  );
}
