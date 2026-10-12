import { describe, expect, it } from 'vitest';
import { applyCampaignTheme } from './theme.ts';

describe('applyCampaignTheme', () => {
  it('aplica modo, submarca y colores de marca válidos', () => {
    const root = document.createElement('html');
    applyCampaignTheme({ mode: 'light', brand: 'ron-viejo-de-caldas', brandColors: { 'brand-accent': '#C9A45C' } }, root);
    expect(root.dataset.theme).toBe('light');
    expect(root.dataset.brand).toBe('ron-viejo-de-caldas');
    expect(root.style.getPropertyValue('--color-brand-accent')).toBe('#C9A45C');
  });

  it('ignora valores inválidos o inyecciones desde el CMS', () => {
    const root = document.createElement('html');
    applyCampaignTheme({ brand: 'x"] body{', brandColors: { 'brand-accent': 'red; background:url(x)' } }, root);
    expect(root.dataset.brand).toBeUndefined();
    expect(root.style.getPropertyValue('--color-brand-accent')).toBe('');
  });
});
