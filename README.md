# ILC Phygital — ilcgamer

Plataforma de gamificación y fidelización phygital para la Industria Licorera de Caldas (ILC):
PWA móvil abierta por QR, dos rutas de juego (A: activación comercial, B: experiencia de marca),
El Parche (sesión grupal en tiempo real), economía dual con ledger y consolas de Staff, Comercio y Admin.

- Plan de desarrollo: [`docs/PLAN_MAESTRO.md`](docs/PLAN_MAESTRO.md)
- Capa visual: diseñada en Google Stitch (MCP configurado en `.mcp.json`; requiere la variable `STITCH_API_KEY`).

## Estructura

| Carpeta | Qué es |
|---|---|
| `apps/pwa` | App del jugador (PWA React). Entradas por QR, control de edad, Parche, juegos, billetera, perfil. |
| `apps/api` | API NestJS + PostgreSQL (Prisma) + Redis. `/api/v1`, OpenAPI, reglas de integridad en BD. |
| `packages/ui` | Capa visual: componentes y vistas puras traducidas desde Google Stitch + Storybook. |
| `packages/design-tokens` | `design/DESIGN.md` → tema Tailwind v4 (con puerta de contraste WCAG AA). |
| `packages/contracts` | Contratos compartidos API ⇄ PWA (zod): estados de dominio, errores, cabeceras. |
| `design/` | Sistema de diseño, prompts y exportes de Stitch. |
| `docs/` | Plan maestro, entornos, OpenAPI exportado. |

## Empezar

Ver [`docs/ENTORNOS.md`](docs/ENTORNOS.md) para el detalle. Resumen:

```bash
pnpm install
pnpm db:up && cp apps/api/.env.example apps/api/.env && cp apps/pwa/.env.example apps/pwa/.env
pnpm build && pnpm db:migrate
pnpm dev:api     # http://localhost:3000/api/v1/health
pnpm dev:pwa     # http://localhost:5173
pnpm storybook   # capa visual en http://localhost:6006
pnpm lint && pnpm typecheck && pnpm test
```

- Plan de desarrollo: [`docs/PLAN_MAESTRO.md`](docs/PLAN_MAESTRO.md)
- Capa visual y flujo con Stitch: [`design/README.md`](design/README.md)
