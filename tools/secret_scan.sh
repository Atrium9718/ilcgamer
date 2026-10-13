#!/usr/bin/env bash
# Búsqueda básica de secretos en lo versionado (Guía Técnica §9.1). Falla si encuentra patrones de llaves reales.
# No sustituye a una herramienta dedicada (gitleaks) en el pipeline de la organización, pero frena lo evidente.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
patterns='AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----|AIza[0-9A-Za-z_-]{35}|ghp_[0-9A-Za-z]{36}|xox[baprs]-[0-9A-Za-z-]{10,}|sk-[A-Za-z0-9]{32,}|(password|passwd|secret|api[_-]?key)["'"'"' ]*[:=]["'"'"' ]*[A-Za-z0-9/+_-]{20,}'
hits=$(git ls-files -z | xargs -0 grep -InE "$patterns" -- 2>/dev/null | grep -vE '^(docs/fuentes|pnpm-lock.yaml|tools/secret_scan.sh|design/stitch-exports)' | grep -vE 'cambiar|ejemplo|example|prueba|placeholder|process\.env|TOKEN_IN_PATH' || true)
if [ -n "$hits" ]; then
  echo "Posibles secretos versionados:"; echo "$hits"; exit 1
fi
echo "✓ Sin secretos evidentes en lo versionado"
