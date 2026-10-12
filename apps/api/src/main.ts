import { createApp } from './bootstrap.ts';
import { ENV } from './config/config.module.ts';
import type { Env } from './config/env.ts';

const app = await createApp();
const env = app.get<Env>(ENV);
await app.listen({ port: env.PORT, host: '0.0.0.0' });
