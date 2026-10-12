import { describe, expect, it } from 'vitest';
import { type AllocEntry, levelFor, remainingByCredit } from '../src/economy/allocation.ts';

const d = (day: number) => new Date(Date.UTC(2026, 0, day));
const credit = (id: string, amount: number, day: number, expiresDay: number | null): AllocEntry => ({
  id,
  type: 'CREDITO',
  amount,
  createdAt: d(day),
  expiresAt: expiresDay === null ? null : d(expiresDay),
  originalEntryId: null,
});

describe('asignación FIFO del ledger (Guía Técnica §5.7)', () => {
  it('un canje consume primero lo que vence antes', () => {
    const r = remainingByCredit([
      credit('a', 500, 1, 30),
      credit('b', 300, 2, 10),
      credit('c', 200, 3, null),
      { id: 'd', type: 'DEBITO', amount: -400, createdAt: d(5), expiresAt: null, originalEntryId: null },
    ]);
    expect([...r]).toEqual([
      ['a', 400],
      ['b', 0],
      ['c', 200],
    ]);
  });

  it('un canje no usa créditos que ya estaban vencidos en ese momento', () => {
    const r = remainingByCredit([
      credit('a', 100, 1, 3),
      credit('b', 100, 2, null),
      { id: 'd', type: 'DEBITO', amount: -50, createdAt: d(5), expiresAt: null, originalEntryId: null },
    ]);
    expect(r.get('a')).toBe(100);
    expect(r.get('b')).toBe(50);
  });

  it('reversos y vencimientos descuentan solo de su crédito', () => {
    const r = remainingByCredit([
      credit('a', 500, 1, null),
      credit('b', 300, 2, null),
      { id: 'r', type: 'REVERSO', amount: -300, createdAt: d(3), expiresAt: null, originalEntryId: 'b' },
    ]);
    expect(r.get('a')).toBe(500);
    expect(r.get('b')).toBe(0);
  });

  it('calcula el nivel por umbrales', () => {
    expect(levelFor(0, [0, 100, 300])).toEqual({ number: 1, fromXp: 0, nextAt: 100 });
    expect(levelFor(150, [0, 100, 300])).toEqual({ number: 2, fromXp: 100, nextAt: 300 });
    expect(levelFor(900, [0, 100, 300])).toEqual({ number: 3, fromXp: 300, nextAt: null });
  });
});
