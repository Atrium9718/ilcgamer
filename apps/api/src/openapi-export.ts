import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOpenApi, createApp } from './bootstrap.ts';
import { ENV } from './config/config.module.ts';
import type { Env } from './config/env.ts';

/** Exporta docs/api/openapi.json para revisión de contratos (Guía Técnica §7: publicar OpenAPI). */
const app = await createApp({ logger: false });
await app.init();
const out = resolve(dirname(fileURLToPath(import.meta.url)), '../../../docs/api/openapi.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(buildOpenApi(app, app.get<Env>(ENV)), null, 2)}\n`);
await app.close();
console.log(`✓ OpenAPI → ${out}`);
