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
| 03 · Crear El Parche | `1f01d56e125d4d2199be04d92d6449c7` | `CreateParcheView` |
| 04 · Unirse a un Parche (PIN/QR) | `31c4c92fd8f5459ea438679f1af5acdf` | `JoinParcheView` |
| 05 · Sala del Parche | `d56a9f9e1c294295ab6751296f931172` | `ParcheRoomView` |
| 06 · Catálogo de juegos | `a78d115e4bbf412d8e55b63da0875204` | `GamesCatalogView` |
| 07 · Resultado de juego | `b5c997722c654fdbadeebf42a3025621` | `GameResultView` |
| 08 · Mi billetera | `21255c5cbd604c0ab5e83a3c2ce01c46` | `WalletView` |
| 09 · Mi progreso (Ruta B) | `1552dadea49c421d974f364286717602` | `ProgressView` |
| 10 · Recompensas y canje | `010e1e4a13a8438187fd5f804b68cc5c` | `RewardsView` |
| 11 · Perfil y referidos | `31c99aa559004c68ab75a583906ba420` | `ProfileView` |
| 12 · Compartir logro | `9ea01a45f5f34540a3919c8a633825fb` | `ShareCardView` |
| 13 · Guarda tu progreso | `1a65677e0fa84920a5abb3b2458d907f` | `SignUpView` |
| 14 · Verificación por código | `73017fc39ce2415db68c32549d62296b` | `OtpView` (teclado nativo con autocompletado, no teclado en pantalla) |
| 15 · Tus autorizaciones | `af78a00baae44e2fb0b90da9759d6c84` | `ConsentsView` (cada interruptor se guarda al instante) |
| 16 · Consola · Campañas | `3834fade7df24187bcc2db1ede709b75` | `ConsoleLayout`, `CampaignListView`, `CampaignEditorView`, `ConsoleLoginView` (tema claro) |
| 17 · Consola · Detalle de campaña | `c69464065ad54a008c2692ace544d642` | `CampaignDetailView` (sin íconos de copas, equivalencias en pesos ni etiqueta de entorno inventada que traía Stitch) |
| 18 · Consola · Smart Tags | `81e6ec3918784f939afd881ff120f45b` | `SmartTagsView` (sin "servicio de cifrado activo" ni conteos inventados que traía Stitch) |

Los prompts comparten `prompts/_reglas-comunes.md` (paleta, salvaguardas y advertencia legal) para reducir correcciones.

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
personas bebiendo, íconos de copas, lenguaje "VIP/party", presión de consumo ("+ energía" por otra botella),
nombres de personas (solo alias) ni datos de producto inventados ("40% vol.", referencias inexistentes).
La advertencia legal es obligatoria.

## Accesibilidad

- `pnpm tokens` falla si un par texto/fondo de cualquier tema baja de 4.5:1.
- `node tools/a11y_audit.cjs` audita con axe (WCAG 2.1 AA) todas las historias de Storybook en ambos temas
  (instrucciones en el encabezado del script).
- Radios: `rounded-xl` = 12px (botones, inputs), `rounded-2xl` = 16px (tarjetas), `rounded-3xl` = 24px (hojas),
  la misma semántica que usa el HTML de Stitch.

## Ver el sistema

```bash
pnpm install
pnpm tokens        # genera packages/design-tokens/dist/theme.css
pnpm storybook     # http://localhost:6006 — barra superior: Tema (oscuro/claro) y Submarca
```
