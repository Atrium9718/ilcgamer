import { describe, expect, it } from 'vitest';
import { ApiErrorSchema, ERROR_CODES, ERROR_HTTP_STATUS, HealthResponseSchema, toOpenApiComponents } from '../src/index.ts';

describe('errores', () => {
  it('cada código tiene un estado HTTP', () => {
    for (const code of ERROR_CODES) expect(ERROR_HTTP_STATUS[code], code).toBeGreaterThanOrEqual(400);
  });

  it('valida la forma del error', () => {
    expect(ApiErrorSchema.safeParse({ error: { code: 'NOT_FOUND', message: 'No existe', retryable: false } }).success).toBe(true);
    expect(ApiErrorSchema.safeParse({ error: { code: 'INVENTADO', message: 'x', retryable: false } }).success).toBe(false);
  });
});

describe('OpenAPI', () => {
  it('genera componentes JSON Schema desde zod', () => {
    const c = toOpenApiComponents({ HealthResponse: HealthResponseSchema }) as Record<string, { type: string; properties: object }>;
    expect(c.HealthResponse?.type).toBe('object');
    expect(Object.keys(c.HealthResponse?.properties ?? {})).toContain('checks');
  });
});

import { AgeGateRequestSchema, AliasSchema, OtpVerifySchema } from '../src/index.ts';

describe('identidad', () => {
  it('el alias admite tildes y ñ, no símbolos ni textos largos', () => {
    expect(AliasSchema.safeParse('Andrés Ñ').success).toBe(true);
    expect(AliasSchema.safeParse('<script>').success).toBe(false);
    expect(AliasSchema.safeParse('a').success).toBe(false);
    expect(AliasSchema.safeParse('x'.repeat(21)).success).toBe(false);
  });

  it('el control de edad exige la declaración explícita', () => {
    expect(AgeGateRequestSchema.safeParse({ birthDate: '1990-08-14', declaration: true }).success).toBe(true);
    expect(AgeGateRequestSchema.safeParse({ birthDate: '1990-08-14', declaration: false }).success).toBe(false);
    expect(AgeGateRequestSchema.safeParse({ birthDate: '1990-02-30', declaration: true }).success).toBe(false);
  });

  it('el OTP tiene exactamente 6 dígitos', () => {
    expect(OtpVerifySchema.safeParse({ channel: 'whatsapp', destination: '3001234567', code: '123456' }).success).toBe(true);
    expect(OtpVerifySchema.safeParse({ channel: 'whatsapp', destination: '3001234567', code: '12345a' }).success).toBe(false);
  });
});

describe('mensajes de validación', () => {
  it('están en español', async () => {
    const { CampaignDraftSchema } = await import('../src/index.ts');
    const r = CampaignDraftSchema.safeParse({});
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message).join(' ')).toMatch(/inválida/);
    expect(r.error?.issues.map((i) => i.message).join(' ')).not.toMatch(/expected|Invalid input|Too small/);
  });
});
