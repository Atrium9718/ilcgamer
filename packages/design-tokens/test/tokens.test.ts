import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditContrast, contrastRatio, emitThemeCss, parseDesignMd, parseThemes, withAliases } from '../src/index.ts';

const design = resolve(import.meta.dirname, '../../../design');
const tokens = parseDesignMd(readFileSync(resolve(design, 'DESIGN.md'), 'utf8'));
const themes = parseThemes(readFileSync(resolve(design, 'themes.yaml'), 'utf8'));

describe('DESIGN.md', () => {
  it('define los roles de color que usa la interfaz', () => {
    for (const role of ['surface', 'on-surface', 'primary', 'on-primary', 'secondary', 'error', 'warning', 'brand-red']) {
      expect(tokens.colors[role], role).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('usa EB Garamond en titulares y Plus Jakarta Sans en lectura', () => {
    expect(tokens.typography['headline-lg']?.fontFamily).toBe('EB Garamond');
    expect(tokens.typography['body-md']?.fontFamily).toBe('Plus Jakarta Sans');
  });

  it('rechaza colores que no sean hex', () => {
    expect(() => parseDesignMd('---\nname: x\ncolors:\n  primary: red\n---')).toThrow(/hex/);
  });
});

describe('accesibilidad (WCAG AA)', () => {
  it('calcula el contraste correctamente', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  });

  it('el tema oscuro cumple 4.5:1 en todos los pares de texto', () => {
    expect(auditContrast(tokens.colors)).toEqual([]);
  });

  it('el tema claro cumple 4.5:1 en todos los pares de texto', () => {
    expect(auditContrast({ ...tokens.colors, ...themes.light })).toEqual([]);
  });
});

describe('emisión de tema Tailwind v4', () => {
  const css = emitThemeCss(tokens, themes);

  it('expone utilidades con los nombres que usa Stitch', () => {
    expect(css).toContain('--color-surface-container: #162621;');
    expect(css).toContain('--font-headline-md:');
    expect(css).toContain('--text-body-md: 15px;');
  });

  it('deriva los alias M3 "fixed" que aparecen en el HTML de Stitch', () => {
    expect(withAliases(tokens.colors)['primary-fixed-dim']).toBe(tokens.colors['primary-container']);
    expect(css).toContain('--color-primary-fixed-dim:');
  });

  it('genera el tema claro y una regla por submarca', () => {
    expect(css).toContain('[data-theme="light"]');
    for (const id of Object.keys(themes.brands)) expect(css).toContain(`[data-brand="${id}"]`);
  });

  it('las submarcas solo sobrescriben variables de marca, nunca los roles funcionales', () => {
    for (const brand of Object.values(themes.brands)) {
      for (const key of Object.keys(brand.colors)) expect(key).toMatch(/brand/);
    }
  });
});
