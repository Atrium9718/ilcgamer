import { Button, StatusMessage } from '@ilc/ui';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { ApiRequestError } from '../lib/api.ts';
import { fetchPublicCampaign, rememberCampaignTheme } from '../lib/campaign.ts';
import { data } from '../lib/data.ts';
import { KEYS, writeLocal } from '../lib/storage.ts';

/** /r/:ref — guarda el código de referido para atribuirlo al registrarse (Instrucciones §8). */
export function ReferralEntryRoute() {
  const { ref = '' } = useParams();
  if (/^[A-Z0-9-]{4,12}$/i.test(ref)) writeLocal(KEYS.referral, ref.toUpperCase());
  return <Navigate to="/" replace />;
}

/**
 * /e/:slug — QR de evento/experiencia: entra a la Ruta B, sin exigir compra (Guía Técnica §5.1).
 * Solo campañas publicadas y dentro de su ventana; aplica el tema de la campaña (Instrucciones §2).
 */
export function EventEntryRoute() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<'loading' | 'inactive' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    const enter = () => navigate(`/jugar?evento=${encodeURIComponent(slug)}`, { replace: true });
    fetchPublicCampaign(slug).then(
      (campaign) => {
        if (cancelled) return;
        rememberCampaignTheme(campaign.theme);
        enter();
      },
      (err) => {
        if (cancelled) return;
        // En modo demostración las entradas de ejemplo (/e/feria) funcionan sin campaña publicada.
        if (data.demo) enter();
        else setState(err instanceof ApiRequestError && (err.code === 'NOT_FOUND' || err.code === 'CAMPAIGN_NOT_ACTIVE') ? 'inactive' : 'error');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [slug, navigate]);

  if (state === 'loading')
    return <StatusMessage kind="pending" title="Abriendo la experiencia" body="Un momento." className="min-h-dvh justify-center bg-surface" />;
  return (
    <main className="min-h-dvh flex items-center justify-center bg-surface">
      <StatusMessage
        kind={state === 'inactive' ? 'empty' : 'error'}
        title={state === 'inactive' ? 'Esta experiencia no está disponible' : 'No pudimos abrir la experiencia'}
        body={
          state === 'inactive'
            ? 'Puede que aún no empiece o que ya haya terminado. Mientras tanto, explora otras experiencias.'
            : 'Revisa tu conexión e intenta de nuevo.'
        }
        action={<Button onClick={() => navigate('/jugar', { replace: true })}>Ver experiencias</Button>}
      />
    </main>
  );
}

/**
 * /s/:code — QR del Staff: recuerda quién atendió la mesa para vincular la próxima activación (Instrucciones §3.3).
 * No concede nada por sí solo; el servidor valida el código al activar y lo ignora si no sirve.
 */
export function StaffEntryRoute() {
  const { code = '' } = useParams();
  const normalized = code.toUpperCase();
  if (/^[0-9A-Z]{8}$/.test(normalized)) writeLocal(KEYS.staff, { code: normalized, at: Date.now() }, 'session');
  return <Navigate to="/jugar" replace />;
}
