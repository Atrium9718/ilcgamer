/**
 * Edad cumplida a la fecha de hoy en Colombia (America/Bogota, UTC−5 sin horario de verano).
 * Se calcula y se descarta: la fecha de nacimiento no se persiste (Guía Técnica §5.2).
 */
export function ageOn(birthDateIso: string, now: Date = new Date()): number {
  const [y, m, d] = birthDateIso.split('-').map(Number) as [number, number, number];
  const bogota = new Date(now.getTime() - 5 * 3600 * 1000);
  let age = bogota.getUTCFullYear() - y;
  const month = bogota.getUTCMonth() + 1;
  if (month < m || (month === m && bogota.getUTCDate() < d)) age -= 1;
  return age;
}

export function isFutureDate(birthDateIso: string, now: Date = new Date()): boolean {
  return new Date(`${birthDateIso}T00:00:00-05:00`).getTime() > now.getTime();
}
