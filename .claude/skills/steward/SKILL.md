---
name: steward
description: Convenciones del repositorio ILC Origen para llevar un PR a verde (CI, revisiones, conflictos). Úsalo al trabajar sobre un PR propio.
---
# Cómo llevar un PR a verde en ILC Origen

- Lee `CLAUDE.md`. El CI corre: Biome, build, migraciones, tipos, `pnpm audit --prod`, `pnpm secrets`, pruebas (API con PostgreSQL y Redis),
  Storybook + axe y el E2E de la ruta crítica (`pnpm e2e`).
- Reproduce el fallo **localmente** con el mismo comando antes de arreglar; tras el arreglo, muestra que ese comando pasa.
- Si falla `security.spec.ts`: hay una ruta sin protección o un cambio de contrato; no agregues la ruta a la lista pública sin una razón de producto escrita.
- Si falla una prueba de saldo/stock/idempotencia: es un defecto real; nunca la marques como flaky ni la saltes.
- Conflictos: merge de la base en la rama (sin reescribir historia). Migraciones nuevas deben quedar **después** de las de la base: renómbralas si chocan.
- No amplíes el alcance del PR; no cambies reglas de producto para pasar una prueba.
- Comentarios de revisión: implementa lo pequeño y local; lo grande o de diseño se pregunta a la persona responsable.
