/**
 * Tema de campaña/temporada enviado por el CMS (Instrucciones §2: temas estéticos por temporada
 * sin pasar por tiendas). Solo se aceptan variables de marca; los roles funcionales (estados,
 * contraste, error) no se pueden sobrescribir desde una campaña.
 */
export interface CampaignTheme {
  mode?: 'dark' | 'light';
  /** Submarca definida en design/themes.yaml (ej. "ron-viejo-de-caldas"). */
  brand?: string;
  /** Overrides puntuales de variables --color-brand-* en hex. */
  brandColors?: Partial<Record<'brand-accent' | 'brand-surface' | 'on-brand-surface', string>>;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const BRAND_ID = /^[a-z0-9-]+$/;

export function applyCampaignTheme(theme: CampaignTheme, root: HTMLElement = document.documentElement): void {
  if (theme.mode === 'light') root.dataset.theme = 'light';
  else delete root.dataset.theme;

  if (theme.brand && BRAND_ID.test(theme.brand)) root.dataset.brand = theme.brand;

  for (const [key, value] of Object.entries(theme.brandColors ?? {})) {
    if (value && HEX.test(value)) root.style.setProperty(`--color-${key}`, value);
  }
}
