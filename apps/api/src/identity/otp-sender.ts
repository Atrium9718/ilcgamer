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

@Injectable()
export class DisabledOtpSender extends OtpSender {
  async send(): Promise<void> {
    throw new DomainError('AUTH_PROVIDER_NOT_CONFIGURED', 'El acceso por código aún no está disponible.');
  }
}

export const otpSenderProvider = {
  provide: OtpSender,
  inject: [ENV],
  useFactory: (env: Env): OtpSender => (env.OTP_PROVIDER === 'console' ? new ConsoleOtpSender() : new DisabledOtpSender()),
};
