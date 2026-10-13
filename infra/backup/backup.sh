#!/bin/sh
# Copia lógica de PostgreSQL con rotación (Guía Técnica §9.1: copias protegidas y restauración probada).
#   backup.sh            una copia ahora
#   backup.sh --loop     una copia cada 24 h (modo contenedor "backup")
# Variables: PG* (conexión), BACKUP_DIR, BACKUP_KEEP_DAYS (14), BACKUP_AGE_RECIPIENT (cifra con age si se define).
set -eu
DIR="${BACKUP_DIR:-./backups}"
KEEP="${BACKUP_KEEP_DAYS:-14}"
mkdir -p "$DIR"

one() {
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  out="$DIR/ilc-$stamp.dump"
  # Formato custom (comprimido, restaurable por partes). --no-owner: se restaura bajo cualquier usuario.
  pg_dump --format=custom --no-owner --no-privileges --file="$out.partial"
  if [ -n "${BACKUP_AGE_RECIPIENT:-}" ]; then
    command -v age >/dev/null 2>&1 || { echo "age no está instalado"; exit 1; }
    age -r "$BACKUP_AGE_RECIPIENT" -o "$out.age" "$out.partial"
    rm -f "$out.partial"
    out="$out.age"
  else
    mv "$out.partial" "$out"
  fi
  # Suma de verificación para detectar corrupción al restaurar.
  (cd "$DIR" && sha256sum "$(basename "$out")" > "$(basename "$out").sha256")
  find "$DIR" -name 'ilc-*' -type f -mtime +"$KEEP" -delete
  echo "✓ copia $(basename "$out") ($(du -h "$out" | cut -f1))"
}

if [ "${1:-}" = "--loop" ]; then
  while true; do one || echo "✗ falló la copia"; sleep 86400; done
else
  one
fi
