import type { OtpChannel } from '@ilc/contracts';
import { DomainError } from '../common/domain-error.ts';

/**
 * Normaliza el destino del código. Celulares de Colombia (+57 3XX XXX XXXX); correo en minúsculas.
 * Otros países se habilitan cuando el proveedor lo soporte.
 */
export function normalizeDestination(channel: OtpChannel, raw: string): string {
  if (channel === 'email') {
    const email = raw.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw invalid('Correo electrónico inválido.');
    return email;
  }
  const digits = raw.replace(/[^\d]/g, '');
  const local = digits.startsWith('57') && digits.length === 12 ? digits.slice(2) : digits;
  if (!/^3\d{9}$/.test(local)) throw invalid('Ingresa un celular colombiano de 10 dígitos que empiece por 3.');
  return `+57${local}`;
}

export function maskDestination(channel: OtpChannel, normalized: string): string {
  if (channel === 'email') {
    const [user = '', domain = ''] = normalized.split('@');
    return `${user.slice(0, 2)}•••@${domain}`;
  }
  return `+57 ${normalized.slice(3, 6)} •••• ${normalized.slice(-3)}`;
}

function invalid(message: string): DomainError {
  return new DomainError('VALIDATION_FAILED', message, { fields: { destination: [message] } });
}
