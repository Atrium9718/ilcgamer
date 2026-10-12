import { randomBytes } from 'node:crypto';
import { GENERATED_TOKEN_LENGTH } from '@ilc/contracts';
import { sha256 } from '../common/crypto.ts';

/**
 * Tokens de Smart Tag (Guía Técnica §5.6). El token en claro solo existe en el QR impreso y en la descarga
 * única para la imprenta: la base de datos guarda su SHA-256 y los últimos 4 caracteres para soporte.
 */

/** Alfabeto Crockford base32: sin I, L, O, U para evitar confusiones al leerlo. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Token aleatorio uniforme de 12 caracteres = 60 bits de entropía. */
export function generateToken(length = GENERATED_TOKEN_LENGTH): string {
  let out = '';
  while (out.length < length) {
    for (const b of randomBytes(length)) {
      if (out.length === length) break;
      out += ALPHABET[b & 31];
    }
  }
  return out;
}

/** Hash del código de PRODUCTO. */
export const productTokenHash = (token: string): string => sha256(token);

/**
 * Hash del código de CAMPAÑA vinculado a la misma botella. Se deriva del hash de producto (no del token en claro,
 * que no se guarda) con un prefijo de dominio: los dos dominios nunca comparten fila ni estado (§5.6).
 */
export const campaignCodeHash = (productHash: string): string => sha256(`campaign:${productHash}`);

export const tokenHint = (token: string): string => token.slice(-4);
export const maskedHint = (hint: string): string => `••••${hint}`;
