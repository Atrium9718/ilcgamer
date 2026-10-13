import type { OtpChannel } from '@ilc/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { DomainError } from '../common/domain-error.ts';
import { ENV } from '../config/config.module.ts';
import type { Env } from '../config/env.ts';

/**
 * Envío de códigos OTP. Interfaz intercambiable: cuando ILC contrate el proveedor de WhatsApp/SMS/correo
 * (Guía Técnica §5.2, §15) se agrega su implementación sin tocar el flujo de verificación.
 */
export abstract class OtpSender {
  abstract send(channel: OtpChannel, destination: string, code: string): Promise<void>;
}

/** Solo desarrollo/pruebas: no envía nada; deja el último código consultable para pruebas automáticas. */
@Injectable()
export class ConsoleOtpSender extends OtpSender {
  private readonly logger = new Logger('OTP');
  readonly outbox = new Map<string, string>();

  async send(channel: OtpChannel, destination: string, code: string): Promise<void> {
    this.outbox.set(destination, code);
    this.logger.warn(`[solo desarrollo] código ${code} por ${channel}`);
  }
}

/**
 * Entrega por una pasarela HTTP del proveedor que ILC elija (WhatsApp Business, SMS o correo transaccional): la API solo
 * le pasa canal, destino, código y texto. El código no se registra en logs y un fallo no revela detalles a quien pidió el código.
 */
@Injectable()
export class WebhookOtpSender extends OtpSender {
  private readonly logger = new Logger('OTP');
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    super();
  }

  async send(channel: OtpChannel, destination: string, code: string): Promise<void> {
    try {
      const res = await this.fetchImpl(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.token}` },
        body: JSON.stringify({
          channel,
          destination,
          code,
          locale: 'es-CO',
          message: `Tu código de ILC Origen es ${code}. Vence en 5 minutos. Solo para mayores de 18 años.`,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`pasarela respondió ${res.status}`);
    } catch (err) {
      this.logger.error(`No se pudo entregar un código por ${channel}: ${err instanceof Error ? err.message : 'error'}`);
      throw new DomainError('SERVICE_UNAVAILABLE', 'No pudimos enviar el código. Intenta de nuevo en un momento.');
    }
  }
}

@Injectable()
export class DisabledOtpSender extends OtpSender {
  async send(): Promise<void> {
    throw new DomainError('AUTH_PROVIDER_NOT_CONFIGURED', 'El acceso por código aún no está disponible.');
  }
}

export const otpSenderProvider = {
  provide: OtpSender,
  inject: [ENV],
  useFactory: (env: Env): OtpSender => {
    if (env.OTP_PROVIDER === 'console') return new ConsoleOtpSender();
    if (env.OTP_PROVIDER === 'webhook' && env.OTP_WEBHOOK_URL && env.OTP_WEBHOOK_TOKEN) return new WebhookOtpSender(env.OTP_WEBHOOK_URL, env.OTP_WEBHOOK_TOKEN);
    return new DisabledOtpSender();
  },
};
