// Empaqueta la guía de integración de juegos junto al build: la consola la muestra a los administradores.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const from = resolve(root, '../../docs/INTEGRACION_JUEGOS.md');
if (existsSync(from)) {
  mkdirSync(resolve(root, 'dist'), { recursive: true });
  copyFileSync(from, resolve(root, 'dist/INTEGRACION_JUEGOS.md'));
}
