import type { ClaimResult, ProductCodeLookup } from '@ilc/contracts';
import { applyCampaignTheme, Button, CodeLandingView, Sheet, StatusMessage } from '@ilc/ui';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ApiRequestError, newIdempotencyKey } from '../lib/api.ts';
import { data } from '../lib/data.ts';
import { useSession } from '../lib/session.tsx';
import { KEYS, readLocal, readStaffCode, removeLocal, writeLocal } from '../lib/storage.ts';

const fmt = (n: number) => n.toLocaleString('es-CO');
const dateFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' });

/** Mensaje cuando la promoción de la botella no se puede activar (el código de producto sigue siendo consultable). */
function claimNotice(c: ProductCodeLookup['campaign']): string | undefined {
  if (!c) return undefined;
  if (c.availability === 'claimed_by_you') return `Ya activaste este código en «${c.title}».`;
  if (c.availability === 'expired') return `La promoción «${c.title}» de este código ya terminó.`;
  if (c.availability === 'not_available') return `La promoción «${c.title}» no está disponible en este momento.`;
  return undefined;
}

/** Clave de idempotencia por código: se conserva hasta confirmar para que un reintento no duplique la emisión. */
const claimKeyFor = (token: string) => `${KEYS.claimKey}.${token}`;

/**
 * /v/:token — código de producto de la botella (Instrucciones §4; Guía Técnica §5.1, §5.6, §5.7).
 * Consultar no consume nada. Activar muestra las condiciones antes de confirmar y reclama de forma idempotente.
 */
export function CodeLandingRoute() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { me } = useSession();
  const [lookup, setLookup] = useState<ProductCodeLookup | 'loading' | 'error'>('loading');
  const [explain, setExplain] = useState(false);
  const [conditions, setConditions] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [claimError, setClaimError] = useState<string>();

  const load = useCallback(async () => {
    setLookup('loading');
    try {
      const r = await data.lookupCode(token);
      setLookup(r);
      applyCampaignTheme({ brand: r.themeId });
    } catch {
      setLookup('error');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

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
        action={<Button onClick={() => void load()}>Reintentar</Button>}
      />
    );

  const campaign = lookup.campaign;
  const canActivate = campaign?.availability === 'available';
  const here = `/v/${token}`;

  const startActivation = () => {
    setClaimError(undefined);
    if (me?.status !== 'ACTIVA') {
      // Los puntos se guardan en una cuenta: primero el acceso por código, luego se vuelve aquí (§5.2).
      writeLocal(KEYS.afterSignup, here, 'session');
      navigate('/registro');
      return;
    }
    setConditions(true);
  };

  const confirm = async (attempt = 0): Promise<void> => {
    const stored = readLocal<string | null>(claimKeyFor(token), null, 'session');
    const key = stored ?? newIdempotencyKey();
    if (!stored) writeLocal(claimKeyFor(token), key, 'session');
    setClaiming(true);
    setClaimError(undefined);
    try {
      const activeParche = readLocal<string | null>(KEYS.activeParche, null, 'session') ?? undefined;
      const r = await data.claimCode(token, key, activeParche, readStaffCode());
      removeLocal(claimKeyFor(token), 'session');
      setConditions(false);
      setResult(r);
      void load();
    } catch (err) {
      if (err instanceof ApiRequestError && (err.code === 'TIMEOUT' || err.code === 'NETWORK_ERROR') && attempt === 0) {
        // Resultado incierto: se reintenta UNA vez con la misma clave; el servidor no duplica (§5.7 regla 8).
        return confirm(1);
      }
      if (err instanceof ApiRequestError && err.code === 'AGE_GATE_REQUIRED' && campaign) {
        writeLocal(KEYS.returnTo, here, 'session');
        writeLocal(KEYS.pendingCampaign, campaign.slug, 'session');
        navigate('/edad');
        return;
      }
      if (err instanceof ApiRequestError && err.code === 'ACCOUNT_REQUIRED') {
        writeLocal(KEYS.afterSignup, here, 'session');
        navigate('/registro');
        return;
      }
      if (err instanceof ApiRequestError && !err.retryable) removeLocal(claimKeyFor(token), 'session');
      setClaimError(err instanceof Error ? err.message : 'No pudimos activar el código.');
      if (err instanceof ApiRequestError && ['CODE_ALREADY_CLAIMED', 'CODE_NOT_AVAILABLE', 'CAMPAIGN_NOT_ACTIVE'].includes(err.code)) void load();
    } finally {
      setClaiming(false);
    }
  };

  return (
    <>
      <CodeLandingView
        brandLabel={lookup.brandLabel}
        status={lookup.status}
        productLabel={lookup.productLabel}
        routeABadge={canActivate && campaign && campaign.points > 0 ? `+${fmt(campaign.points)} ${campaign.currencyName}` : undefined}
        canActivate={canActivate}
        claimNotice={claimNotice(campaign)}
        activating={claiming}
        onBack={() => navigate('/')}
        onExplainCode={() => setExplain(true)}
        onSelectRouteA={startActivation}
        onSelectRouteB={() => navigate('/jugar')}
        onActivate={startActivation}
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
      {campaign && (
        <Sheet
          open={conditions}
          onClose={() => !claiming && setConditions(false)}
          title="Condiciones de la promoción"
          actions={
            <>
              <Button leadingIcon="lock_open" loading={claiming} onClick={() => void confirm()}>
                Activar código
              </Button>
              <Button variant="text" disabled={claiming} onClick={() => setConditions(false)}>
                Ahora no
              </Button>
            </>
          }
        >
          <ul className="space-y-2 list-disc pl-5">
            <li>
              Promoción: «{campaign.title}», vigente hasta el {dateFmt.format(new Date(campaign.endsAt))}.
            </li>
            {campaign.points > 0 && (
              <li>
                Sumas {fmt(campaign.points)} {campaign.currencyName}
                {campaign.pointsExpiryDays ? `, que vencen ${campaign.pointsExpiryDays} días después de activarlos` : ''}.
              </li>
            )}
            <li>Cada código se activa una sola vez. Máximo {campaign.activationsPerUserPerDay} códigos de esta promoción por persona al día.</li>
            <li>Solo para mayores de {campaign.minAge} años. Consulta los términos y condiciones de la promoción.</li>
          </ul>
          {claimError && (
            <p role="alert" className="mt-3 p-3 rounded-xl border border-error/50 bg-error-container text-on-error-container font-body-md text-[14px]">
              {claimError}
            </p>
          )}
        </Sheet>
      )}
      <Sheet
        open={result !== null}
        onClose={() => setResult(null)}
        title="¡Código activado!"
        actions={
          <>
            {readLocal<string | null>(KEYS.activeParche, null, 'session') ? (
              <Button leadingIcon="groups" onClick={() => navigate(`/parche/${readLocal<string>(KEYS.activeParche, '', 'session')}`)}>
                Volver a mi Parche
              </Button>
            ) : (
              <Button leadingIcon="groups" onClick={() => navigate('/parche/nuevo', { state: { claimId: result?.claimId, brandLabel: lookup.brandLabel } })}>
                Crear mi Parche y jugar
              </Button>
            )}
            <Button variant="text" onClick={() => navigate('/billetera')}>
              Ver mi billetera
            </Button>
          </>
        }
      >
        {result && (
          <p>
            {result.points > 0
              ? `Sumaste ${fmt(result.points)} ${result.currencyName} en «${result.campaign.title}». Tu saldo es ${fmt(result.balance)} ${result.currencyName}.${result.parcheRecharged ? ' Además, recargaste la energía de tu Parche.' : ''}`
              : `Activaste tu código en «${result.campaign.title}».`}
          </p>
        )}
      </Sheet>
      {claimError && !conditions && (
        <p
          role="alert"
          className="fixed bottom-28 inset-x-4 max-w-md mx-auto p-3 rounded-xl border border-error/50 bg-error-container text-on-error-container font-body-md text-[14px]"
        >
          {claimError}
        </p>
      )}
    </>
  );
}
