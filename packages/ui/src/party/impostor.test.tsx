import { describe, expect, it } from 'vitest';
import { dealImpostor } from './impostor.ts';

const cats = [
  { name: 'A', words: ['a1', 'a2', 'a3', 'a4', 'a5'] },
  { name: 'B', words: ['b1', 'b2', 'b3', 'b4', 'b5'] },
];

describe('reparto de El Impostor', () => {
  it('siempre hay exactamente los impostores pedidos, distintos y dentro del grupo', () => {
    for (let i = 0; i < 200; i++) {
      const d = dealImpostor(5, 2, cats, null);
      expect(new Set(d.impostors).size).toBe(2);
      expect(d.impostors.every((x) => x >= 0 && x < 5)).toBe(true);
      expect(d.starter).toBeGreaterThanOrEqual(0);
      expect(d.starter).toBeLessThan(5);
      expect(cats.find((c) => c.name === d.category)?.words).toContain(d.word);
    }
  });
  it('respeta la categoría elegida y nunca deja a todos como impostores', () => {
    expect(dealImpostor(3, 2, cats, 1).category).toBe('B');
    expect(dealImpostor(3, 2, cats, 1).impostors.length).toBe(1);
  });
});
