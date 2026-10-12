import type { ColorMap, DesignTokens, ThemeSet } from './parse.ts';

/**
 * Stitch genera HTML con la paleta completa de Material 3, incluidos los roles "fixed".
 * Para que una pantalla exportada se vea igual sin editar clases, derivamos esos alias
 * desde los roles que sí definimos en DESIGN.md.
 */
const M3_ALIASES: Record<string, string> = {
  'surface-tint': 'primary',
  'surface-variant': 'surface-container-highest',
  'primary-fixed': 'primary',
  'primary-fixed-dim': 'primary-container',
  'on-primary-fixed': 'on-primary',
  'on-primary-fixed-variant': 'on-primary-container',
  'secondary-fixed': 'secondary',
  'secondary-fixed-dim': 'secondary',
  'on-secondary-fixed': 'on-secondary',
  'on-secondary-fixed-variant': 'on-secondary-container',
  'tertiary-fixed': 'tertiary',
  'tertiary-fixed-dim': 'tertiary',
  'on-tertiary-fixed': 'on-tertiary',
  'on-tertiary-fixed-variant': 'on-tertiary-container',
};

export function withAliases(colors: ColorMap): ColorMap {
  const out: ColorMap = { ...colors };
  for (const [alias, source] of Object.entries(M3_ALIASES)) {
    const value = colors[source];
    if (!out[alias] && value) out[alias] = value;
  }
  return out;
}

const FALLBACK_STACK: Record<string, string> = {
  'EB Garamond': '"EB Garamond", Georgia, "Times New Roman", serif',
  'Plus Jakarta Sans': '"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
};

function fontStack(family: string): string {
  return FALLBACK_STACK[family] ?? `"${family}", system-ui, sans-serif`;
}

function colorVars(colors: ColorMap, indent = '  '): string {
  return Object.entries(withAliases(colors))
    .map(([k, v]) => `${indent}--color-${k}: ${v};`)
    .join('\n');
}

/**
 * Genera la hoja de tema para Tailwind CSS v4.
 * - `@theme` crea las utilidades (bg-surface, text-on-surface, font-headline-md, text-body-md, rounded-lg…)
 *   con los mismos nombres que usa Stitch, por lo que el HTML exportado se traduce casi 1:1.
 * - Las utilidades leen variables CSS, así que el tema claro, las submarcas y los temas de campaña
 *   enviados por el CMS se aplican en tiempo de ejecución sin recompilar.
 */
export function emitThemeCss(tokens: DesignTokens, themes: ThemeSet): string {
  const lines: string[] = [
    `/* Generado por @ilc/design-tokens desde design/DESIGN.md (${tokens.name} v${tokens.version}).`,
    ' * NO EDITAR A MANO: cambie design/DESIGN.md o design/themes.yaml y ejecute `pnpm tokens`. */',
    '',
    '@theme {',
    colorVars(tokens.colors),
  ];

  // Variables de submarca por defecto (ILC corporativo) para que existan las utilidades bg-brand-*.
  const defaultBrand = themes.brands.ilc ?? Object.values(themes.brands)[0];
  if (defaultBrand) {
    for (const [k, v] of Object.entries(defaultBrand.colors)) lines.push(`  --color-${k}: ${v};`);
  }

  const families = new Set<string>();
  for (const [name, t] of Object.entries(tokens.typography)) {
    families.add(t.fontFamily);
    lines.push(`  --font-${name}: ${fontStack(t.fontFamily)};`);
    lines.push(`  --text-${name}: ${t.fontSize};`);
    lines.push(`  --text-${name}--line-height: ${t.lineHeight};`);
    lines.push(`  --text-${name}--font-weight: ${t.fontWeight};`);
    if (t.letterSpacing) lines.push(`  --text-${name}--letter-spacing: ${t.letterSpacing};`);
  }
  const headline = Object.entries(tokens.typography).find(([k]) => k.startsWith('headline'))?.[1];
  const body = Object.entries(tokens.typography).find(([k]) => k.startsWith('body'))?.[1];
  if (headline) lines.push(`  --font-headline: ${fontStack(headline.fontFamily)};`);
  if (body) lines.push(`  --font-body: ${fontStack(body.fontFamily)};`, `  --font-sans: ${fontStack(body.fontFamily)};`);

  for (const [name, value] of Object.entries(tokens.rounded)) {
    if (name === 'DEFAULT') lines.push(`  --radius: ${value};`);
    else lines.push(`  --radius-${name}: ${value};`);
  }
  for (const [name, value] of Object.entries(tokens.spacing)) {
    lines.push(`  --spacing-${name}: ${value};`);
  }
  lines.push('}', '');

  lines.push('/* Tema claro: <html data-theme="light"> */', '[data-theme="light"] {', colorVars(themes.light), '  color-scheme: light;', '}', '');

  for (const [id, brand] of Object.entries(themes.brands)) {
    lines.push(`/* Submarca: ${brand.label} */`, `[data-brand="${id}"] {`);
    for (const [k, v] of Object.entries(brand.colors)) lines.push(`  --color-${k}: ${v};`);
    lines.push('}', '');
  }

  lines.push(`/* Familias tipográficas usadas: ${[...families].join(', ')} */`, '');
  return lines.join('\n');
}

export function googleFontsHref(tokens: DesignTokens): string {
  const weights = new Map<string, Set<string>>();
  for (const t of Object.values(tokens.typography)) {
    const set = weights.get(t.fontFamily) ?? new Set<string>();
    set.add(t.fontWeight);
    set.add('400');
    weights.set(t.fontFamily, set);
  }
  const families = [...weights.entries()]
    .map(([f, w]) => `family=${f.replaceAll(' ', '+')}:wght@${[...w].sort().join(';')}`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
