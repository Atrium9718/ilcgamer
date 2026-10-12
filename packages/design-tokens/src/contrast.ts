import type { ColorMap } from './parse.ts';

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** Relación de contraste WCAG 2.x entre dos colores hex. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Pares texto/fondo que la interfaz usa y deben cumplir AA (4.5:1). */
export const TEXT_PAIRS: ReadonlyArray<readonly [fg: string, bg: string]> = [
  ['on-surface', 'surface'],
  ['on-surface', 'surface-container'],
  ['on-surface', 'surface-container-high'],
  ['on-surface-variant', 'surface'],
  ['on-surface-variant', 'surface-container'],
  ['on-primary', 'primary'],
  ['on-primary-container', 'primary-container'],
  ['on-secondary', 'secondary'],
  ['on-secondary-container', 'secondary-container'],
  ['on-tertiary', 'tertiary'],
  ['on-tertiary-container', 'tertiary-container'],
  ['on-error', 'error'],
  ['on-error-container', 'error-container'],
  ['on-warning', 'warning'],
  ['primary', 'surface'],
  ['secondary', 'surface'],
  ['tertiary', 'surface'],
  ['error', 'surface'],
  ['warning', 'surface'],
];

export interface ContrastFailure {
  fg: string;
  bg: string;
  ratio: number;
}

export function auditContrast(colors: ColorMap, minimum = 4.5): ContrastFailure[] {
  const failures: ContrastFailure[] = [];
  for (const [fg, bg] of TEXT_PAIRS) {
    const a = colors[fg];
    const b = colors[bg];
    if (!a || !b) continue;
    const ratio = contrastRatio(a, b);
    if (ratio < minimum) failures.push({ fg, bg, ratio: Math.round(ratio * 100) / 100 });
  }
  return failures;
}
