import type { DateParts } from '@ilc/ui';

export type BirthDateCheck = { kind: 'incomplete' } | { kind: 'invalid' } | { kind: 'underage' } | { kind: 'ok'; age: number };

/**
 * Validación de fecha de nacimiento en el cliente (solo para la UX). La decisión y el registro del
 * control de edad los hace el servidor según el mecanismo aprobado por campaña (Guía Técnica §5.2).
 */
export function checkBirthDate({ day, month, year }: DateParts, minAge = 18, today = new Date()): BirthDateCheck {
  if (!day || !month || year.length !== 4) return { kind: 'incomplete' };
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  const date = new Date(Date.UTC(y, m - 1, d));
  const valid = date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  if (!valid || y < 1900 || date.getTime() > today.getTime()) return { kind: 'invalid' };
  let age = today.getUTCFullYear() - y;
  const beforeBirthday = today.getUTCMonth() < m - 1 || (today.getUTCMonth() === m - 1 && today.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age >= minAge ? { kind: 'ok', age } : { kind: 'underage' };
}
