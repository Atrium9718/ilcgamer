# Despliegue en un servidor (VPS)

Instrucciones para poner la plataforma en un servidor Ubuntu 24.04 con Docker (por ejemplo un VPS de 2 vCPU y 8 GB). Todo
queda en `deploy/`. **Pendiente de aprobación de TI de ILC**: el proveedor de infraestructura y su ubicación (Guía Técnica
§15). Este documento no sustituye esa decisión; sirve para un **staging** o un piloto controlado.

> Estado de verificación: el archivo de Compose valida (`docker compose config`) y el paquete de la API se probó fuera de
> Docker (`pnpm deploy` + arranque + migraciones). Las imágenes **no se construyeron en este entorno** (sin demonio de
> Docker): la primera construcción en el servidor es parte de la verificación.

## Qué se levanta

| Servicio | Imagen | Notas |
|---|---|---|
| `postgres` | postgres:16-alpine | Volumen `pgdata`; sin puertos al exterior |
| `redis` | redis:7-alpine | Con contraseña y persistencia; sin puertos al exterior |
| `migrate` | `deploy/Dockerfile.api` | Aplica las migraciones y termina |
| `api` | `deploy/Dockerfile.api` | NestJS, solo accesible desde la red interna |
| `web` | `deploy/Dockerfile.web` (Caddy) | HTTPS automático, sirve PWA y consola, proxy a `/api` |
| `backup` | `deploy/Dockerfile.backup` | Copia diaria con rotación y cifrado opcional |

## Atajo para staging

`deploy/staging_bootstrap.sh` automatiza los pasos 2–5 y 7 en un servidor limpio (se lee y ejecuta en el servidor como usuario con sudo; genera los secretos allí). Ver la cabecera del script.

## Pasos

1. **DNS**: dos nombres (PWA y consola) apuntando a la IP del servidor.
2. **Servidor**: actualizar, activar firewall (solo 22, 80, 443), instalar Docker Engine y el plugin de Compose, crear un usuario
   sin privilegios para operar y deshabilitar el acceso por contraseña de SSH (solo llaves).
3. **Código**: clonar el repositorio en el servidor.
4. **Secretos**: `cp deploy/.env.production.example .env.production` y completar. Generar cada secreto con
   `openssl rand -hex 32`. El archivo **no se versiona** (`.gitignore`) y debe quedar con permisos `600`.
5. **Arranque**:
   ```bash
   docker compose --env-file .env.production -f deploy/compose.prod.yml up -d --build
   docker compose --env-file .env.production -f deploy/compose.prod.yml logs -f api web
   ```
6. **Primer acceso de TI**: no hay usuario inicial por diseño. Crear la persona de TI con la CLI (el correo recibe el código):
   ```bash
   docker compose --env-file .env.production -f deploy/compose.prod.yml run --rm api \
     node dist/admin-grant.js --email ti@ejemplo.com.co --role SUPERADMIN
   ```
   Luego `ti@…` ingresa a la consola con su código y asigna al resto del equipo (Admin de Marca, revisores…).
7. **Marcas y ajustes por defecto** (una vez; es idempotente):
   ```bash
   docker compose --env-file .env.production -f deploy/compose.prod.yml run --rm api node dist/seed.js
   ```
8. **Verificación**: `curl https://APP_DOMAIN/api/v1/health` responde `ok`; abrir la PWA en un celular; recorrer la lista de
   `docs/PILOTO.md`.

## Actualizar y volver atrás

```bash
git pull && docker compose --env-file .env.production -f deploy/compose.prod.yml up -d --build   # migra y reinicia
```
Las migraciones son **hacia adelante** (no hay `migrate reset` en producción). Para volver atrás: desplegar la versión
anterior del código; si una migración ya se aplicó y no es compatible, restaurar la copia previa (ver `docs/OPERACION.md`).

## Códigos de acceso (OTP)

En producción `OTP_PROVIDER=console` está prohibido. Con `OTP_PROVIDER=webhook` la API envía a la pasarela que ILC contrate un
`POST` JSON `{ channel, destination, code, locale, message }` con `Authorization: Bearer <OTP_WEBHOOK_TOKEN>` (HTTPS obligatorio).
La pasarela decide si entrega por WhatsApp, SMS o correo. Sin pasarela configurada nadie puede iniciar sesión por código.

**Excepción solo para staging sin usuarios reales:** `OTP_PROVIDER=console` junto con `STAGING_OTP_LOG_ACK=solo-staging-sin-usuarios-reales`
deja el código en el log de la API (`docker compose … logs api | grep OTP`). Sin esa frase exacta la API no arranca. Hay que quitarla
(y usar la pasarela) antes de abrir a personas reales.

**Excepción solo para staging con una sola persona administradora:** `STAGING_RELAX_SEPARATION_ACK=solo-staging-sin-usuarios-reales`
relaja "quien crea no aprueba/activa" en juegos, campañas y recompensas. Autorizada expresamente por quien administra el proyecto;
**debe quitarse antes de usuarios reales** (por defecto la separación de funciones siempre se exige).

## Seguridad que ya trae esta configuración

HTTPS con renovación automática, HSTS, CSP estricta (sin scripts ni fuentes de terceros), cookie de sesión `__Host-` `Secure`
`HttpOnly` `SameSite=Lax`, bases de datos solo en red interna, contenedor de la API sin root, copias cifrables y métricas protegidas
por token. Los proveedores de juegos en iframe se habilitan agregando su origen a `FRAME_SRC`.
