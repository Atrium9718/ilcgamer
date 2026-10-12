#!/usr/bin/env node
/**
 * Auditoría de accesibilidad (axe-core, WCAG 2.1 AA) de TODAS las historias de Storybook,
 * en tema oscuro y claro.
 *
 * Uso:
 *   pnpm --filter @ilc/ui build
 *   (cd packages/ui/storybook-static && python3 -m http.server 6007) &
 *   node tools/a11y_audit.cjs            # sale con código 1 si hay violaciones
 *
 * Requiere Playwright (en el entorno cloud: PLAYWRIGHT_BROWSERS_PATH ya configurado).
 */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    return require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
  }
}

const root = path.resolve(__dirname, '..');
const base = process.env.STORYBOOK_URL ?? 'http://localhost:6007';
const index = JSON.parse(fs.readFileSync(path.join(root, 'packages/ui/storybook-static/index.json'), 'utf8'));
const axePath = execSync(`find ${path.join(root, 'node_modules/.pnpm')} -path '*axe-core/axe.min.js'`)
  .toString()
  .split('\n')[0];
const axeSource = fs.readFileSync(axePath, 'utf8');

(async () => {
  const { chromium } = loadPlaywright();
  // En entornos con navegador preinstalado: PLAYWRIGHT_CHROMIUM_EXECUTABLE=/ruta/al/chrome
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const ids = Object.values(index.entries)
    .filter((e) => e.type === 'story')
    .map((e) => e.id);
  let failures = 0;
  for (const id of ids) {
    for (const theme of ['dark', 'light']) {
      await page.goto(`${base}/iframe.html?id=${encodeURIComponent(id)}&viewMode=story&globals=theme:${theme}`);
      await page.waitForTimeout(1200);
      await page.addScriptTag({ content: axeSource });
      const violations = await page.evaluate(async () =>
        (await window.axe.run(document.querySelector('#storybook-root'), { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations.map(
          (v) => `${v.id} (${v.nodes.length}): ${v.nodes[0].target} — ${v.nodes[0].failureSummary.split('\n')[1]?.trim()}`,
        ),
      );
      failures += violations.length;
      console.log(`${violations.length ? '✗' : '✓'} [${theme}] ${id}${violations.length ? `\n   ${violations.join('\n   ')}` : ''}`);
    }
  }
  await browser.close();
  console.log(failures ? `\n${failures} violaciones` : `\nSin violaciones WCAG AA en ${ids.length * 2} combinaciones`);
  process.exit(failures ? 1 : 0);
})();
