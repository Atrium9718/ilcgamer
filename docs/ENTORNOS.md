# Entornos, configuración y operación

Fuente: Guía Técnica §4.4 (entornos), §7.1 (convenciones API), §9.1 (seguridad), §11 (no funcionales).

## Entornos

| Entorno | Para qué | Datos | Despliegue |
|---|---|---|---|
| **development** | Trabajo local de cada persona | `docker compose` (Postgres + Redis) y semilla `db:seed` | Manual |
| **test** | Pruebas automáticas (local y CI) | Base `ilc_test` efímera; las pruebas la vacían | CI en cada PR |
| **staging (QA)** | Validación con Marca/Jurídica/Producto antes de publicar | Datos de prueba; **nunca** códigos reales ni datos personales reales | Automático desde `main` *(pendiente de proveedor aprobado por TI)* |
| **production** | Usuarios reales | Datos reales; campañas solo con aprobaciones completas | Manual con aprobación *(pendiente)* |

Cada entorno tiene base de datos, Redis, secretos y dominio propios. Producción no se usa para probar códigos
ni campañas sin aprobación (§4.4).

## Variables

### API (`apps/api/.env.example`)

| Variable | Obligatoria | Notas |
|---|---|---|
| `NODE_ENV` | sí | `development` · `test` · `staging` · `production` |
| `DATABASE_URL` | sí | PostgreSQL. En prod: usuario con privilegios mínimos (sin DDL fuera de migraciones). |
| `REDIS_URL` | sí | Sesiones del Parche, límites de intentos, tiempo real. |
| `APP_SECRET` | sí | ≥ 32 caracteres. HMAC de PIN y hashes de tokens. **La API no arranca en producción con el valor de ejemplo.** Rotación documentada por TI. |
| `CORS_ORIGINS` | sí | Dominios exactos de la PWA y la consola, separados por coma. También es la lista de orígenes de la protección CSRF: una operación desde otro origen recibe 403. En local: PWA `5173`/`4173` y consola `5174`/`4174` (ver `.env.example`). |
| `OPENAPI_UI` | no | Publica `/api/docs`. Siempre desactivado en producción (el JSON `/api/v1/openapi.json` sigue disponible). |
| `RATE_LIMIT_PER_MINUTE` | no | Límite base por cliente (por defecto 120). Los endpoints sensibles tienen límites propios. |
| `LOG_LEVEL` | no | `info` por defecto. Los logs redactan tokens, PIN, cookies, códigos OTP, destinos, fechas de nacimiento y claves de idempotencia. |
| `AUTH_RATE_LIMIT_PER_MINUTE` | no | Límite por IP del control de edad y del acceso por código (por defecto 10). |
| `SESSION_TTL_DAYS` | no | Duración de la sesión de acceso (por defecto 30 días). |
| `CODE_RATE_LIMIT_PER_MINUTE` | no | Límite por IP de `GET /product-codes/{token}/status` y de las reclamaciones (por defecto 30). Además, 20 consultas de códigos inexistentes en 10 min desde una IP frenan esa IP y dejan un evento de seguridad. |
| `GAME_RATE_LIMIT_PER_MINUTE` | no | Límite por cliente de iniciar y enviar partidas (por defecto 60). Los juegos por defecto de la plataforma se configuran en la consola (*Juegos → Juegos por defecto*), no por variable. La guía `docs/INTEGRACION_JUEGOS.md` se copia a `dist/` al compilar la API para mostrarse en la consola. |
| `EVENT_RATE_LIMIT_PER_MINUTE` | no | Límite por cliente de `POST /events` (eventos de analítica de la PWA; por defecto 60). |
| `VITE_PWA_URL` (consola) | no | Dirección pública de la PWA que abre el QR del Staff (`{VITE_PWA_URL}/s/{código}`). Por defecto `http://localhost:5173`; en staging y producción debe ser el dominio real. |
| `SMARTTAGS_INTEGRATION_KEY_HASHES` | no | Integración ERP (`POST /smarttags/validate`). Solo el SHA-256 de cada clave, separado por coma; vacío = apagada. Para emitir una clave: `openssl rand -base64 48 \| tr -d '/+=' \| tee clave.txt \| tr -d '\n' \| sha256sum` → la clave se entrega al ERP por canal seguro y el hash va en esta variable. El ERP la envía como `Authorization: Bearer <clave>`. |
| `OTP_PROVIDER` | sí | `none` hasta contratar proveedor. `console` (imprime el código en el log) **solo** en desarrollo/pruebas: la API no arranca en staging/producción con ese valor. |

### PWA (`apps/pwa/.env.example`)

| Variable | Notas |
|---|---|
| `VITE_API_URL` | `/api/v1` (mismo dominio, recomendado) o URL absoluta. |
| `VITE_DEMO_DATA` | `true` solo en desarrollo/demos internas: muestra la franja "Modo demostración". **Debe ser `false` en staging y producción.** |

Las variables `VITE_*` quedan dentro del bundle público: **nunca** poner secretos ahí (§4.4).

## Secretos

- No se guardan en el repositorio (`.env` está en `.gitignore`; el repo es público).
- Staging/producción: gestor de secretos del proveedor de nube aprobado por TI, inyectados como variables de entorno.
- `STITCH_API_KEY` (diseño) es personal de cada diseñador/desarrollador, solo local.

## Base de datos y migraciones

- Migraciones **solo hacia adelante** (`prisma migrate deploy`). Una migración aplicada nunca se edita: se corrige con otra nueva
  (ver `*_integridad_mensajes`).
- Nunca `migrate reset` fuera de desarrollo local.
- Reglas de integridad críticas viven en la base de datos (migración `*_integridad`): ledger inmutable, claim único por código,
  stock y saldo no negativos, PIN único entre sesiones activas, consentimientos append-only. Las pruebas `apps/api/test/integrity.spec.ts`
  las verifican.
- La semilla (`pnpm --filter @ilc/api db:seed`) se niega a correr en producción y no inventa SKUs, lotes ni puntos.

## Desarrollo local

```bash
pnpm install
pnpm db:up                                   # Postgres + Redis (docker)
cp apps/api/.env.example apps/api/.env
cp apps/pwa/.env.example apps/pwa/.env
pnpm build                                   # tokens, contratos, cliente Prisma, API, PWA
pnpm db:migrate && pnpm --filter @ilc/api db:seed
pnpm dev:api                                 # http://localhost:3000/api/v1/health · /api/docs
pnpm dev:pwa                                 # http://localhost:5173 (proxy /api → 3000)
pnpm dev:console                             # http://localhost:5174 consola de administración
```

### Smart Tags en local

1. En la consola (`ADMIN_MARCA`): **Smart Tags → Productos** para registrar el SKU vigente.
2. Con `SUPERADMIN`: **Generar** descarga un CSV con los tokens y su URL (única vez que salen en claro) o **Importar** un CSV/XLSX
   de la imprenta (`token, sku, lote, proveedor`; acepta `,` o `;`) con vista previa antes de confirmar.
3. **Lotes → Vincular a promoción** crea la promoción de cada botella (campaña de Ruta A o mixta, misma submarca).
4. En la PWA: `http://localhost:5173/v/<token>` (con `VITE_DEMO_DATA=false`).

### Acceso a la consola

La consola no tiene registro: TI asigna los roles por línea de comandos (queda en auditoría).

```bash
pnpm --filter @ilc/api build
pnpm --filter @ilc/api admin:grant -- --email persona@ilc.com.co --role ADMIN_MARCA
pnpm --filter @ilc/api admin:grant -- --email persona@ilc.com.co --role ADMIN_MARCA --revoke
```

Roles: `ADMIN_MARCA` (crea, publica y opera), `EDITOR_CONTENIDO` (crea y edita borradores), `REVISOR_MARCA`, `REVISOR_JURIDICO`,
`RESPONSABLE_PRIVACIDAD` (aprueban su parte), `SUPERADMIN`. Quien crea o envía una versión no puede aprobarla.
La persona entra con el código enviado a su correo (en local, aparece en el log de la API).

Acceso por código en local: con `OTP_PROVIDER=console` el código aparece en el log de la API
(`[solo desarrollo] código 123456 por whatsapp`).

Entradas de prueba en modo demostración: `/v/demo-reconocido`, `/v/demo-amarillo`, `/v/demo-reclamado`, `/v/demo-revision`,
`/p/4729` (PIN del Parche de demostración), `/e/feria`, `/r/DEMO-7K2Q`.

## Integración continua (`.github/workflows/ci.yml`)

En cada PR: Biome (lint/formato) → build (incluye la puerta de contraste WCAG AA de los tokens) → migraciones sobre la base de
pruebas → tipos → pruebas (unitarias, integración API, integridad de BD, UI, PWA) → Storybook → auditoría axe de todas las historias.

## Pendientes antes del piloto (Guía Técnica §15)

- Proveedor de nube, dominio oficial HTTPS de ILC, gestor de secretos, backups y RTO/RPO (TI).
- Observabilidad: destino de logs/métricas/trazas y alertas.
- Pipeline de despliegue a staging/producción con aprobación manual y rollback.
