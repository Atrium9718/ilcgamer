import type {
  AdjustStock,
  AdminAccount,
  AdminRewardClaim,
  AnalyticsDashboard,
  ApprovalDecisionInput,
  BadgeAdmin,
  BadgeAdminView,
  BatchView,
  CampaignDraft,
  CampaignSummary,
  CampaignView,
  ContestAdminView,
  CreateCampaign,
  CreateContest,
  CreateEvent,
  CreateProduct,
  CreateReward,
  CreateVenue,
  DealerDashboard,
  DefaultModules,
  EventAdminView,
  GenerateCodes,
  ImportPreview,
  Me,
  ModuleView,
  OptInContacts,
  ProductView,
  Reconciliation,
  ReferralSettings,
  ReferralSummary,
  Registrations,
  RewardAdminView,
  StaffDashboard,
  UrlTemplate,
  VenueAdminView,
  VenueProfile,
} from '@ilc/contracts';
import { apiRequest, type DownloadedFile } from './api.ts';

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

const st = '/admin/smarttags';

/** Smart Tags (Paso 6). Los tokens en claro solo llegan en la descarga de una generación. */
export const smartTagsApi = {
  products: () => apiRequest<ProductView[]>(`${st}/products`),
  createProduct: (body: CreateProduct) => apiRequest<ProductView>(`${st}/products`, { method: 'POST', body }),
  batches: () => apiRequest<BatchView[]>(`${st}/batches`),
  link: (id: string, campaignSlug: string) =>
    apiRequest<{ created: number; skipped: number }>(`${st}/batches/${id}/link`, { method: 'POST', body: { campaignSlug } }),
  distribute: (id: string) => apiRequest<{ updated: number }>(`${st}/batches/${id}/distribute`, { method: 'POST' }),
  revoke: (id: string, reason: string) =>
    apiRequest<{ codes: number; campaignCodes: number }>(`${st}/batches/${id}/revoke`, { method: 'POST', body: { reason } }),
  exportBatch: (id: string) => apiRequest<DownloadedFile>(`${st}/batches/${id}/export`, { download: true }),
  generate: (body: GenerateCodes) => apiRequest<DownloadedFile>(`${st}/generate`, { method: 'POST', body, download: true, timeoutMs: 120_000 }),
  upload: (file: File) => apiRequest<ImportPreview>(`${st}/imports?fileName=${enc(file.name)}`, { method: 'POST', file, timeoutMs: 120_000 }),
  confirmImport: (id: string) => apiRequest<ImportPreview>(`${st}/imports/${id}/confirm`, { method: 'POST', timeoutMs: 120_000 }),
  discardImport: (id: string) => apiRequest<ImportPreview>(`${st}/imports/${id}/discard`, { method: 'POST' }),
  importIssues: (id: string) => apiRequest<DownloadedFile>(`${st}/imports/${id}/issues`, { download: true }),
  settings: () => apiRequest<UrlTemplate>(`${st}/settings`),
  saveSettings: (body: UrlTemplate) => apiRequest<UrlTemplate>(`${st}/settings`, { method: 'PUT', body }),
};

const eco = '/admin/economy';

/** Economía (Paso 7): cuentas, reversos auditados, insignias y conciliación. */
export const economyApi = {
  account: (q: { claimId: string } | { userId: string }) =>
    apiRequest<AdminAccount>(`${eco}/accounts?${'claimId' in q ? `claimId=${enc(q.claimId)}` : `userId=${enc(q.userId)}`}`),
  reverse: (entryId: string, reason: string) => apiRequest<AdminAccount>(`${eco}/entries/${enc(entryId)}/reverse`, { method: 'POST', body: { reason } }),
  badges: () => apiRequest<BadgeAdminView[]>(`${eco}/badges`),
  createBadge: (body: BadgeAdmin) => apiRequest<BadgeAdminView>(`${eco}/badges`, { method: 'POST', body }),
  reconcile: () => apiRequest<Reconciliation>(`${eco}/reconciliation`),
};

const gm = '/admin/games';

/** Juegos (Paso 9): catálogo de módulos y su ciclo de vida. Los permisos los vuelve a validar la API. */
export const gamesAdminApi = {
  modules: () => apiRequest<ModuleView[]>(`${gm}/modules`),
  register: (manifest: unknown) => apiRequest<ModuleView>(`${gm}/modules`, { method: 'POST', body: { manifest } }),
  test: (slug: string, version: string) => apiRequest<ModuleView>(`${gm}/modules/${enc(slug)}/versions/${enc(version)}/test`, { method: 'POST' }),
  decide: (slug: string, version: string, body: { kind: string; decision: 'APROBADO' | 'RECHAZADO'; note?: string }) =>
    apiRequest<ModuleView>(`${gm}/modules/${enc(slug)}/versions/${enc(version)}/approvals`, { method: 'POST', body }),
  activate: (slug: string, version: string) => apiRequest<ModuleView>(`${gm}/modules/${enc(slug)}/versions/${enc(version)}/activate`, { method: 'POST' }),
  deactivate: (slug: string, reason: string) => apiRequest<ModuleView>(`${gm}/modules/${enc(slug)}/deactivate`, { method: 'POST', body: { reason } }),
  defaults: () => apiRequest<DefaultModules>(`${gm}/defaults`),
  saveDefaults: (modules: string[]) => apiRequest<DefaultModules>(`${gm}/defaults`, { method: 'PUT', body: { modules } }),
  secret: (slug: string) => apiRequest<{ secret: string; epoch: number }>(`${gm}/modules/${enc(slug)}/provider-secret`, { method: 'POST' }),
  rotateSecret: (slug: string) => apiRequest<{ secret: string; epoch: number }>(`${gm}/modules/${enc(slug)}/provider-secret/rotate`, { method: 'POST' }),
  guide: () => apiRequest<{ markdown: string }>(`${gm}/guide`),
};

const rw = '/admin/rewards';

/** Recompensas (Paso 10): catálogo, inventario por zona y canjes. La API valida roles y separación de funciones. */
export const rewardsAdminApi = {
  list: () => apiRequest<RewardAdminView[]>(rw),
  create: (body: CreateReward) => apiRequest<RewardAdminView>(rw, { method: 'POST', body }),
  activate: (id: string) => apiRequest<RewardAdminView>(`${rw}/${enc(id)}/activate`, { method: 'POST' }),
  deactivate: (id: string, reason: string) => apiRequest<RewardAdminView>(`${rw}/${enc(id)}/deactivate`, { method: 'POST', body: { reason } }),
  stock: (id: string, body: AdjustStock) => apiRequest<RewardAdminView>(`${rw}/${enc(id)}/stock`, { method: 'POST', body }),
  claims: (status?: string) => apiRequest<AdminRewardClaim[]>(`${rw}/claims${status ? `?status=${enc(status)}` : ''}`),
  deliver: (code: string) => apiRequest<AdminRewardClaim>(`${rw}/claims/deliver`, { method: 'POST', body: { code } }),
  cancel: (id: string, reason: string) => apiRequest<AdminRewardClaim>(`${rw}/claims/${enc(id)}/cancel`, { method: 'POST', body: { reason } }),
};

const vn = '/admin/venues';

/** Comercios (Paso 11): establecimientos, personal y campañas. La API valida roles y estado de aprobación. */
export const venuesAdminApi = {
  list: () => apiRequest<VenueAdminView[]>(vn),
  create: (body: CreateVenue) => apiRequest<VenueAdminView>(vn, { method: 'POST', body }),
  approve: (id: string) => apiRequest<VenueAdminView>(`${vn}/${enc(id)}/approve`, { method: 'POST' }),
  suspend: (id: string, reason: string) => apiRequest<VenueAdminView>(`${vn}/${enc(id)}/suspend`, { method: 'POST', body: { reason } }),
  linkCampaigns: (id: string, campaignSlugs: string[]) => apiRequest<VenueAdminView>(`${vn}/${enc(id)}/campaigns`, { method: 'PUT', body: { campaignSlugs } }),
  addPersonnel: (id: string, body: { email: string; role: 'STAFF' | 'DEALER' }) =>
    apiRequest<VenueAdminView>(`${vn}/${enc(id)}/personnel`, { method: 'POST', body }),
  removePersonnel: (id: string, userId: string) => apiRequest<VenueAdminView>(`${vn}/${enc(id)}/personnel/${enc(userId)}`, { method: 'DELETE' }),
};

/** Paneles de Staff y Comercio: solo lo propio y en agregado. */
export const venueSelfApi = {
  staff: () => apiRequest<StaffDashboard>('/staff/me'),
  dealer: () => apiRequest<DealerDashboard>('/dealer/me'),
  saveProfile: (body: VenueProfile) => apiRequest<DealerDashboard>('/dealer/me/profile', { method: 'PUT', body }),
};

/** Analítica (Paso 12): tableros agregados y reglas de referidos. */
export const analyticsApi = {
  dashboard: (days: number) => apiRequest<AnalyticsDashboard>(`/admin/analytics?days=${days}`),
  referralSettings: () => apiRequest<ReferralSettings>('/admin/referrals/settings'),
  saveReferralSettings: (body: ReferralSettings) => apiRequest<ReferralSettings>('/admin/referrals/settings', { method: 'PUT', body }),
  referralSummary: (days: number) => apiRequest<ReferralSummary>(`/admin/referrals/summary?days=${days}`),
};

const ev = '/admin';

/** Eventos y concursos (Paso 14): la API valida roles, fases y separación de funciones. */
export const eventsAdminApi = {
  list: () => apiRequest<EventAdminView[]>(`${ev}/events`),
  create: (body: CreateEvent) => apiRequest<EventAdminView>(`${ev}/events`, { method: 'POST', body }),
  setStatus: (id: string, status: 'PUBLICADO' | 'CERRADO') =>
    apiRequest<EventAdminView>(`${ev}/events/${enc(id)}/${status === 'PUBLICADO' ? 'publish' : 'close'}`, { method: 'POST' }),
  createContest: (eventId: string, body: CreateContest) => apiRequest<ContestAdminView>(`${ev}/events/${enc(eventId)}/contests`, { method: 'POST', body }),
  contest: (id: string) => apiRequest<ContestAdminView>(`${ev}/contests/${enc(id)}`),
  open: (id: string) => apiRequest<ContestAdminView>(`${ev}/contests/${enc(id)}/open`, { method: 'POST' }),
  close: (id: string) => apiRequest<ContestAdminView>(`${ev}/contests/${enc(id)}/close`, { method: 'POST' }),
  moderate: (id: string, entryId: string, decision: 'APROBADA' | 'RECHAZADA', reason?: string) =>
    apiRequest<ContestAdminView>(`${ev}/contests/${enc(id)}/entries/${enc(entryId)}/moderate`, { method: 'POST', body: { decision, reason } }),
  rotateScreen: (id: string) => apiRequest<ContestAdminView>(`${ev}/contests/${enc(id)}/screen/rotate`, { method: 'POST' }),
  deliverPrize: (id: string, code: string) => apiRequest<ContestAdminView>(`${ev}/contests/${enc(id)}/prize/deliver`, { method: 'POST', body: { code } }),
};

export const contactsAdminApi = {
  optIns: () => apiRequest<OptInContacts>('/admin/contacts/opt-ins'),
  registrations: (days: number) => apiRequest<Registrations>(`/admin/contacts/registrations?days=${days}`),
};
