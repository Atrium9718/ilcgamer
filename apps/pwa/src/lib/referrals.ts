import type { ReferralMe } from '@ilc/contracts';
import { apiRequest } from './api.ts';

/** Referidos (Guía Gamificación §16.2): el código y las reglas vienen del servidor; la PWA no inventa bonificaciones. */
export const referralsApi = {
  me: () => apiRequest<ReferralMe>('/referrals/me'),
  attribute: (code: string) => apiRequest<{ attributed: boolean }>('/referrals/attribute', { method: 'POST', body: { code } }),
};
