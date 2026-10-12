import { readFileSync } from 'node:fs';
import { validateManifest } from '@ilc/contracts';
import { describe, expect, it } from 'vitest';

describe('manifiestos de ejemplo (games/ejemplos)', () => {
  it.each(['trivia-ejemplo', 'ruleta-ejemplo', 'explorador-ejemplo', 'iframe-ejemplo'])('%s es válido', (name) => {
    const manifest = JSON.parse(readFileSync(new URL(`../../../games/ejemplos/${name}.json`, import.meta.url), 'utf8'));
    const r = validateManifest(manifest);
    expect(r.ok, JSON.stringify(r.ok ? {} : r.errors)).toBe(true);
  });
});
