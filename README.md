# ILC Phygital — ilcgamer

Plataforma de gamificación y fidelización phygital para la Industria Licorera de Caldas (ILC):
PWA móvil abierta por QR, dos rutas de juego (A: activación comercial, B: experiencia de marca),
El Parche (sesión grupal en tiempo real), economía dual con ledger y consolas de Staff, Comercio y Admin.

- Plan de desarrollo: [`docs/PLAN_MAESTRO.md`](docs/PLAN_MAESTRO.md)
- Capa visual: diseñada en Google Stitch (MCP configurado en `.mcp.json`; requiere la variable `STITCH_API_KEY`).

## Empezar

```bash
pnpm install
pnpm tokens      # genera el tema desde design/DESIGN.md (falla si no cumple WCAG AA)
pnpm test        # pruebas de tokens y UI
pnpm storybook   # capa visual en http://localhost:6006
```

Guía de la capa visual y flujo con Stitch: [`design/README.md`](design/README.md).
