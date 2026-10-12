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
- [ ] Pendiente de verificar: auditoría axe de las historias nuevas y prueba de punta a punta en navegador.

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
