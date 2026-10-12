import type { CampaignTheme, PublicCampaign } from '@ilc/contracts';
import { applyCampaignTheme } from '@ilc/ui';
import { apiRequest } from './api.ts';
import { KEYS, readLocal, writeLocal } from './storage.ts';

/** Campaña pública (solo activas y dentro de su ventana; sin reglas internas). */
export const fetchPublicCampaign = (slug: string) => apiRequest<PublicCampaign>(`/campaigns/${encodeURIComponent(slug)}`);

const DEFAULT_THEME: CampaignTheme = { mode: 'dark', brand: 'ilc' };

/** Recuerda el tema de la campaña de entrada durante la visita (no entre visitas). */
export function rememberCampaignTheme(theme: CampaignTheme): void {
  writeLocal(KEYS.campaignTheme, theme, 'session');
  applyCampaignTheme(theme);
}

export function applyStoredTheme(): void {
  applyCampaignTheme(readLocal<CampaignTheme>(KEYS.campaignTheme, DEFAULT_THEME, 'session'));
}

/** Slug de campaña de una entrada /e/:slug pendiente (para que el control de edad aplique su edad mínima). */
export function campaignSlugFromPath(path: string): string | undefined {
  return /^\/e\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:[/?#]|$)/.exec(path)?.[1];
}
