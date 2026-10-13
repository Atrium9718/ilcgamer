# ILC Origen — guía para agentes

Plataforma phygital de gamificación de la Industria Licorera de Caldas (PWA + consola + API). **Responde y escribe en español**
(Colombia). Lee también `AGENTS.md` (bloque de Turborepo: no lo borres) y `docs/PLAN_MAESTRO.md` (estado y decisiones).

## Mapa
`apps/api` NestJS+Prisma · `apps/pwa` PWA de personas · `apps/console` consola (Marca, TI, Staff, Comercio) ·
`packages/contracts` esquemas zod compartidos (fuente de verdad de la API) · `packages/ui` vistas puras + Storybook ·
`packages/game-sdk` · `games/ejemplos` · `deploy/` `infra/` operación · `docs/` · `tools/` · `design/` (Stitch).

## Cómo trabajar
1. Cambia **contratos primero** (`packages/contracts`) y recompila: `pnpm --filter @ilc/contracts build` (la API y las pruebas leen `dist`).
2. Base de datos: solo **migraciones hacia adelante** (`prisma migrate diff … --script` o `--create-only`); nunca `migrate reset`.
3. Cada cambio con pruebas: API contra PostgreSQL real, vistas con Testing Library, accesibilidad con axe.
4. Antes de dar algo por terminado, corre todo (abajo) y reporta honestamente lo que falle.
5. Commits en español, claros; **no crees un PR si no te lo piden**; trabaja en la rama indicada por la sesión.

## Verificación completa
```bash
pnpm exec biome check --write .      # lint y formato
pnpm build && pnpm typecheck
TEST_DATABASE_URL=postgresql://ilc@localhost:5432/ilc_test TEST_REDIS_URL=redis://localhost:6379/1 pnpm test
pnpm storybook:build   # + `pnpm a11y` con STORYBOOK_URL (axe, WCAG AA claro y oscuro)
pnpm audit --prod && pnpm secrets
pnpm e2e               # ruta crítica con stack real (ver docs/OPERACION.md y tools/e2e)
```
Servicios locales (si no están): PostgreSQL 16 en 5432 y Redis en 6379 (`docker-compose.yml` o instalaciones locales). Pruebas con
`OTP_PROVIDER=console` (el código sale en el log de la API).

## Reglas que NO se rompen (producto y seguridad)
- **Dos economías separadas**: Puntos ILC (solo por activar un código de botella; ledger inmutable) y XP/insignias (Ruta B). Nunca se convierten.
  Un juego **nunca** emite Puntos ILC; el servidor decide todo resultado; el cliente jamás se asigna recompensas.
- Nada que premie velocidad, cantidad o presión para consumir alcohol; sin copas/botellas en juegos o tarjetas; contenido de marca solo con aprobación.
- Operaciones con efecto económico: **idempotentes, atómicas y auditadas**; los ajustes son movimientos compensatorios, nunca ediciones.
- Separación de funciones: quien crea no aprueba/activa (campañas, juegos, recompensas).
- Datos personales mínimos: la fecha de nacimiento no se guarda; analítica sin PII (registro de eventos en `analytics.service.ts`);
  Staff y Comercio solo ven agregados. No agregues rastreadores, huella de dispositivo ni recursos de terceros (fuentes autoalojadas).
- Toda ruta nueva debe exigir sesión/rol: la prueba `security.spec.ts` recorre el contrato y falla si algo queda abierto.
- **Secretos**: nunca en el repositorio (ni en prompts, logs o commits). `docs/fuentes/` (documentos del cliente) está ignorado: no lo publiques.

## Administración de la plataforma
Lo operativo se hace **por la consola o la API con los permisos de una persona**, no tocando la base de datos a mano:
campañas, juegos, recompensas, comercios, referidos y ajustes. Para producción solo se prepara y se propone (PR, comandos de
`docs/DESPLIEGUE.md`/`docs/OPERACION.md`); **ejecutar en producción lo decide y autoriza una persona de TI**.
