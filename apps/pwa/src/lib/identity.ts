import type { AgeGateRequest, ConsentChange, ConsentState, Me, OtpChannel, ProfileCapture, PublicConfig } from '@ilc/contracts';
import { apiRequest } from './api.ts';

/** Cliente de identidad (Paso 4). Siempre contra la API real: el control de edad no se simula. */
export const identityApi = {
  config: () => apiRequest<PublicConfig>('/config'),
  me: () => apiRequest<Me>('/me'),
  ageGate: (body: AgeGateRequest) => apiRequest<Me>('/age-gate', { method: 'POST', body }),
  updateAlias: (alias: string) => apiRequest<Me>('/me', { method: 'PATCH', body: { alias } }),
  captureProfile: (body: ProfileCapture) => apiRequest<Me>('/me/profile', { method: 'POST', body }),
  recordConsent: (change: ConsentChange) => apiRequest<ConsentState[]>('/consents', { method: 'POST', body: change }),
  requestOtp: (channel: OtpChannel, destination: string) =>
    apiRequest<{ maskedDestination: string; expiresInSeconds: number; resendInSeconds: number }>('/auth/otp/request', {
      method: 'POST',
      body: { channel, destination },
    }),
  verifyOtp: (channel: OtpChannel, destination: string, code: string) =>
    apiRequest<Me>('/auth/otp/verify', { method: 'POST', body: { channel, destination, code } }),
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST' }),
  deleteAccount: () => apiRequest<void>('/me', { method: 'DELETE' }),
};
