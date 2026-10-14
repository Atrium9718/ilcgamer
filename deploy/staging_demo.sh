#!/usr/bin/env bash
# Deja un STAGING listo para mostrar: activa las excepciones de staging, da rol de administrador a quien se indique y carga los
# datos de demostración (juegos, campaña, códigos y recompensas). Se ejecuta en el servidor, dentro de /opt/ilc:
#   bash deploy/staging_demo.sh persona@correo.com [otra@correo.com]
# Idempotente. NUNCA usar con usuarios reales: las excepciones de staging deben quitarse antes (ver docs/DESPLIEGUE.md).
set -euo pipefail
cd "$(dirname "$0")/.."
EMAIL="${1:?Indica el correo de la persona administradora}"
EXTRA="${2:-}"
PHRASE="solo-staging-sin-usuarios-reales"
COMPOSE="sudo docker compose --env-file .env.production -f deploy/compose.prod.yml"

set_env() { # clave valor
  if grep -q "^$1=" .env.production; then sed -i "s|^$1=.*|$1=$2|" .env.production; else echo "$1=$2" >> .env.production; fi
}
echo "==> Excepciones de staging (código de acceso en el log y un solo administrador)"
set_env OTP_PROVIDER console
set_env STAGING_OTP_LOG_ACK "$PHRASE"
set_env STAGING_RELAX_SEPARATION_ACK "$PHRASE"
set_env REQUIRE_PROFILE_AT_ENTRY true                 # al entrar: nombre, correo, celular y tratamiento de datos
set_env STAGING_AUTO_ACCOUNT_ACK "$PHRASE"   # tras el control de edad la cuenta nace activa (sin «guardar mi progreso»)
$COMPOSE up -d api
APP="$(grep '^APP_DOMAIN=' .env.production | cut -d= -f2)"
for i in $(seq 1 30); do curl -fsS "https://$APP/api/v1/health" >/dev/null && break; sleep 5; done

echo "==> Roles"
for who in "$EMAIL" ${EXTRA:+"$EXTRA"}; do
  for role in SUPERADMIN ADMIN_MARCA; do
    $COMPOSE run --rm api node dist/admin-grant.js --email "$who" --role "$role" | tail -1
  done
done

echo "==> Datos de demostración"
$COMPOSE run --rm -e APP_DOMAIN="$APP" api node dist/seed-demo.js --as "$EMAIL" | tee /tmp/ilc-demo.out
echo
echo "Listo. PWA: https://$APP  ·  Consola: https://$(grep '^CONSOLE_DOMAIN=' .env.production | cut -d= -f2)"
echo "Código de acceso: aparece al pedirlo, con:  $COMPOSE logs --tail=20 api | grep OTP"
