# Capa visual — cómo se diseña y cómo se modifica

La capa visual vive separada de la lógica. Se diseña en **Google Stitch** y entra al código como
*vistas puras* (`packages/ui/src/views`) que solo reciben datos y callbacks por props.

```
design/DESIGN.md ──(Stitch: design system "ILC Origen")──▶ pantallas en Stitch
       │                                                        │ tools/stitch_pull.py
       ▼                                                        ▼
packages/design-tokens ──▶ dist/theme.css (Tailwind v4)   design/stitch-exports/<pantalla>/
       │                                                        │ traducción a JSX
       └───────────────▶ packages/ui (componentes + vistas) ◀───┘
                                   │
                                   ▼
                     apps/pwa (contenedores: datos, API, reglas)
```

## Archivos

| Archivo | Para qué |
|---|---|
| `DESIGN.md` | Fuente de verdad visual (colores, tipografía, radios, espaciado + guía de estilo). Es el mismo archivo que usa Stitch. |
| `themes.yaml` | Tema claro y capa de submarcas (ILC, Ron Viejo de Caldas, Aguardiente Amarillo, Aguardiente Cristal). Valores **provisionales** hasta tener manuales de marca. |
| `prompts/NN-pantalla.md` | Prompt versionado con el que se generó cada pantalla en Stitch y las fuentes que la sustentan. |
| `stitch-exports/NN-pantalla/` | HTML, captura y metadatos exportados de Stitch (referencia para traducción y regresión visual). |

## Proyecto en Stitch

- Proyecto: **Diseño PWA Intuitiva** (`3853668696389706038`)
- Design system: **ILC Origen** (`assets/7550220495064176270`)

| Pantalla | Screen ID | Vista en código |
|---|---|---|
| 01 · Control de edad +18 | `718c133eb8234d9380e12d6947d09555` | `AgeGateView` |
| 02 · Landing de código | `6e5e27a297e54883ac3d91047b05679e` | `CodeLandingView` |

## Cambiar el diseño

- **Un color, tipografía o radio:** editar `DESIGN.md` (y `themes.yaml` para tema claro/submarcas) →
  `pnpm tokens`. El build falla si algún par texto/fondo baja de WCAG AA. Subir el mismo DESIGN.md a Stitch.
- **Una pantalla:** editarla en Stitch → `STITCH_API_KEY=... pnpm design:pull <slug> <screenId>` →
  actualizar solo la vista en `packages/ui/src/views/` (reemplazar hex sueltos por tokens) → revisar en Storybook.
- **Tema de temporada/campaña sin desplegar:** el CMS envía `{ mode, brand, brandColors }` y la PWA llama
  `applyCampaignTheme()`. Solo se aceptan variables `--color-brand-*`; los colores funcionales no cambian.

## Reglas de contenido al traducir pantallas de Stitch

Stitch a veces inventa datos. Antes de aceptar una pantalla, revisar que **no** incluya:
afirmaciones de autenticidad ("100 % auténtico", "Seguro"), fechas/cifras/claims de producto no aprobados,
personas bebiendo, lenguaje "VIP/party" o presión de consumo. La advertencia legal es obligatoria.

## Ver el sistema

```bash
pnpm install
pnpm tokens        # genera packages/design-tokens/dist/theme.css
pnpm storybook     # http://localhost:6006 — barra superior: Tema (oscuro/claro) y Submarca
```
