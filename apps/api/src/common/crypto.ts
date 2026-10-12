import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/** HMAC con el secreto del servidor: permite buscar por un valor sin guardarlo en claro. */
export const hmac = (secret: string, value: string): string => createHmac('sha256', secret).update(value).digest('hex');

export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

/** Código numérico uniforme (sin sesgo de módulo) para OTP. */
export function randomDigits(length: number): string {
  let out = '';
  while (out.length < length) {
    const b = randomBytes(1)[0] as number;
    if (b < 250) out += String(b % 10);
  }
  return out;
}

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
