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
