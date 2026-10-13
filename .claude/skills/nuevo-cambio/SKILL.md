---
name: nuevo-cambio
description: Receta para implementar un cambio nuevo en ILC Origen de punta a punta (contrato, API, vistas, pruebas, documentación). Úsalo para funcionalidades y correcciones no triviales.
---
# Receta de cambio

1. **Entender**: lee `docs/PLAN_MAESTRO.md` (decisiones y pendientes) y los archivos del módulo. Si falta una decisión de negocio, pregunta; no la inventes.
2. **Contrato**: `packages/contracts/src/*.ts` (zod, mensajes en español) → `pnpm --filter @ilc/contracts build`.
3. **API**: migración hacia adelante si hay datos nuevos (`prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`,
   aplicar a `ilc_dev` e `ilc_test`); servicio + controlador con `AuthGuard`/`RolesGuard`; auditoría y eventos con propiedades registradas.
4. **Vistas**: vista pura en `packages/ui` (+ historia de Storybook + prueba) y contenedor en `apps/pwa` o `apps/console`. Textos en español, objetivos táctiles de 48 px, contraste AA.
5. **Pruebas**: caso feliz, negativos, concurrencia/idempotencia si hay efecto económico, y permisos.
6. **Documentación**: actualiza `docs/PLAN_MAESTRO.md` (y `docs/ENTORNOS.md` si hay variables) y exporta OpenAPI: `pnpm --filter @ilc/api openapi:export`.
7. **Verificar todo** (comandos de `CLAUDE.md`) y resumir en español lo hecho, probado y pendiente.
