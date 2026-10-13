import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../src/common/domain-error.ts';
import { WebhookOtpSender } from '../src/identity/otp-sender.ts';

describe('WebhookOtpSender', () => {
  it('entrega canal, destino y código a la pasarela con el token, y sin exponer nada más', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    await new WebhookOtpSender('https://pasarela.example/otp', 'token-de-prueba-123456', fetchImpl as unknown as typeof fetch).send(
      'whatsapp',
      '+573001234567',
      '123456',
    );
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://pasarela.example/otp');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer token-de-prueba-123456');
    expect(JSON.parse(String(init.body))).toMatchObject({ channel: 'whatsapp', destination: '+573001234567', code: '123456', locale: 'es-CO' });
  });

  it('si la pasarela falla responde con un error genérico reintentable, sin filtrar el motivo', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('boom interno', { status: 500 }));
    const sender = new WebhookOtpSender('https://pasarela.example/otp', 'token-de-prueba-123456', fetchImpl as unknown as typeof fetch);
    const err = await sender.send('sms', '+573001234567', '654321').catch((e) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe('SERVICE_UNAVAILABLE');
    expect(String((err as Error).message)).not.toMatch(/boom|500|654321/);
  });
});
