import { parse as parseYaml } from 'yaml';

export type ColorMap = Record<string, string>;

export interface TypographyToken {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing?: string;
}

export interface DesignTokens {
  name: string;
  version: string;
  colors: ColorMap;
  typography: Record<string, TypographyToken>;
  rounded: Record<string, string>;
  spacing: Record<string, string>;
}

export interface BrandTheme {
  label: string;
  colors: ColorMap;
}

export interface ThemeSet {
  light: ColorMap;
  brands: Record<string, BrandTheme>;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function assertColors(colors: unknown, where: string): ColorMap {
  if (!colors || typeof colors !== 'object') throw new Error(`${where}: faltan colores`);
  for (const [key, value] of Object.entries(colors)) {
    if (typeof value !== 'string' || !HEX.test(value)) {
      throw new Error(`${where}: el color "${key}" debe ser hex #RRGGBB (recibido ${String(value)})`);
    }
  }
  return colors as ColorMap;
}

/** Extrae el front matter YAML de DESIGN.md (el formato que también consume Stitch). */
export function parseDesignMd(markdown: string): DesignTokens {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  if (!match?.[1]) throw new Error('DESIGN.md: no se encontró el bloque de front matter (---)');
  const data = parseYaml(match[1]) as Record<string, unknown>;

  const typography = (data.typography ?? {}) as Record<string, TypographyToken>;
  for (const [key, token] of Object.entries(typography)) {
    for (const field of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight'] as const) {
      if (!token?.[field]) throw new Error(`DESIGN.md: typography.${key} sin ${field}`);
    }
  }

  return {
    name: String(data.name ?? 'design-system'),
    version: String(data.version ?? '0.0.0'),
    colors: assertColors(data.colors, 'DESIGN.md colors'),
    typography,
    rounded: (data.rounded ?? {}) as Record<string, string>,
    spacing: (data.spacing ?? {}) as Record<string, string>,
  };
}

/** Lee design/themes.yaml: tema claro y capa de submarcas. */
export function parseThemes(yamlText: string): ThemeSet {
  const data = parseYaml(yamlText) as {
    light?: unknown;
    brands?: Record<string, Record<string, string>>;
  };
  const brands: Record<string, BrandTheme> = {};
  for (const [id, raw] of Object.entries(data.brands ?? {})) {
    const { label, ...colors } = raw;
    brands[id] = { label: label ?? id, colors: assertColors(colors, `themes.yaml brands.${id}`) };
  }
  return { light: assertColors(data.light, 'themes.yaml light'), brands };
}
