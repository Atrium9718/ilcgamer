import type { ApprovalDecisionInput, CampaignDraft, CampaignSummary, CampaignView, CreateCampaign, Me } from '@ilc/contracts';
import { apiRequest } from './api.ts';

const base = '/admin/campaigns';
const enc = encodeURIComponent;

/** Cliente de la consola. Todas las reglas (roles, aprobaciones, checklist) las vuelve a validar la API. */
export const adminApi = {
  me: () => apiRequest<Me>('/me'),
  requestOtp: (email: string) =>
    apiRequest<{ maskedDestination: string; expiresInSeconds: number; resendInSeconds: number }>('/auth/otp/request', {
      method: 'POST',
      body: { channel: 'email', destination: email },
    }),
  verifyOtp: (email: string, code: string) => apiRequest<Me>('/auth/otp/verify', { method: 'POST', body: { channel: 'email', destination: email, code } }),
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST' }),

  list: () => apiRequest<CampaignSummary[]>(base),
  get: (slug: string) => apiRequest<CampaignView>(`${base}/${enc(slug)}`),
  create: (body: CreateCampaign) => apiRequest<CampaignView>(base, { method: 'POST', body }),
  updateDraft: (slug: string, draft: CampaignDraft) => apiRequest<CampaignView>(`${base}/${enc(slug)}/draft`, { method: 'PUT', body: draft }),
  newVersion: (slug: string) => apiRequest<CampaignView>(`${base}/${enc(slug)}/versions`, { method: 'POST' }),
  submit: (slug: string) => apiRequest<CampaignView>(`${base}/${enc(slug)}/submit`, { method: 'POST' }),
  decide: (slug: string, body: ApprovalDecisionInput) => apiRequest<CampaignView>(`${base}/${enc(slug)}/approvals`, { method: 'POST', body }),
  publish: (slug: string, checklist: Record<string, true>) => apiRequest<CampaignView>(`${base}/${enc(slug)}/publish`, { method: 'POST', body: { checklist } }),
  transition: (slug: string, action: 'pause' | 'resume' | 'close' | 'archive') =>
    apiRequest<CampaignView>(`${base}/${enc(slug)}/${action}`, { method: 'POST' }),
};
