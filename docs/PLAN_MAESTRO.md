# Plan Maestro de Desarrollo — ILC Phygital (ilcgamer)

**Versión:** 0.1 (planeación) · **Fecha:** 12/10/2026
**Fuentes rectoras (en orden de jerarquía, Guía Técnica §1.1):**
1. `Instrucciones.md` — Especificación funcional y de negocio.
2. `Guia_Gamificacion_ILC_v1.2` — Marco de experiencia, salvaguardas, marca y privacidad.
3. `Guia_Tecnica_Arquitectura_ILC_v1.0` — Traducción técnica (stack, módulos, datos, API, pruebas, fases).

> Los documentos fuente viven en la carpeta de Drive **"ILC Gaming"**. No se versionan en este
> repositorio porque es **público**. Copia local de trabajo: `docs/fuentes/` (ignorada por git).

---

## 0. Principio rector de este plan

**Capa visual desacoplada y editable.** Todo lo que el usuario ve se diseña en **Google Stitch**
y vive en el código como *vistas puras* (sin lógica). La lógica (estado, API, reglas) vive en
*contenedores* separados. Cambiar el diseño = regenerar/editar en Stitch y reemplazar la vista,
sin tocar negocio. Además, los temas por temporada/marca se cambian **sin desplegar** (tokens
servidos por el CMS), tal como exige Instrucciones.md §2 ("temas estéticos por temporadas").

```
 Stitch (diseño)            Código (repo)                          Runtime
 ───────────────            ─────────────                          ───────
 DESIGN.md  ──────────▶  packages/design-tokens ──▶ CSS variables ◀── Tema de campaña (CMS)
 Pantallas  ──export──▶  packages/ui/views/*  (JSX puro, props)
                         apps/pwa/features/*/Container.tsx (hooks, API, reglas)
```

---

## 1. Decisiones de arquitectura (ADR resumidos)

| # | Decisión | Fundamento en las fuentes |
|---|---|---|
| ADR-01 | **PWA primero** (React + TypeScript + Vite), instalable, abierta por QR desde la cámara nativa. Empaquetado a tiendas con **Capacitor** solo si el piloto lo justifica (Fase 4). | Instrucciones §2 (Flutter **o** PWA, zero-friction); Guía Técnica §4.1 y §2.3.2 ("PWA primero"). |
| ADR-02 | **Tailwind CSS + tokens CSS variables**. Stitch exporta HTML+Tailwind → la traducción a componentes es directa y fiel. | Requisito del usuario: capa visual modificable; Guía Gamificación §22.2 (design system común + capa editorial por marca). |
| ADR-03 | **Backend monolito modular**: Node.js + TypeScript + **NestJS**, API versionada `/api/v1`, OpenAPI publicado. | Guía Técnica §4.2 y §4.3. |
| ADR-04 | **PostgreSQL** (transaccional: claims, ledger, inventario) + **Prisma** como ORM/migraciones. | Guía Técnica §4.3, §5.7 (ledger), §6. |
| ADR-05 | **Redis** solo para: expiración de sesiones del Parche, rate limiting y pub/sub de tiempo real. | Guía Técnica §4.3. |
| ADR-06 | **Tiempo real**: Socket.IO (WebSocket con fallback) para El Parche; polling corto como modo degradado. El servidor es autoritativo. | Instrucciones §2; Guía Técnica §8. |
| ADR-07 | **Monorepo** pnpm + Turborepo: `apps/pwa`, `apps/console`, `apps/api`, `packages/*`. Contratos compartidos con **zod** → OpenAPI. | Guía Técnica §4.2 (módulos con límites claros). |
| ADR-08 | **Juegos como módulos** con manifiesto común + **Game SDK** (`postMessage` validado, iframe `sandbox`). Resultado validado en servidor. | Instrucciones §13.1; Guía Técnica §5.4. |
| ADR-09 | **CMS propio** (consola) con flujo de aprobación y versionado, en lugar de un headless genérico, porque las reglas (puntos, campañas, módulos, aprobaciones) son dominio propio. Contenido editorial rico puede delegarse a un headless más adelante. | Instrucciones §2, §9; Guía Técnica §5.11. |
| ADR-10 | **Parámetros nunca en constantes**: puntos, multiplicadores, duración de energía (45 min), nombre de la moneda ("Chupito"), estructura de URL del Smart Tag, geofencing on/off, límite Ruta B = reglas versionadas en BD. | Instrucciones §4.1, §4.2, §5, §6; Guía Técnica §18. |
| ADR-11 | **Infraestructura de referencia**: contenedores Docker; candidato Google Cloud (Cloud Run + Cloud SQL + Memorystore) por afinidad con Stitch/Google, **sujeto a aprobación de TI de ILC**. | Guía Técnica §4.3, §4.4. |

---

## 2. Estrategia de la capa visual (Stitch ⇄ código)

### 2.1 Proyecto Stitch existente
- Proyecto: **"Diseño PWA Intuitiva"** (`projects/3853668696389706038`), móvil, modo oscuro.
- Design system actual: **"Nocturnal Amber Phygital"** — Space Grotesk / Plus Jakarta Sans,
  ámbar `#F59E0B`, esmeralda `#10B981`, magenta `#EC4899`, fondos `#0D0F12`/`#161A20`, vidrio esmerilado.
- Aún **no tiene pantallas de app**; solo los dos documentos cargados.

### 2.2 Ajustes obligatorios al design system (DESIGN.md v2)
El DESIGN.md actual es una buena base nocturna, pero choca con las salvaguardas de las fuentes:

| En el DESIGN.md actual | Problema | Ajuste en v2 |
|---|---|---|
| "Authenticity stamp… confirm bottle legitimacy" | Guía Técnica §5.6 / §12.2: prohibido afirmar autenticidad absoluta. | Sello "Código reconocido" con 4 estados: reconocido / no reconocido / ya reclamado / requiere verificación. |
| Tono "Electric, celebratory", "Party Pass", "VIP" | Guía Gamificación §3.5: curioso, cálido, experto sin solemnidad, responsable. | Tono "descubrimiento" y "origen". Ruta A clara y transaccional; Ruta B narrativa. |
| Un solo tema oscuro | Ruta B, consola admin y uso diurno (off-premise) necesitan claro; accesibilidad §11. | Tema oscuro (on-premise) + claro, ambos AA mínimo. |
| Paleta fija | Guía Gamificación §22.1–22.2: cada marca (Ron Viejo de Caldas, Aguardiente Amarillo, Cristal…) con su capa. | **Capa funcional** (neutra, fija) + **capa de marca/campaña** (variables sobreescribibles desde CMS). Sin logos/tipos propietarios hasta tener el manual de marca de ILC. |
| — | Advertencias legales (Decreto 120/2010, §23 checklist). | Componente `LegalNotice` obligatorio en pantallas promocionales. |

### 2.3 Flujo de trabajo de diseño → código (repetible)
1. `design/DESIGN.md` (en repo) es la fuente de verdad visual → se sube a Stitch con `upload_design_md` / `update_design_system`.
2. Cada pantalla se genera en Stitch con un **prompt versionado** en `design/prompts/<pantalla>.md`.
3. Se exporta HTML → script `pnpm design:pull <screenId>` descarga HTML + screenshot a `design/stitch-exports/`.
4. Se traduce a **vista pura** `packages/ui/src/views/<Pantalla>View.tsx` (solo props, sin fetch, sin estado de negocio). Colores hex → tokens.
5. El contenedor `apps/pwa/src/features/<dominio>/<Pantalla>.tsx` inyecta datos y callbacks.
6. **Storybook** muestra cada vista con todos sus estados (cargando, vacío, error, éxito) → revisión de diseño sin backend.
7. Pruebas visuales (Playwright screenshot) detectan regresiones al re-exportar.

Resultado: un diseñador puede iterar en Stitch y el cambio entra tocando solo `views/` y tokens.

### 2.4 Inventario de pantallas a diseñar en Stitch

**PWA jugador (móvil, prioridad P0):**
1. Landing por QR — 4 variantes: código de producto, código de campaña, QR de sesión (Parche), QR de evento/experiencia (Ruta B).
2. Resultado de consulta de código (4 estados de verificación, sin "100 % auténtico").
3. Control de edad +18 (configurable por campaña) + aviso de privacidad + consentimientos separados (funcional / marketing).
4. Login progresivo: alias temporal → Google / Apple / OTP WhatsApp.
5. Selector de ruta: "Activar código y ver beneficios" (A) / "Explorar la ruta" (B).
6. Crear Parche (nombre de mesa, PIN/QR) · Unirse al Parche (PIN / escanear).
7. Sala del Parche: participantes (alias), marcador experiencial, energía/tiempo, marcador comercial **separado**.
8. Catálogo de juegos (Ruta A lista; Ruta B máx. 2 visibles).
9. Contenedor de juego (marco común + juego en iframe) y pantalla de resultado.
10. Billetera Puntos ILC (ledger con movimientos) · Progreso Ruta B (XP, insignias, coleccionables).
11. Catálogo de recompensas · Detalle y canje (condiciones y vigencia antes de confirmar).
12. Perfil: QR de usuario, referidos, datos, consentimientos, cerrar/eliminar cuenta.
13. Tarjeta social 1080×1920 (vista previa + compartir voluntario).
14. Estados globales: sin conexión, error recuperable, operación incierta ("verificando…").

**Consolas (escritorio/tablet, P0 mínimo → P1):**
15. Staff: mi QR, vincular botella a mesa, mis activaciones, incidencias.
16. Comercio (Dealer): perfil público, recompensas locales, dashboard B2B agregado (sin PII).
17. Admin Marca: campañas (estados y aprobaciones), reglas de puntos, recompensas/inventario, catálogo de juegos (+ instrucciones de integración), temas, segmentación.
18. SuperAdmin/TI: lotes de Smart Tags (import CSV/XLSX con vista previa), estructura de URL del Smart Tag, auditoría, seguridad.

---

## 3. Estructura del repositorio

```
ilcgamer/
├─ apps/
│  ├─ pwa/            # App del jugador (React+Vite+PWA). Rutas: /v/:token, /c/:code, /p/:pin, /e/:slug, /r/:ref
│  ├─ console/        # Consola Staff / Comercio / Admin Marca / SuperAdmin (React, RBAC)
│  └─ api/            # NestJS: módulos de dominio + WebSocket gateway
├─ packages/
│  ├─ design-tokens/  # DESIGN.md → tokens.json → CSS vars + preset Tailwind (+ temas por marca/campaña)
│  ├─ ui/             # Componentes base + views/ (vistas puras traducidas de Stitch) + Storybook
│  ├─ contracts/      # Esquemas zod compartidos, tipos y OpenAPI; esquemas de eventos analíticos
│  ├─ game-sdk/       # SDK para juegos (bridge postMessage) + manifiesto de módulo (JSON Schema)
│  └─ config/         # eslint, tsconfig, prettier compartidos
├─ games/             # Juegos propios: trivia, ruleta, charadas, verdad-o-reto (Ruta A); explorador (Ruta B)
├─ design/            # DESIGN.md, prompts de Stitch, exports y screenshots de referencia
├─ docs/              # Este plan, ADRs, guía de integración de juegos, OpenAPI generado
└─ infra/             # docker-compose (dev), Dockerfiles, IaC (cuando TI apruebe proveedor)
```

---

## 4. Módulos de backend (monolito modular, Guía Técnica §4.2)

| Módulo | Responsabilidad | Entidades (§6) |
|---|---|---|
| `identity` | Auth progresiva (alias → Google/Apple/OTP), roles, edad, consentimientos, borrado | User, IdentityCredential, ConsentRecord |
| `campaigns` | Campañas y versiones, estados `BORRADOR→…→ARCHIVADA`, segmentación, temas, aprobaciones | Campaign, CampaignVersion, ApprovalRecord |
| `modules` | Catálogo de juegos, manifiestos, versiones, regla máx. 2 Ruta B | Module, ModuleVersion |
| `missions` | Start/complete, validación de resultado en servidor, XP e insignias | MissionProgress, Badge, XPEntry |
| `sessions` | El Parche: PIN/QR firmados, estados, expiración, reconexión, gateway WS | Session, SessionParticipant |
| `product-codes` | Smart Tags de consulta, lotes, eventos, anomalías, import CSV/XLSX, plantilla de URL configurable | ProductCode, ProductCodeEvent |
| `claims` | Códigos de campaña, reclamación atómica e idempotente | CampaignCode, Claim |
| `ledger` | Movimientos inmutables de Puntos ILC, reversos, saldos derivados | LedgerAccount, LedgerEntry |
| `rewards` | Catálogo, inventario por zona, reserva→canje→entrega | Reward, RewardInventory, RewardClaim |
| `venues` | Comercios, staff, asignaciones, dashboards B2B agregados | Venue, StaffAccount, VenueCampaign |
| `referrals` | Enlace `/r/{code}`, código corto, QR, doble bucle, topes | Referral |
| `share` | Generación de tarjetas 1080×1920 (servidor) | — |
| `analytics` | Eventos versionados §10.1, tableros separados A / B / operación | AnalyticsEvent |
| `audit` | Bitácora de acciones sensibles y señales antifraude | AuditEvent, SecurityEvent |
| `integrations` | `POST /api/v1/smarttags/validate` (Instrucciones §10), webhooks firmados | — |

---

## 5. Plan paso a paso (iteraciones)

Cada paso termina con: código + pruebas + demo navegable + commit. No se avanza con pruebas rojas.

### Paso 0 — Planeación y cimientos *(este paso)*
- [x] Análisis de las tres fuentes y del proyecto Stitch existente.
- [x] Plan maestro y ADRs.
- [ ] Confirmar decisiones abiertas (§7) con el equipo.

### Paso 1 — Sistema de diseño (capa visual base)
- Redactar `design/DESIGN.md` v2 (ajustes §2.2) y subirlo a Stitch.
- `packages/design-tokens`: parser DESIGN.md → CSS variables + preset Tailwind; tema oscuro/claro; mecanismo de tema por campaña en runtime.
- `packages/ui`: primitivas (Button, Card/GlassCard, Input, Chip, Badge de verificación, Sheet, Toast, LegalNotice, PinInput, QRFrame) + Storybook.
- **Entregable:** Storybook publicado con el design system aplicado.

### Paso 2 — Diseño de pantallas P0 en Stitch
- Generar en Stitch las pantallas 1–14 con prompts versionados; iterar variantes con el equipo.
- Exportar y traducir a `views/` puras con estados en Storybook.
- **Entregable:** prototipo navegable de la PWA (datos simulados) — equivale a la Fase 1 de la Guía Técnica.

### Paso 3 — Esqueleto técnico
- Monorepo, CI (lint, typecheck, test, build), docker-compose (Postgres + Redis), NestJS base, Prisma, OpenAPI, entornos dev/staging/prod, gestión de secretos.

### Paso 4 — Identidad, edad y consentimientos
- Alias temporal, Google/Apple/OTP (proveedor por definir), age gate configurable por campaña, ConsentRecord, flujos de derechos.

### Paso 5 — Campañas + CMS mínimo con aprobaciones
- CRUD de campañas versionadas, estados, aprobaciones (marca/jurídica/privacidad), bloqueo de publicación, temas por campaña.

### Paso 6 — Smart Tags y claims (Ruta A núcleo)
- Consulta de código (estados de producto) **separada** de reclamación de campaña; plantilla de URL configurable; rate limiting; import CSV/XLSX con vista previa; `POST /api/v1/smarttags/validate`.
- Pruebas de concurrencia: dos claims simultáneos ⇒ una sola emisión.

### Paso 7 — Ledger y economía dual
- Puntos ILC (300/500 como **parámetros de prueba**, nombre de moneda configurable) e XP/insignias separados; multiplicadores; idempotencia; reversos auditados.

### Paso 8 — El Parche en tiempo real
- Crear/unirse por PIN/QR, energía configurable (45 min por defecto de prueba), expiración (6:00 a. m. configurable), reconexión sin duplicar, marcador experiencial vs comercial.

### Paso 9 — Motor de juegos + juegos iniciales
- Manifiesto + Game SDK + contenedor iframe sandbox; validación de resultados en servidor.
- Ruta A: **Trivia** y **Ruleta** (luego Charadas, Verdad o reto con contenido revisado).
- Ruta B: **El Explorador / Ruta del Origen** (capítulos, XP, insignias); regla máx. 2 por usuario/contexto.
- Documento `docs/INTEGRACION_JUEGOS.md` visible también en la consola (Instrucciones §13.1).

### Paso 10 — Recompensas e inventario
- Catálogo, reserva atómica, canje, entrega, alertas de stock bajo.

### Paso 11 — Consolas Staff, Comercio y Admin
- Staff: vincular botella a mesa, metas; Comercio: perfil, beneficios locales, dashboard agregado; Admin: reglas de puntos, recompensas, juegos, segmentación, lotes.

### Paso 12 — Referidos, tarjetas sociales y analítica
- `/r/{code}`, QR de usuario, topes; tarjetas 1080×1920; eventos §10.1 y tableros separados A/B/operación.

### Paso 13 — Endurecimiento y piloto
- Pruebas E2E (QR → edad → ruta → juego → saldo → canje), seguridad/abuso, accesibilidad, compatibilidad iOS/Android, backups, observabilidad, checklist de campaña §16.

**Orden de valor:** pasos 1–2 dan un prototipo visual navegable rápido para validar con ILC;
pasos 3–8 son el MVP P0; 9–12 completan P0/P1; 13 prepara el piloto controlado.

---

## 6. Salvaguardas que el código hará cumplir (no negociables)

1. Nunca mostrar "Producto 100 % auténtico"; usar estados de verificación reales.
2. Consultar un código de producto **no** reclama un beneficio.
3. Ruta B nunca exige compra, escaneo ni marketing opt-in.
4. XP ≠ Puntos ILC salvo regla mixta aprobada y versionada.
5. Sin retos ni recompensas por velocidad de ingesta, cantidad, tolerancia o presión grupal.
6. El cliente nunca otorga puntos; todo efecto económico es idempotente, atómico y auditado.
7. GPS, fingerprinting y contactos desactivados por defecto; solo con finalidad, consentimiento y alternativa.
8. Sin PII en pantallas compartidas del Parche ni en tarjetas sociales.
9. Publicación de campañas bloqueada sin aprobaciones completas.

---

## 7. Decisiones abiertas (necesarias para avanzar sin supuestos)

| Decisión | Por qué importa | Propuesta por defecto mientras se decide |
|---|---|---|
| Marca del piloto (corporativa ILC vs una marca: p. ej. Ron Viejo de Caldas) | Define capa de marca del diseño | Diseño neutro "ILC" con slot de tema por marca |
| Manual de marca / assets oficiales | Logos, tipografías y paleta reales | Placeholders y tipografías libres (Space Grotesk / Plus Jakarta Sans) |
| Proveedor de OTP WhatsApp y nube | Coste y cumplimiento | Mock en dev; Google Cloud propuesto |
| Dominio oficial de QR (`ilc.app` u otro) | URLs de Smart Tag y deep links | Configurable desde consola |
| Mecanismo de verificación +18 | Riesgo legal | Autodeclaración + fecha de nacimiento, configurable por campaña |
| Valores de puntos y equivalencia en COP | Finanzas/Jurídica | 300/500 y 100 pts ≈ $1.000 como datos de prueba, desactivados en prod |

---

## 8. Seguridad del proyecto

- La API key de Stitch **no** se versiona. Se define como variable de entorno `STITCH_API_KEY`;
  `.mcp.json` la referencia por expansión de variables.
- El repositorio es público: no subir documentos del cliente, datos reales, tokens ni secretos.
