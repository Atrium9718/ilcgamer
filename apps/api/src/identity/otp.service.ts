import type { OtpChannel } from '@ilc/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { hmac, randomDigits, safeEqualHex } from '../common/crypto.ts';
import { DomainError } from '../common/domain-error.ts';
import { ENV } from '../config/config.module.ts';
import type { Env } from '../config/env.ts';
import { RedisService } from '../redis/redis.service.ts';
import { maskDestination, normalizeDestination } from './destination.ts';
import { OtpSender } from './otp-sender.ts';

export const OTP_TTL_SECONDS = 300;
export const OTP_RESEND_SECONDS = 60;
export const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_PER_HOUR = 5;

interface StoredOtp {
  codeHash: string;
  attempts: number;
}

/**
 * Códigos de un solo uso con límites antiabuso en Redis (Guía Técnica §9.1-§9.2):
 * vencimiento de 5 min, reenvío cada 60 s, 5 envíos/hora por destino y 5 intentos por código.
 * El código y el destino se guardan como HMAC; nunca en claro.
 */
@Injectable()
export class OtpService {
  constructor(
    private readonly redis: RedisService,
    private readonly sender: OtpSender,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private key(kind: string, destinationId: string): string {
    return `otp:${kind}:${destinationId}`;
  }

  destinationId(channel: OtpChannel, normalized: string): string {
    return hmac(this.env.APP_SECRET, `${channel}:${normalized}`);
  }

  async request(channel: OtpChannel, rawDestination: string) {
    const destination = normalizeDestination(channel, rawDestination);
    const id = this.destinationId(channel, destination);
    const r = this.redis.client;

    if (!(await this.redis.isHealthy())) throw new DomainError('SERVICE_UNAVAILABLE');
    if (await r.exists(this.key('cooldown', id))) throw new DomainError('RATE_LIMITED', 'Espera un minuto antes de pedir otro código.');
    const sentThisHour = await r.incr(this.key('hour', id));
    if (sentThisHour === 1) await r.expire(this.key('hour', id), 3600);
    if (sentThisHour > OTP_MAX_PER_HOUR) throw new DomainError('RATE_LIMITED', 'Pediste demasiados códigos. Intenta más tarde.');

    const code = randomDigits(6);
    const stored: StoredOtp = { codeHash: hmac(this.env.APP_SECRET, `${id}:${code}`), attempts: 0 };
    await this.sender.send(channel, destination, code);
    await r.set(this.key('code', id), JSON.stringify(stored), 'EX', OTP_TTL_SECONDS);
    await r.set(this.key('cooldown', id), '1', 'EX', OTP_RESEND_SECONDS);

    return { maskedDestination: maskDestination(channel, destination), expiresInSeconds: OTP_TTL_SECONDS, resendInSeconds: OTP_RESEND_SECONDS };
  }

  /** Verifica y consume el código. Devuelve el destino normalizado si es correcto. */
  async verify(channel: OtpChannel, rawDestination: string, code: string): Promise<{ destination: string; destinationId: string }> {
    const destination = normalizeDestination(channel, rawDestination);
    const id = this.destinationId(channel, destination);
    const key = this.key('code', id);
    const raw = await this.redis.client.get(key);
    if (!raw) throw new DomainError('OTP_EXPIRED', 'El código venció o no existe. Pide uno nuevo.');

    const stored = JSON.parse(raw) as StoredOtp;
    if (stored.attempts >= OTP_MAX_ATTEMPTS) {
      await this.redis.client.del(key);
      throw new DomainError('OTP_LOCKED', 'Demasiados intentos. Pide un código nuevo.');
    }
    if (!safeEqualHex(stored.codeHash, hmac(this.env.APP_SECRET, `${id}:${code}`))) {
      stored.attempts += 1;
      const ttl = await this.redis.client.ttl(key);
      await this.redis.client.set(key, JSON.stringify(stored), 'EX', Math.max(ttl, 1));
      const left = OTP_MAX_ATTEMPTS - stored.attempts;
      if (left <= 0) {
        await this.redis.client.del(key);
        throw new DomainError('OTP_LOCKED', 'Demasiados intentos. Pide un código nuevo.');
      }
      throw new DomainError('OTP_INVALID', `Código incorrecto. Te quedan ${left} intentos.`);
    }
    await this.redis.client.del(key);
    return { destination, destinationId: id };
  }
}
