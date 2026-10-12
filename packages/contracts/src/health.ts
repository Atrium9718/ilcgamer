import { z } from 'zod';

export const DependencyStatusSchema = z.enum(['up', 'down']);

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  version: z.string(),
  environment: z.enum(['development', 'test', 'staging', 'production']),
  time: z.iso.datetime(),
  checks: z.object({
    database: DependencyStatusSchema,
    cache: DependencyStatusSchema,
  }),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
