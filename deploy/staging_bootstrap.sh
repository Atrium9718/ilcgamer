#!/usr/bin/env bash
# Prepara un servidor Ubuntu (VPS) como STAGING de ILC Origen: firewall, Docker, código, secretos y arranque.
# Se ejecuta EN EL SERVIDOR, como un usuario con sudo (no como root directamente):
#   curl -fsSL https://raw.githubusercontent.com/Atrium9718/ilcgamer/<rama>/deploy/staging_bootstrap.sh -o bootstrap.sh
#   less bootstrap.sh            # léelo antes de ejecutarlo
#   bash bootstrap.sh
# Es idempotente: se puede repetir. Los secretos se generan aquí y no se imprimen.
#
# Variables opcionales (todas con valor por defecto):
#   BRANCH        rama a desplegar                     (claude/mobile-app-planning-pgnveo)
#   REPO_URL      repositorio                          (https://github.com/Atrium9718/ilcgamer.git)
#   APP_DOMAIN    dominio de la PWA                    (app.<IP con guiones>.sslip.io)
#   CONSOLE_DOMAIN dominio de la consola               (consola.<IP con guiones>.sslip.io)
#   ACME_EMAIL    correo para Let's Encrypt            (se pregunta si falta)
#   OTP_PROVIDER  none | webhook                       (none: nadie puede iniciar sesión hasta tener pasarela)
#   OTP_WEBHOOK_URL / OTP_WEBHOOK_TOKEN  si OTP_PROVIDER=webhook
set -euo pipefail

BRANCH="${BRANCH:-claude/mobile-app-planning-pgnveo}"
REPO_URL="${REPO_URL:-https://github.com/Atrium9718/ilcgamer.git}"
DIR="${DIR:-/opt/ilc}"
OTP_PROVIDER="${OTP_PROVIDER:-none}"

if [ "$(id -u)" -eq 0 ]; then
  echo "Ejecútalo como un usuario normal con sudo (por ejemplo deploy), no como root." >&2
  exit 1
fi

say() { printf '\n==> %s\n' "$*"; }

say "1/6 Paquetes base y actualizaciones"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl git ufw openssl fail2ban

say "2/6 Firewall (solo 22, 80, 443)"
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw --force enable

say "3/6 Docker Engine y Compose"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo usermod -aG docker "$USER"
DOCKER="sudo docker"

say "4/6 Código ($BRANCH)"
if [ ! -d "$DIR/.git" ]; then
  sudo mkdir -p "$DIR"
  sudo chown "$USER":"$USER" "$DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$DIR"
else
  git -C "$DIR" fetch origin "$BRANCH"
  git -C "$DIR" checkout "$BRANCH"
  git -C "$DIR" pull --ff-only origin "$BRANCH"
fi
cd "$DIR"

say "5/6 Configuración y secretos (.env.production)"
if [ -f .env.production ]; then
  echo "Ya existe .env.production: no se toca."
else
  IP="${SERVER_IP:-$(curl -fsS https://api.ipify.org)}"
  DASHED="${IP//./-}"
  APP_DOMAIN="${APP_DOMAIN:-app.${DASHED}.sslip.io}"
  CONSOLE_DOMAIN="${CONSOLE_DOMAIN:-consola.${DASHED}.sslip.io}"
  if [ -z "${ACME_EMAIL:-}" ]; then
    read -r -p "Correo para los avisos de certificados HTTPS: " ACME_EMAIL
  fi
  if [ "$OTP_PROVIDER" = "webhook" ] && { [ -z "${OTP_WEBHOOK_URL:-}" ] || [ -z "${OTP_WEBHOOK_TOKEN:-}" ]; }; then
    echo "OTP_PROVIDER=webhook exige OTP_WEBHOOK_URL y OTP_WEBHOOK_TOKEN." >&2
    exit 1
  fi
  umask 077
  {
    echo "APP_DOMAIN=$APP_DOMAIN"
    echo "CONSOLE_DOMAIN=$CONSOLE_DOMAIN"
    echo "ACME_EMAIL=$ACME_EMAIL"
    echo "FRAME_SRC="
    echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
    echo "REDIS_PASSWORD=$(openssl rand -hex 24)"
    echo "APP_SECRET=$(openssl rand -hex 32)"
    echo "SESSION_TTL_DAYS=30"
    echo "OPENAPI_UI=false"
    echo "OTP_PROVIDER=$OTP_PROVIDER"
    if [ "$OTP_PROVIDER" = "webhook" ]; then
      echo "OTP_WEBHOOK_URL=$OTP_WEBHOOK_URL"
      echo "OTP_WEBHOOK_TOKEN=$OTP_WEBHOOK_TOKEN"
    fi
    echo "METRICS_TOKEN=$(openssl rand -hex 24)"
    echo "SMARTTAGS_INTEGRATION_KEY_HASHES="
    echo "BACKUP_KEEP_DAYS=14"
    echo "BACKUP_AGE_RECIPIENT="
  } > .env.production
  chmod 600 .env.production
  echo "Creado .env.production (permisos 600). Dominios: $APP_DOMAIN y $CONSOLE_DOMAIN"
fi

say "6/6 Construcción y arranque (la primera vez tarda varios minutos)"
COMPOSE="$DOCKER compose --env-file .env.production -f deploy/compose.prod.yml"
$COMPOSE up -d --build
$COMPOSE run --rm api node dist/seed.js

APP="$(grep '^APP_DOMAIN=' .env.production | cut -d= -f2)"
CONSOLE="$(grep '^CONSOLE_DOMAIN=' .env.production | cut -d= -f2)"
echo
$COMPOSE ps
echo
echo "Comprobación (puede tardar un minuto en emitir el certificado):"
echo "  curl -fsS https://$APP/api/v1/health"
echo "PWA:     https://$APP"
echo "Consola: https://$CONSOLE"
echo
echo "Pendiente: crear a la persona de TI con admin-grant (ver docs/DESPLIEGUE.md, paso 6) y configurar la pasarela OTP."
echo "Si el servidor pide reinicio (kernel nuevo): sudo reboot  (y luego: cd $DIR && $COMPOSE up -d)."
