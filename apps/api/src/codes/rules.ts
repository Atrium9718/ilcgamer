import type { CampaignRules } from '@ilc/contracts';

/**
 * Cálculo de la emisión en servidor (Guía Técnica §5.7 regla 2): puntos por referencia × el mayor
 * multiplicador vigente. Los multiplicadores no se acumulan entre sí.
 */
export function pointsFor(rules: CampaignRules, sku: string, now = new Date()): { points: number; factor: number } {
  const base = rules.pointsBySku[sku] ?? 0;
  const factor = rules.multipliers
    .filter((m) => new Date(m.startsAt).getTime() <= now.getTime() && now.getTime() < new Date(m.endsAt).getTime())
    .reduce((max, m) => Math.max(max, m.factor), 1);
  return { points: Math.round(base * factor), factor };
}

/** Colombia no tiene horario de verano: el día comercial empieza a las 00:00 UTC−5. */
const OFFSET_MS = 5 * 60 * 60 * 1000;
export function startOfColombiaDay(now = new Date()): Date {
  const local = new Date(now.getTime() - OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + OFFSET_MS);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
