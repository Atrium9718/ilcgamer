#!/usr/bin/env bash
# Prueba de restauración (Guía Técnica §9.1, §12.1 suite 10): restaura una copia en una base TEMPORAL y verifica que
# las invariantes de la economía se cumplen. Nunca toca la base de origen. Uso:
#   restore_check.sh backups/ilc-20261013T000000Z.dump [clave-age.txt]
# Variables: PG* (servidor donde crear la base temporal; necesita permiso CREATEDB).
set -euo pipefail
file="${1:?indica el archivo de copia}"
key="${2:-}"
tmp="ilc_restore_check_$$"
work=$(mktemp -d)
trap 'psql -d postgres -qc "DROP DATABASE IF EXISTS \"$tmp\"" >/dev/null 2>&1 || true; rm -rf "$work"' EXIT

[ -f "$file.sha256" ] && (cd "$(dirname "$file")" && sha256sum -c "$(basename "$file").sha256" >/dev/null) && echo "✓ suma de verificación"
src="$file"
if [[ "$file" == *.age ]]; then
  [ -n "$key" ] || { echo "la copia está cifrada: indica la clave age"; exit 1; }
  age -d -i "$key" -o "$work/ilc.dump" "$file"
  src="$work/ilc.dump"
fi

psql -d postgres -qc "CREATE DATABASE \"$tmp\""
pg_restore --no-owner --no-privileges --dbname="$tmp" "$src"
echo "✓ restaurada en $tmp"

q() { psql -d "$tmp" -tAc "$1"; }
fail=0
check() { # descripción, SQL que debe devolver 0
  local n; n=$(q "$2")
  if [ "$n" = "0" ]; then echo "✓ $1"; else echo "✗ $1 ($n)"; fail=1; fi
}
check "saldo en caché igual a la suma del ledger" \
  "SELECT count(*) FROM ledger_accounts a WHERE a.balance <> COALESCE((SELECT sum(e.amount) FROM ledger_entries e WHERE e.\"accountId\" = a.id), 0)"
check "ningún saldo negativo" "SELECT count(*) FROM ledger_accounts WHERE balance < 0"
check "ningún stock negativo" "SELECT count(*) FROM reward_inventory WHERE available < 0"
check "a lo sumo un claim confirmado por código" \
  "SELECT count(*) FROM (SELECT \"campaignCodeId\" FROM claims WHERE confirmed GROUP BY 1 HAVING count(*) > 1) x"
check "triggers de inmutabilidad del ledger presentes" \
  "SELECT 2 - count(*) FROM pg_trigger WHERE tgname IN ('ledger_entries_no_update','ledger_entries_no_delete')"
echo "ℹ filas: usuarios=$(q 'SELECT count(*) FROM users') ledger=$(q 'SELECT count(*) FROM ledger_entries') canjes=$(q 'SELECT count(*) FROM reward_claims') auditoría=$(q 'SELECT count(*) FROM audit_events')"
[ "$fail" = 0 ] && echo "✓ restauración verificada" || { echo "✗ la restauración NO pasó las verificaciones"; exit 1; }
