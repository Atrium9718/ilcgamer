/**
 * Línea CSV (RFC 4180) segura para hojas de cálculo: las celdas que empiezan por =, +, -, @, tabulador o retorno
 * se prefijan con ' para que Excel no las ejecute como fórmula (inyección CSV).
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n;]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export const csvLine = (cells: string[]): string => cells.map(csvCell).join(',');
