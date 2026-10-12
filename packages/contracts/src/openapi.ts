import { z } from 'zod';

/**
 * Convierte esquemas zod en componentes JSON Schema para el documento OpenAPI,
 * de modo que el contrato publicado salga de la misma fuente que valida en runtime.
 */
export function toOpenApiComponents(schemas: Record<string, z.ZodType>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, schema] of Object.entries(schemas)) {
    const { $schema: _ignored, ...json } = z.toJSONSchema(schema, { target: 'openapi-3.0' }) as Record<string, unknown>;
    out[name] = json;
  }
  return out;
}
