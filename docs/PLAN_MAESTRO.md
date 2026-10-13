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
| ADR-02 | **Tailwind CSS v4 + tokens CSS variables** (`@theme` generado desde DESIGN.md con los mismos nombres de clase que usa Stitch). Stitch exporta HTML+Tailwind → la traducción a componentes es directa y fiel. | Requisito del usuario: capa visual modificable; Guía Gamificación §22.2 (design system común + capa editorial por marca). |
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

### Paso 1 — Sistema de diseño (capa visual base) *(en curso)*
- [x] `design/DESIGN.md` v2 **"ILC Origen"** (ajustes §2.2, colores de ilc.com.co) subido a Stitch como design system.
- [x] Titulares en EB Garamond (la API de Stitch rechaza Playfair Display) y lectura en Plus Jakarta Sans.
- [x] `packages/design-tokens`: DESIGN.md + themes.yaml → `theme.css` Tailwind v4; tema oscuro/claro; 4 submarcas; puerta WCAG AA en build.
- [x] `packages/ui`: Button, SealMark, BrandChip, VerificationSeal (4 estados), RouteCard, LegalNotice, Checkbox, DateOfBirthInput, `applyCampaignTheme` + Storybook con selector de tema/submarca.
- [x] Pantallas 01 (edad) y 02 (landing de código) diseñadas en Stitch, corregidas y traducidas a vistas puras con pruebas.
- [x] PinInput, TextField, SegmentedControl, TopBar, Sheet (dialog nativo), Toast, StatusMessage (vacío/error/sin conexión/verificando), OfflineBanner, BottomNav, QrScannerFrame.
- [x] Componentes del Parche: EnergyMeter, ScoreCard (XP y Puntos ILC separados), ParticipantList (solo alias), InviteCard.
- [x] Auditoría axe WCAG 2.1 AA de todas las historias en ambos temas (`tools/a11y_audit.cjs`): sin violaciones.
- **Entregable:** Storybook con el design system aplicado. ✅

### Paso 2 — Diseño de pantallas P0 de la PWA en Stitch ✅
- [x] 01 Control de edad · 02 Landing de código · 03 Crear Parche · 04 Unirse (PIN/QR) · 05 Sala del Parche.
- [x] 06 Catálogo de juegos (Ruta B máx. 2) · 07 Resultado verificado · 08 Billetera (ledger) · 09 Progreso Ruta B · 10 Recompensas y canje · 11 Perfil/referidos · 12 Tarjeta social · 13 Login progresivo/consentimientos.
- [x] Todas revisadas contra las guías, corregidas en Stitch, traducidas a vistas puras con historias, pruebas y auditoría axe (72/72 sin violaciones).
- [ ] Pendiente para la fase de consolas (Paso 11): pantallas de Staff, Comercio, Admin Marca y SuperAdmin (escritorio/tablet).
- [ ] Pendiente: contenedor de juego (marco común del iframe), se diseña junto con el Game SDK (Paso 9).

### Paso 2 (detalle original)
- Generar en Stitch las pantallas 1–14 con prompts versionados; iterar variantes con el equipo.
- Exportar y traducir a `views/` puras con estados en Storybook.
- **Entregable:** prototipo navegable de la PWA (datos simulados) — equivale a la Fase 1 de la Guía Técnica.

### Paso 3 — Esqueleto técnico ✅
- [x] `@ilc/contracts`: estados de dominio, códigos de error estables, cabeceras (Idempotency-Key, X-Request-Id), OpenAPI desde zod.
- [x] `apps/api`: NestJS 12 + Fastify, configuración validada (falla temprano), Helmet/CSP, CORS por lista, rate limit, request-id, logs redactados, errores ApiError, guarda de idempotencia, `/api/v1/health`, OpenAPI + Swagger (no prod).
- [x] Modelo de datos completo §6 en Prisma 7 + migración de **integridad en BD**: ledger inmutable (triggers), signo por tipo, reversos con referencia y motivo, saldo y stock ≥ 0, claim único por código (concurrencia), PIN único entre sesiones activas, consentimientos append-only, edad mínima ≥ 18.
- [x] `apps/pwa`: React Router, entradas QR diferenciadas (/v, /c, /p, /e, /r), guarda de edad, 13 contenedores sobre las vistas de Stitch, cliente API con idempotencia/timeout/errores tipados, manifest + service worker (API nunca desde caché), modo demostración visible.
- [x] Biome, docker-compose, CI en GitHub Actions (lint, build, migraciones, tipos, pruebas con Postgres/Redis, Storybook, axe), `docs/ENTORNOS.md`.
- [ ] Pendiente de TI: proveedor de nube, dominio oficial, gestor de secretos y pipeline de despliegue (staging/producción).
- [ ] Mejora: dividir el bundle de la PWA por rutas (148 KB gzip hoy).

### Paso 4 — Identidad, edad y consentimientos ✅
- [x] Control de edad en servidor: calcula la edad en hora de Colombia y **descarta la fecha** (solo guarda resultado y método); edad mínima configurable por plataforma y por campaña (≥ 18); un menor no genera cuenta ni registro.
- [x] Cuenta TEMPORAL con alias y sesión por cookie opaca (HttpOnly, SameSite=Lax, Secure/`__Host-` fuera de desarrollo), revocable; protección CSRF por origen.
- [x] Consentimientos por finalidad (términos, marketing, ubicación), append-only, con versión del aviso y origen; marketing siempre desmarcado por defecto; aceptar términos exige la versión vigente.
- [x] Acceso por código (WhatsApp/SMS/correo) con proveedor intercambiable: códigos y destinos como HMAC en Redis, vencimiento 5 min, reenvío 60 s, 5 envíos/h, 5 intentos; número enmascarado; mismo número en otro dispositivo = misma cuenta.
- [x] Google/Apple preparados y marcados "Próximamente" hasta tener credenciales de ILC.
- [x] Eliminar cuenta: borra PII y credenciales, revoca todas las sesiones, anonimiza y conserva solo evidencia legal (consentimientos, auditoría).
- [x] Pantallas 14 (código) y 15 (autorizaciones) diseñadas en Stitch y conectadas; PWA conectada a la API real (verificado en Chromium de punta a punta).
- [ ] Pendiente de ILC: proveedor de WhatsApp/SMS/correo y credenciales de Google/Apple; texto legal de términos y aviso de privacidad.
- [ ] Paso 7: fusionar el progreso de una cuenta temporal al iniciar sesión en una cuenta existente (hoy queda registrado en auditoría).

### Paso 5 — Campañas + CMS mínimo con aprobaciones ✅
- [x] Campañas con versiones de reglas: estados de versión (borrador → en revisión → aprobada → publicada → reemplazada) y de campaña (borrador → … → activa/pausada → cerrada → archivada). Una sola versión publicada y una sola en curso por campaña (índices únicos en la base de datos).
- [x] Reglas en esquema **cerrado** y acotado (puntos por SKU, multiplicadores ≤ x3, energía 5–240 min, cierre de sesiones, vigencia de puntos, límites por persona): no existe forma de configurar premios por velocidad, cantidad o presión (§1.2, §9.4).
- [x] Aprobaciones de Marca, Jurídica y (si hay ubicación o datos extra) Privacidad, ligadas al **hash del contenido**: cualquier cambio invalida las aprobaciones. Separación de funciones: quien crea o envía no aprueba. Un rechazo devuelve la versión a borrador.
- [x] Publicación bloqueada mientras falte una aprobación o un punto del checklist §16; la API y la consola dicen exactamente qué falta. Programador con candado en Redis activa y cierra campañas por fecha.
- [x] RBAC (`ADMIN_MARCA`, `EDITOR_CONTENIDO`, revisores, `RESPONSABLE_PRIVACIDAD`, `SUPERADMIN`) y CLI `admin:grant` para asignar roles; todo queda en auditoría.
- [x] Temas por campaña (solo variables `--color-brand-*`); la PWA consulta `GET /campaigns/:slug` en `/e/:slug`, aplica el tema y envía la campaña al control de edad (edad mínima por campaña).
- [x] Consola mínima `apps/console` (ingreso por código al correo, lista, editor, detalle con aprobaciones, checklist, publicación y operación). Pantallas 16 y 17 diseñadas en Stitch.
- [ ] Pendiente para el Paso 6/7: re-verificar la edad cuando una campaña exige más de 18 y la persona ya pasó el control con 18 (hoy el servidor la aplica en el control de edad de entrada).

### Paso 6 — Smart Tags y claims (Ruta A núcleo) ✅
- [x] Dos dominios separados (§5.6): `GET /product-codes/{token}/status` (consultar no consume nada; cada consulta es un evento) y `POST /campaign-codes/{token}/claim`. Mensajes precisos ("Código reconocido", "Este código ya registra una reclamación", "Requiere verificación adicional"), nunca "100 % auténtico".
- [x] Tokens Crockford de 12 caracteres (60 bits); la base guarda SHA-256 y los últimos 4. Logs y exportaciones enmascaran el token (también en la URL registrada).
- [x] Reclamación atómica e idempotente: actualización condicional + índice único parcial + clave de idempotencia + candado por persona para límites diarios/totales. Probado: 8 solicitudes simultáneas ⇒ 1 claim y 1 movimiento; doble toque con la misma clave ⇒ misma respuesta.
- [x] Emisión en el ledger en la misma transacción (puntos por SKU × mayor multiplicador vigente, vencimiento según la campaña). Condiciones visibles antes de confirmar; reintento seguro con la misma clave.
- [x] Elegibilidad en servidor: campaña activa y en ventana, cuenta guardada, código vigente, lote no revocado, edad mínima de la campaña (pide confirmar de nuevo si la campaña es +21 — cierra el pendiente del Paso 5).
- [x] Antifraude proporcional (§9.2): límite por IP, freno a la enumeración, alerta de anomalía por consultas por hora (sin bloquear personas), revocación de lotes, eventos de seguridad.
- [x] Consola Smart Tags (pantalla 18 de Stitch): productos, lotes (vincular a promoción, distribuir, revocar, exportar auditoría sin PII ni GPS), generación masiva, importación CSV/XLSX con vista previa, archivo repetido bloqueado y errores descargables, plantilla de URL editable.
- [x] `POST /smarttags/validate` para el ERP con clave de integración (solo hash en la configuración).
- [x] PWA: landing de código real, activación con condiciones, regreso al código tras guardar la cuenta. Verificado de punta a punta en Chromium.
- [ ] Pendiente (TI/Producción): cifrado del archivo de imprenta en tránsito (p. ej. PGP), webhooks de trazabilidad con el ERP, y el mecanismo anti-anaquel definitivo (QR rotativo de establecimiento o vinculación por staff — Pasos 8 y 11). Mientras tanto, la activación depende de la campaña y sus límites.

### Paso 7 — Ledger y economía dual ✅
- [x] `GET /wallet` (saldo, movimientos paginados, aviso de próximo vencimiento) y `GET /profile/progress` (XP, nivel, insignias).
- [x] Vencimientos: se vence solo lo que queda sin usar de cada crédito (asignación FIFO por vencimiento), una sola vez, con movimiento compensatorio. Programador cada 10 min con candado en Redis.
- [x] Reversos auditados desde la consola: motivo obligatorio, ligado al original, uno por crédito, nadie reversa su propia cuenta; el titular ve el reverso pero no el motivo interno.
- [x] Conciliación horaria saldo en caché vs. suma del ledger; diferencia ⇒ evento de seguridad ALTA.
- [x] XP, niveles (umbrales configurables) e insignias idempotentes; la XP nunca toca los Puntos ILC. Solo una campaña MIXTA puede otorgar XP por activación (regla versionada y aprobada).
- [x] Consola "Economía" (pantalla 19 de Stitch): movimientos, reversos, catálogo de insignias y conciliación. PWA con billetera y progreso reales.
- [x] Auditoría axe: 118 combinaciones sin violaciones WCAG AA. Verificado de punta a punta en Chromium: activación → billetera con aviso de vencimiento → reverso desde la consola por id de reclamación → el titular ve el reverso sin el motivo interno; conciliación sin diferencias.

### Paso 8 — El Parche en tiempo real ✅
- [x] `POST /sessions`, `POST /sessions/join` (PIN), `POST /sessions/{id}/join` (QR firmado), `GET /sessions/{id}`, `POST …/leave`, `POST …/close` y canal en vivo `GET …/events`.
- [x] Nace de una activación propia (Ruta A), del QR de un evento o como Parche libre de Ruta B; modo un solo celular con jugadores locales sin cuenta. Energía y cierre vienen de la campaña (por defecto 45 min y 6:00 a. m. hora de Colombia); expira también por inactividad. Los tres relojes (sesión, puntos, código) siguen separados.
- [x] PIN de 4 dígitos protegido: HMAC en la base, intentos limitados por persona e IP con bloqueo temporal y evento de seguridad; el QR es una invitación firmada válida solo para esa sesión y mientras viva.
- [x] Tiempo real con **Server-Sent Events** + Redis pub/sub (decisión: más simple que Socket.IO para un canal servidor→cliente, sin dependencia nueva; el cliente actúa por HTTP). Autorización por sesión, heartbeat, versión creciente, reconexión automática que recupera el estado vigente sin duplicar, presencia conectado/reconectando, cierre del canal al terminar y respaldo por consulta cada 5 s.
- [x] Una activación de botella dentro del Parche recarga un bloque de energía; los Puntos ILC van a la billetera de quien activa (el Parche no tiene saldo comercial propio). El marcador del reto es aparte.
- [x] Solo alias en pantallas compartidas; una persona en un solo Parche a la vez; si sale el anfitrión el grupo sigue con otro.
- [x] Verificado: 229 pruebas, axe 118 combinaciones sin violaciones, y E2E con dos celulares (PIN erróneo, unión, Bea visible para Ana en vivo, QR, reconexión, cierre visto en vivo).
- [ ] Pendiente: el "marcador del reto" se alimenta con el motor de juegos (Paso 9); la lectura de QR con cámara usa BarcodeDetector (si el navegador no lo ofrece, se usa la cámara nativa o el PIN).

### Paso 9 — Motor de juegos + juegos iniciales ✅
- [x] **Manifiesto cerrado** por módulo/versión (`packages/contracts/src/games.ts`): ruta, entrega (`engine` o `iframe`), topes de puntuación, permisos, política de datos, accesibilidad. Reglas imposibles de saltar por esquema: un juego de Ruta A no puede dar XP; ningún juego emite Puntos ILC.
- [x] **Ciclo de vida con gobierno**: registrar (TI) → probar (Admin de Marca) → aprobar Marca + Jurídica (+ Privacidad si recoge datos, rastrea o pide permisos) ligado al hash exacto del manifiesto y con separación de funciones → activar / desactivar con motivo / volver a una versión anterior. Una sola versión activa por módulo. Todo en auditoría.
- [x] **Motores propios** (el servidor decide y nunca envía la respuesta correcta): Trivia y Ruleta (Ruta A, suman al marcador del Parche) y El Explorador por capítulos (Ruta B: XP una sola vez por capítulo e insignia al terminar). Tope de **2 experiencias de Ruta B por persona y contexto** (campaña o Parche); sin campaña se usan los juegos por defecto de la plataforma.
- [x] **Misiones**: inicio idempotente, una abierta por persona y módulo, tope de partidas por día, modo prueba para el equipo editorial que no otorga nada, resultado verificado en servidor.
- [x] **Game SDK** (`@ilc/game-sdk`, 1.2 KB): protocolo `postMessage` validado por ventana y origen, con límite de ritmo, nunca `"*"`. Contenedor `iframe` con `sandbox="allow-scripts allow-same-origin"`, `allow` solo con permisos aprobados, referrer de solo origen, HTTPS y origen distinto al de la app. El navegador nunca informa puntajes: el servidor del proveedor confirma con **callback firmado** (HMAC-SHA256 del JSON canónico, ventana de ±5 min, un solo uso, topes del manifiesto; secreto derivado por módulo y rotable).
- [x] **Guía `docs/INTEGRACION_JUEGOS.md`** (agregar, modificar, probar, activar, revertir; requisitos de compatibilidad), visible en la consola en *Juegos → Guía de integración*; ejemplos de manifiestos y un módulo iframe de muestra en `games/ejemplos/`.
- [x] **UI** (Stitch 20–23): Trivia, Ruleta, Explorador por capítulos, resultado verificado, catálogo real por contexto de campaña/Parche; consola *Juegos* (catálogo, aprobaciones, activar/desactivar/volver, juegos por defecto, secreto del proveedor, registrar con errores por campo) y sección *Juegos* en el editor de campañas (máx. 2 de Ruta B). Una campaña no se publica si algún juego suyo no está activo.
- [x] Verificado: 281 pruebas (API 142 contra PostgreSQL), axe 142 combinaciones sin violaciones WCAG AA, y E2E en Chromium con la API real: catálogo → Trivia → Ruleta → Explorador (reintento sin penalidad, XP e insignia) → módulo de proveedor en otro origen HTTPS (handshake, "verificando", firma falsa rechazada, callback firmado → "verificado") y consola con la guía y errores de manifiesto.
- [ ] Pendiente: Charadas y Verdad o reto cultural (requieren contenido revisado por Marca y Jurídica); contenido real de marca para Trivia y Explorador (hoy hay solo contenido de **prueba**); TI debe permitir el origen de cada proveedor en `frame-src` de la CSP al activarlo.

### Paso 10 — Recompensas e inventario ✅
- [x] `GET /rewards` (catálogo vigente con stock por zona y saldo), `POST /rewards/{id}/claim` (con `Idempotency-Key`) y `GET /rewards/claims` (mis canjes con código de entrega).
- [x] **Canje atómico**: stock, saldo, débito en el ledger y canje se confirman en UNA transacción bajo el candado por persona; sin stock o sin saldo no queda nada a medias. Mismo `Idempotency-Key` ⇒ mismo canje (también con doble toque en paralelo). Probado con 8 personas por 3 unidades: salen exactamente 3.
- [x] Reglas: recompensa activa y dentro de fechas, campaña activa si está ligada a una, límite por persona (las anuladas y vencidas no cuentan), cuenta con progreso guardado, zona con existencias.
- [x] Estados `RESERVADO → ENTREGADO` (lo digital y los contenidos se entregan al canjear; lo material y las experiencias se retiran con un **código de entrega**); alternos `EXPIRADO` y `ANULADO`.
- [x] **Vencimiento de reservas** (14 días configurables, programador cada 10 min con candado en Redis): devuelve stock y puntos con un movimiento compensatorio (reverso ligado al débito original). Anular desde la consola hace lo mismo, con motivo obligatorio y sin poder anular el propio canje.
- [x] Consola **Recompensas** (Stitch 24): catálogo con stock por zona y estado (con stock / bajo / agotada), crear (nace inactiva; **quien la crea no puede activarla**), activar y desactivar con motivo, ajuste de stock con motivo (nunca negativo), canjes con filtro, **entrega por código** (una sola vez, antes de vencer, no a uno mismo) y anulación. Alerta `reward.low_stock` en auditoría al cruzar el umbral, una vez por cruce. Solo Admin de Marca y TI.
- [x] PWA: recompensas reales con elección de zona, hoja de confirmación con condiciones, código de entrega al instante y **Mis canjes** (Stitch 25) con fecha límite, copiar código y aviso de devolución de puntos.
- [x] Verificado: 296 pruebas (API 157 contra PostgreSQL), axe 152 combinaciones sin violaciones, y E2E en Chromium con la API real: canje (1.000 → 700 puntos) → código → Mis canjes → segundo canje rechazado por límite → la consola entrega por código → doble entrega rechazada → la persona ve «Entregado».
- [ ] Pendiente: el rol de Staff/Comercio para entregar desde el punto de venta llega en el Paso 11 (hoy entrega Admin de Marca/TI); contenido y precios reales de recompensas y su operación logística (stock físico, responsables, términos) los define ILC antes de activar el catálogo; los puntos devueltos por un canje vencido o anulado no vuelven a vencer (decisión simple a confirmar con Marca).

### Paso 11 — Consolas Staff, Comercio y Admin ✅
- [x] **Establecimientos** (`/admin/venues`, solo Marca y TI): registrar (nace pendiente), aprobar, suspender con motivo (sale del directorio y deja de operar), vincular campañas y agregar o retirar personal **por correo** (la persona debe haber ingresado antes). Todo en auditoría.
- [x] **Staff**: código individual de 8 caracteres y QR que abre la PWA en `/s/{código}`; la persona lo escanea en la mesa y su próxima activación queda vinculada (`staffCode` opcional en la reclamación). Un código inválido, de un local sin aprobar o el propio **no bloquea** la activación ni acredita a nadie; dentro de un Parche, este hereda el establecimiento. Panel `GET /staff/me`: botellas vinculadas hoy y esta semana, avance hacia una meta configurable y últimas vinculaciones, **sin datos de las personas**.
- [x] **Comercio (Dealer)**: panel `GET /dealer/me` solo de su establecimiento y en agregado (hoy, semana, mes, últimos 14 días en hora de Colombia, campañas activas, y **solo su propia posición** entre los locales de su ciudad, nunca nombres de otros); perfil público (descripción, horarios, dirección) y directorio `GET /venues` de locales aprobados que decidieron aparecer.
- [x] **Entrega de recompensas desde el local**: Staff y Comercio entregan contra el código solo canjes de **su ciudad** y con el local aprobado; queda el establecimiento en auditoría (cierra el pendiente del Paso 10).
- [x] **Consola por rol**: Admin de Marca/TI ven *Comercios* junto a lo anterior; Staff y Comercio entran a la misma consola pero solo ven su propia sección (*Mi actividad* / *Mi establecimiento*). Lo de Admin que pide el plan ya vive en: reglas de puntos y segmentación en *Campañas*, *Juegos*, *Recompensas* y lotes en *Smart Tags*.
- [x] Diseño: Stitch 26 (Comercios), 27 (Staff) y 28 (Comercio).
- [x] Verificado: 330 pruebas (API 166 contra PostgreSQL), axe 164 combinaciones sin violaciones, y E2E en Chromium con la API real: Staff ve su código y QR sin acceso a otras secciones; Comercio ve su posición, entrega un canje de su ciudad (el segundo intento se rechaza) y publica su perfil; el QR del Staff abre la PWA y recuerda el código.
- [ ] Pendiente / por decidir con ILC: **incentivos económicos del Staff** (bonos, saldos digitales) y **notas crédito o patrocinios** del Comercio dependen de contratos, definición contable, topes y revisión jurídica (Guía Técnica §5.9); por eso el panel no calcula ni promete dinero. El **ranking competitivo con nombres** que menciona el documento fuente choca con "solo ve su establecimiento": se dejó solo la posición propia. Mapa del directorio (geolocalización) y pantalla pública del directorio en la PWA quedan para después. Los *beneficios locales* propios del comercio (picadas, promociones) requieren un flujo de aprobación editorial aparte.

### Paso 12 — Referidos, tarjetas sociales y analítica ✅
- [x] **Referidos**: cada persona tiene un código estable de 8 caracteres, enlace `/r/{código}` y QR en su perfil (`GET /referrals/me`). Al guardar la cuenta la PWA atribuye el código una sola vez (`POST /referrals/attribute`): nunca el propio, nunca dos veces, solo con cuenta guardada y dentro de una ventana (7 días por defecto); un código desconocido se ignora sin revelar si existe. Sin lectura de agenda, sin mensajes automáticos y **sin huella de dispositivo** (la Guía Técnica pide no activarla por defecto).
- [x] **Bonificación apagada por defecto** y configurable por Marca/TI en *Analítica → Referidos* (con auditoría): Puntos ILC al referente por la **primera activación válida** del invitado (Ruta A) y/o XP por su **primera misión verificada** (Ruta B); economías separadas, nunca se convierten. Topes por día y por semana para quien invita; lo que excede se registra como `referral_capped`. La regla se muestra en el perfil con sus topes, tal como aplica.
- [x] **Tarjeta social 1080 × 1920**: se genera en el dispositivo (canvas) y se comparte con la hoja nativa o se guarda; contenido solo de logro cultural, sin cifras, nombre, ubicación ni presión (con prueba). *Decisión*: el documento dice que la imagen final la genera el servidor; se hizo en el cliente para no mandar datos ni agregar dependencias nativas, con el mismo contenido que la vista previa.
- [x] **Eventos versionados** (§10.1): registro central con las propiedades permitidas por evento (lo demás se descarta al guardar, así no puede entrar PII); se emiten `age_gate_result_recorded`, `consent_updated`, `product_code_status_checked`, `campaign_code_claimed`, `commercial_points_credited/reversed`, `staff_activation_recorded`, `mission_started/completed`, `badge_awarded`, `session_created/joined/closed`, `reward_claimed` y los de referidos. La PWA informa `campaign_viewed`, `reward_viewed`, `share_card_generated` y `share_link_opened` por `POST /events` (lista blanca, validada por esquema, con límite de ritmo, sin efecto económico).
- [x] **Tableros separados** (`GET /admin/analytics`, solo Marca y TI, 7/30/90 días, solo agregados): *Ruta A* (activaciones, puntos, reversos, canjes, por SKU y campaña), *Ruta B* (misiones iniciadas y completadas, finalización, XP, insignias, Parches, por juego), *Operación* (consultas y códigos no reconocidos, incidentes, controles de edad, autorizaciones, stock bajo, juegos por aprobar) y *Ejecutiva* con ambos lado a lado **sin una puntuación única**. Diseño: Stitch 29.
- [x] Verificado: 351 pruebas (API 178 contra PostgreSQL), axe 174 combinaciones sin violaciones, y E2E en Chromium con la API real: perfil con código real, tarjeta descargada de 1080×1920, una persona nueva llega por `/r/{código}`, pasa el control de edad, guarda su cuenta y queda atribuida; la consola muestra los tableros y guarda las reglas; el perfil muestra entonces la regla con sus topes.
- [ ] Pendiente / por decidir con ILC: **presupuesto, términos y topes reales** de la bonificación (siguen apagados); el *saldo de bienvenida* del referido que menciona el documento fuente no se implementó (la guía lo ata a una misión o activación válida, y ya la recibe quien invita); tableros de **satisfacción, recuerdo de atributos, tiempo de carga y errores por dispositivo** (§10.2) requieren medición en el cliente y encuestas que ILC debe definir; exportes y mapas de calor por GPS requieren la decisión sobre ubicación y consentimiento.

### Paso 13 — Endurecimiento y piloto ✅ (parte técnica)
- [x] **Seguridad/abuso** (§12.1 suite 6): una prueba recorre **todas las rutas del contrato OpenAPI** y exige 401 sin sesión (salvo una lista pública explícita) y 403 para un jugador común en toda la consola y los paneles de Staff y Comercio; si aparece una ruta nueva sin protección, la prueba falla. Además: autorización horizontal (misiones, Parches), CSP y cookies, CSRF por origen, `__proto__`, resultado de juego manipulado, y **anti-enumeración de códigos de referido** (hallazgo de esta prueba: se agregó un tope de intentos por persona y un evento de seguridad).
- [x] **Dependencias**: `pnpm audit --prod` sin vulnerabilidades (se fijaron versiones parcheadas de `uuid`, `mysql2` y `deepmerge-ts` que llegaban por dependencias transitivas); `pnpm secrets` busca secretos versionados; ambos corren en CI. Se quitó del repositorio un volcado de Redis vacío que se había colado en un commit anterior.
- [x] **Observabilidad**: `GET /api/v1/metrics` (Prometheus, protegido por token y apagado por defecto) con solicitudes y duración por **ruta con plantilla**, salud, incidentes abiertos y reservas pendientes; alertas sugeridas en `docs/OPERACION.md`.
- [x] **Retención y minimización** (§9.3): proceso diario que depura analítica, incidentes resueltos, consultas de códigos y estado privado de misiones; nunca ledger, auditoría ni consentimientos. Inventario de datos en `docs/PILOTO.md`.
- [x] **Privacidad de las fuentes**: la PWA y la consola **autoaloja** sus fuentes e íconos (`tools/fonts_sync.py`): ya no se le revela la IP a Google, funciona sin conexión y la CSP queda estricta.
- [x] **Códigos de acceso en producción**: pasarela por *webhook* (`OTP_PROVIDER=webhook`) para el proveedor que ILC contrate; sin ella nadie puede iniciar sesión en producción.
- [x] **Despliegue** (`deploy/`, `docs/DESPLIEGUE.md`): Dockerfiles de API y web, Caddy con HTTPS automático, HSTS y CSP, Compose de producción (PostgreSQL y Redis sin puertos públicos, migraciones, copias), `.env.production.example`. *Verificado*: el Compose valida y el paquete de la API arranca y migra fuera de Docker; las imágenes no se construyeron aquí (sin demonio de Docker).
- [x] **Copias y recuperación**: `infra/backup/backup.sh` (rotación, suma de verificación, cifrado `age`) y `restore_check.sh` (restaura en una base temporal y verifica el saldo contra el ledger, stock, claims únicos y *triggers*). **Probado** con la base de desarrollo, con y sin cifrado.
- [x] **E2E de la ruta crítica versionado** (`pnpm e2e`, job en CI): QR de botella → control de edad → cuenta por código → activación → billetera → canje → misión de Ruta B sin Puntos ILC → entrega → doble entrega rechazada, en un celular Android emulado. **Carga de humo** (`pnpm loadtest`) con p95 ≤ 115 ms en los endpoints principales (referencia local).
- [x] Verificado: 372 pruebas (API 195 contra PostgreSQL), axe 174 combinaciones sin violaciones, E2E de ruta crítica en verde.
- [ ] **Pendiente (depende de ILC o de dispositivos reales)** — ver `docs/PILOTO.md`: proveedor de infraestructura y de códigos de acceso; aprobaciones y textos legales; contenido y premios reales; pruebas manuales en iOS y en navegadores integrados; dimensionar con tráfico real; prueba de penetración externa; construir y probar las imágenes de Docker en el servidor.

### Paso 14 — Eventos y concurso de disfraces ✅
Pedido del cliente: un espacio de **eventos** y, dentro, un **concurso de disfraces** con foto, votación, premio (p. ej. un palco para la feria) y una **pantalla** con las votaciones en vivo. Guía en `docs/EVENTOS_Y_CONCURSOS.md`.
- [x] **Modelo y reglas** (`packages/contracts/src/events.ts`, migración `20261013120000_eventos_y_concursos`): evento → concursos; fases por fecha calculadas en el servidor; **un voto por cuenta** (UNIQUE) y nunca por el propio disfraz; trigger en la base que impide votos a otro concurso, a inscripciones sin aprobar y la edición de votos; desempate determinista (más votos; si empatan, quien se inscribió primero).
- [x] **Fotos como dato personal**: autorización expresa para mostrarlas, **moderación previa** de Marca, solo JPEG, el servidor **quita EXIF/ubicación** (`apps/api/src/events/jpeg.ts`), se eliminan al cerrar la cuenta y 30 días después del concurso (`retention.contestPhotosDays`); norma visible: sin copas, botellas ni consumo de alcohol.
- [x] **Economías separadas**: participar y votar no da Puntos ILC ni XP (hay una prueba que lo verifica); el premio se entrega en persona con un **código del ganador** y queda auditado.
- [x] **Pantalla pública** `/pantalla/:token` (sin sesión; el acceso es un enlace secreto que la consola puede **rotar**): ranking en vivo con alias, título, foto aprobada y conteos, más un QR para votar; texto grande, siempre en tema oscuro.
- [x] **Consola** (sección Eventos): crear evento y concurso, abrir (otra persona distinta a quien lo creó), moderar con foto, copiar/rotar el enlace de la pantalla, cerrar y registrar la entrega del premio. **PWA**: Jugar → Eventos y concursos → inscribir, subir foto (el navegador la reduce a JPEG) y votar.
- [x] Verificado: 403 pruebas (API 213 contra PostgreSQL), axe 200 combinaciones sin violaciones, E2E en navegador real (`tools/e2e/contest.cjs`: inscripción con foto → moderación → voto → pantalla en vivo → rotar enlace).
- [ ] **Pendiente (ILC/Jurídica)**: texto legal de autorización de imagen y tratamiento de fotos, reglas y bases del concurso, y quién entrega el premio.

### Paso 15 — Juegos de fiesta (6 juegos del cliente, editables desde la consola) ✅
Pedido del cliente: montar seis juegos que ya existían como archivos HTML sueltos (Pico de Botella, Verdad o Reto, Cultura Chupística, Yo Nunca Nunca, El Frentazo, Mano de Cirujano) **sin dañar nada**, funcionando igual, y que cada uno tenga una parte en el admin para cambiar lo gráfico y los nombres. Guía en `docs/JUEGOS_DE_FIESTA.md`.
- [x] **Motor `party`** (`packages/contracts/src/party.ts`): juegos nativos de React (la CSP prohíbe iframes con scripts en línea) guiados por configuración validada con zod; una configuración = una versión del módulo, así que **cada cambio pasa por el flujo existente** (registrar → prueba → aprobación de Marca y Jurídica → activar). Sin puntuación, sin Puntos ILC ni XP; el servidor no recibe resultados.
- [x] **Regla de contenido compartida** (`partyTextIssue`): ningún texto puede incentivar ni penalizar con consumo de alcohol (shot, trago, fondo blanco, brindar, «toma un…»…). La valida la consola en vivo y el servidor al registrar.
- [x] **Adaptaciones al contenido original** (decisión de producto, ver `CLAUDE.md`): botella → flecha/aguja con colores y nombre editables; «Pico de Botella» → *Pico de Flecha*; «Cultura Chupística» → *Cultura Rumbera*; penitencias de «tomar/fondo blanco» → retos sin alcohol; `alert()` → diálogo accesible. Volver a las versiones originales exige una decisión explícita de ILC/TI.
- [x] **Consola → «Juegos de fiesta»**: lista, plantillas, editor con **vista previa jugable**, validación en vivo y guardado como siguiente versión (borrador). La puede usar TI (SUPERADMIN) y Marca; registrar otros motores sigue siendo solo de TI.
- [x] **Demo**: `seed-demo.ts` instala los 6 por el flujo de aprobaciones y los deja en el catálogo general.
- [x] Verificado: pruebas de contratos, API (216), vistas, PWA y consola; E2E en navegador (`tools/e2e/party.cjs`: instalación con aprobaciones, rechazo de texto con alcohol, versión personalizada y los 6 juegos jugados en un celular emulado).
- [ ] **Pendiente (ILC)**: validación jurídica del consentimiento obligatorio de El Impostor (ver docs/JUEGOS_DE_FIESTA.md), aprobar el contenido final de cada juego y decidir si se permite volver al texto original.

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
| ~~Marca del piloto~~ **Decidido:** ILC y todas sus submarcas | Define capa de marca del diseño | Capa funcional ILC + temas por submarca |
| Manual de marca / assets oficiales | Logos, tipografías y paleta reales | Referencia ilc.com.co (dorado #B89B5B, verde #2F4941, rojo #D01217); sello y fotos son marcadores |
| Proveedor de OTP WhatsApp y nube | Coste y cumplimiento | Mock en dev; Google Cloud propuesto |
| Dominio oficial de QR (`ilc.app` u otro) | URLs de Smart Tag y deep links | Configurable desde consola |
| Mecanismo de verificación +18 | Riesgo legal | Autodeclaración + fecha de nacimiento, configurable por campaña |
| Valores de puntos y equivalencia en COP | Finanzas/Jurídica | 300/500 y 100 pts ≈ $1.000 como datos de prueba, desactivados en prod |

---

## 8. Seguridad del proyecto

- La API key de Stitch **no** se versiona. Se define como variable de entorno `STITCH_API_KEY`;
  `.mcp.json` la referencia por expansión de variables.
- El repositorio es público: no subir documentos del cliente, datos reales, tokens ni secretos.
