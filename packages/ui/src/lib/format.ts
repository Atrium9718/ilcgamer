const numberFormat = new Intl.NumberFormat('es-CO');

/** 1250 → "1.250" (formato colombiano). */
export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** Cantidad con signo para movimientos: +500 / −1.200 (signo menos tipográfico). */
export function formatSigned(value: number): string {
  if (value === 0) return '0';
  return `${value > 0 ? '+' : '−'}${numberFormat.format(Math.abs(value))}`;
}
