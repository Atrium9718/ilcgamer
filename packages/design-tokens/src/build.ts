import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditContrast } from './contrast.ts';
import { emitThemeCss, googleFontsHref } from './emit.ts';
import { parseDesignMd, parseThemes } from './parse.ts';

const here = dirname(fileURLToPath(import.meta.url));
const designDir = resolve(here, '../../../design');
const distDir = resolve(here, '../dist');

const tokens = parseDesignMd(readFileSync(resolve(designDir, 'DESIGN.md'), 'utf8'));
const themes = parseThemes(readFileSync(resolve(designDir, 'themes.yaml'), 'utf8'));

// Puerta de accesibilidad: el build falla si un par texto/fondo no cumple WCAG AA.
const failures = [
  ...auditContrast(tokens.colors).map((f) => ({ theme: 'dark', ...f })),
  ...auditContrast({ ...tokens.colors, ...themes.light }).map((f) => ({ theme: 'light', ...f })),
];
if (failures.length) {
  console.error('Contraste insuficiente (WCAG AA 4.5:1):');
  for (const f of failures) console.error(`  [${f.theme}] ${f.fg} sobre ${f.bg}: ${f.ratio}:1`);
  process.exit(1);
}

mkdirSync(distDir, { recursive: true });
writeFileSync(resolve(distDir, 'theme.css'), emitThemeCss(tokens, themes));
writeFileSync(
  resolve(distDir, 'tokens.json'),
  `${JSON.stringify({ ...tokens, themes, fontsHref: googleFontsHref(tokens) }, null, 2)}\n`,
);
console.log(`✓ ${tokens.name} v${tokens.version} → dist/theme.css, dist/tokens.json`);
