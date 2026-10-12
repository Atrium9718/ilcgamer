import { describe, expect, it } from 'vitest';
import { toWalletData } from './data.ts';

describe('billetera: contrato de la API → vista', () => {
  it('anuncia el próximo vencimiento en hora de Colombia y conserva el tipo de cada movimiento', () => {
    const w = toWalletData({
      balance: 500,
      currencyName: 'Puntos ILC',
      expiring: { amount: 300, at: '2026-11-30T05:00:00.000Z' },
      entries: [
        {
          id: '00000000-0000-7000-8000-000000000001',
          kind: 'expiry',
          amount: -200,
          description: 'Vencimiento de puntos',
          at: '2026-10-02T04:30:00.000Z',
          expiresAt: null,
        },
      ],
      nextCursor: null,
    });
    expect(w.expiringNotice).toBe('300 Puntos ILC vencen el 30 de nov de 2026');
    // 04:30 UTC del 2 de octubre es el 1 de octubre en Colombia.
    expect(w.entries[0]).toMatchObject({ kind: 'expiry', amount: -200, dateLabel: '1 de oct' });
  });
});

describe('código de Staff recordado', () => {
  it('solo vale mientras no pasen 6 horas y si tiene el formato correcto', async () => {
    const { readStaffCode, writeLocal, KEYS } = await import('./storage.ts');
    sessionStorage.clear();
    expect(readStaffCode()).toBeUndefined();
    writeLocal(KEYS.staff, { code: 'K7M2Q9XD', at: 1_000 }, 'session');
    expect(readStaffCode(1_000 + 5 * 3_600_000)).toBe('K7M2Q9XD');
    expect(readStaffCode(1_000 + 7 * 3_600_000)).toBeUndefined();
    writeLocal(KEYS.staff, { code: 'mal', at: 1_000 }, 'session');
    expect(readStaffCode(2_000)).toBeUndefined();
  });
});
