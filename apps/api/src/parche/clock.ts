/** Colombia no tiene horario de verano: la hora local es UTC−5 todo el año. */
const OFFSET_MS = 5 * 60 * 60 * 1000;

/**
 * Próxima ocurrencia de una hora local de Colombia ("06:00") estrictamente posterior a `now`.
 * Es el cierre del Parche (Instrucciones §3.2): un reloj distinto de la vigencia de los puntos (§5.5).
 */
export function nextLocalTime(now: Date, hhmm: string): Date {
  const [h = 6, m = 0] = hhmm.split(':').map(Number);
  const local = new Date(now.getTime() - OFFSET_MS);
  const candidate = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), h, m) + OFFSET_MS;
  return new Date(candidate > now.getTime() ? candidate : candidate + 24 * 60 * 60 * 1000);
}
