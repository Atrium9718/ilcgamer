import { Navigate, useParams } from 'react-router';
import { KEYS, writeLocal } from '../lib/storage.ts';

/** /r/:ref — guarda el código de referido para atribuirlo al registrarse (Instrucciones §8). */
export function ReferralEntryRoute() {
  const { ref = '' } = useParams();
  if (/^[A-Z0-9-]{4,12}$/i.test(ref)) writeLocal(KEYS.referral, ref.toUpperCase());
  return <Navigate to="/" replace />;
}

/** /e/:slug — QR de evento/experiencia: entra a la Ruta B, sin exigir compra (Guía Técnica §5.1). */
export function EventEntryRoute() {
  const { slug = '' } = useParams();
  writeLocal(KEYS.returnTo, '/jugar', 'session');
  return <Navigate to={`/jugar?evento=${encodeURIComponent(slug)}`} replace />;
}
