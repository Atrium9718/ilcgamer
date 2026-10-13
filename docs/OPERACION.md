# Operación y recuperación

Procedimientos para quien opera la plataforma (TI/Operación). Fuente: Guía Técnica §9.1, §11, §12.1 (suites de operación y
recuperación), §14 (gobierno operativo).

## Salud y observabilidad

- **Salud**: `GET /api/v1/health` → `ok` / `degraded` (sin Redis, la API sirve pero sin tiempo real ni límites) / 503 (sin base de datos).
- **Métricas** (Prometheus): `GET /api/v1/metrics` con `Authorization: Bearer $METRICS_TOKEN`; apagadas si no hay token.
  Series: `ilc_http_requests_total{method,route,status}`, `ilc_http_request_duration_seconds` (histograma), `ilc_up`,
  `ilc_database_up`, `ilc_cache_up`, `ilc_security_events_open`, `ilc_reward_reservations_pending`, memoria y *uptime*.
  Las rutas se etiquetan con plantilla (`/rewards/:id/claim`): nunca pasan tokens, PIN ni identificadores.
- **Logs**: JSON con `reqId` (también en la cabecera `X-Request-Id`); redactan tokens, PIN, cookies, OTP, destinos, fechas de
  nacimiento y claves de idempotencia.
- **Tableros de negocio**: consola → Analítica (Ruta A, Ruta B, Operación, Ejecutiva).

### Alertas sugeridas (a configurar en el monitor que use TI)

| Alerta | Condición | Acción |
|---|---|---|
| API caída | `ilc_up == 0` 1 min | Revisar `docker compose ps`, logs de `api`, base de datos |
| Redis caído | `ilc_cache_up == 0` 5 min | Reiniciar `redis`; el tiempo real y los límites se degradan |
| Errores 5xx | > 2 % de solicitudes en 5 min | Revisar logs por `reqId`; considerar pausar campañas |
| Latencia | p95 de `/campaign-codes/:token/claim` > 1 s | Revisar base de datos y conexiones |
| Incidentes abiertos | `ilc_security_events_open > 0` > 24 h | Revisar en consola/Auditoría y resolver |
| Conciliación | evento de seguridad `ledger.reconciliation_mismatch` (severidad ALTA) | Ver «Diferencia de saldos» |
| Reservas sin retirar | `ilc_reward_reservations_pending` creciente | Revisar la entrega en los puntos aliados |
| Disco | volúmenes > 80 % | Limpiar copias antiguas / ampliar |

## Copias de seguridad y restauración

- **Qué**: copia lógica diaria de PostgreSQL (`pg_dump` formato custom) en el volumen `backups`, con rotación (`BACKUP_KEEP_DAYS`,
  14 por defecto), suma de verificación y cifrado opcional con `age` (`BACKUP_AGE_RECIPIENT`). Redis no se respalda: guarda
  estado efímero (sesiones del Parche, límites de intentos).
- **Sacar una copia ahora**: `docker compose … exec backup /bin/sh /backup/backup.sh`.
- **Copia fuera del servidor**: una copia en el mismo disco no protege de perder el servidor. Programar la subida del volumen
  `backups` a un almacenamiento externo (decisión de TI; la clave `age` privada se guarda aparte, nunca en el servidor).
- **Probar la restauración** (hacerlo al menos al mes y antes del piloto):
  ```bash
  PGHOST=… PGUSER=… infra/backup/restore_check.sh /ruta/ilc-AAAAMMDDTHHMMSSZ.dump        # o .dump.age con la clave
  ```
  Restaura en una base **temporal** (no toca la de origen) y verifica: suma de comprobación, saldo en caché = suma del ledger,
  sin saldos ni stock negativos, un solo claim por código y los *triggers* de inmutabilidad del ledger. Sale con error si algo falla.
- **Restaurar de verdad** (desastre): detener `api`, crear la base vacía, `pg_restore --no-owner --dbname=ilc archivo.dump`,
  correr `migrate` (por si la copia es de una versión anterior), levantar `api` y revisar la conciliación (siguiente sección).

## Incidentes frecuentes

| Situación | Qué hacer |
|---|---|
| **Diferencia de saldos** (conciliación) | La consola → Economía → Conciliación lista las cuentas. El ledger es la fuente de verdad: el saldo en caché se corrige con un movimiento de ajuste auditado, nunca editando filas (la base lo impide). |
| **Código de botella filtrado o fraude** | Revocar el lote (Smart Tags) y reversar los créditos afectados con motivo (Economía). Queda en auditoría. |
| **Campaña con error** | Pausarla (Campañas → Pausar): deja de emitir beneficios al instante; los saldos ya emitidos no cambian. |
| **Juego con problema** | Juegos → Desactivar (con motivo) o *Volver a esta versión*. |
| **Recompensa mal cargada** | Recompensas → Desactivar; los canjes ya hechos se anulan uno a uno (devuelven puntos y stock). |
| **Persona pide eliminar su cuenta** | Perfil → Eliminar mi cuenta (la persona misma). Se conservan solo registros con base legítima: ledger y auditoría pseudonimizados. |
| **Filtración del secreto del proveedor de un juego** | Juegos → Secreto del proveedor → Rotar; entregar el nuevo por un canal seguro. |
| **Se filtró `APP_SECRET`** | Cambiarlo invalida PIN de Parches vivos y *hashes* de tokens: coordinar ventana de mantenimiento; rotar también `OTP_WEBHOOK_TOKEN` y `METRICS_TOKEN`. |
| **Redis cae** | La API sigue (modo degradado). Al volver, el tiempo real se reconecta solo. |
| **Base de datos cae** | La API responde 503; las personas ven el aviso de reintento. Restaurar o reiniciar `postgres`. |

## Retención de datos

Un proceso diario depura (configurable en `platform_settings`): analítica 730 días, incidentes resueltos 730 días, consultas de
códigos 365 días y el estado privado de misiones terminadas 30 días. **No** se purgan ledger, auditoría, consentimientos ni
canjes. Ver el inventario completo en `docs/PILOTO.md`.

## Rendimiento (referencia)

`pnpm loadtest` (concurrencia 30, un proceso de API en un portátil de desarrollo): `/health` ~1.700 req/s; consulta de código
~1.200 req/s con p95 40 ms; `/games`, `/rewards` y `/wallet` entre 300 y 700 req/s con p95 ≤ 115 ms. **No es una prueba de
capacidad del servidor de producción**: repetirla contra staging con el tráfico esperado del piloto.
