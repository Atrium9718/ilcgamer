/**
 * Asignación de lo usado a cada crédito (Guía Técnica §5.7). El saldo es la suma del ledger; esta función
 * responde "¿cuánto queda sin usar de cada crédito?" para vencer o reversar solo lo que sigue disponible.
 *
 * Reglas, en orden cronológico:
 * - Un débito (canje) consume primero los créditos que vencen antes (FIFO por vencimiento) y que estaban
 *   vigentes en ese momento.
 * - Un reverso o vencimiento apunta a su crédito original y solo descuenta de ese crédito.
 */
export interface AllocEntry {
  id: string;
  type: 'CREDITO' | 'DEBITO' | 'REVERSO' | 'AJUSTE';
  amount: number;
  createdAt: Date;
  expiresAt: Date | null;
  originalEntryId: string | null;
}

export function remainingByCredit(entries: readonly AllocEntry[]): Map<string, number> {
  const remaining = new Map<string, number>();
  const credits: AllocEntry[] = [];
  const ordered = [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  for (const e of ordered) {
    if (e.type === 'CREDITO') {
      credits.push(e);
      remaining.set(e.id, e.amount);
    } else if (e.originalEntryId && remaining.has(e.originalEntryId) && e.amount < 0) {
      remaining.set(e.originalEntryId, Math.max(0, (remaining.get(e.originalEntryId) ?? 0) + e.amount));
    } else if (e.amount < 0) {
      let toConsume = -e.amount;
      const at = e.createdAt.getTime();
      const usable = credits
        .filter((c) => (remaining.get(c.id) ?? 0) > 0 && (c.expiresAt === null || c.expiresAt.getTime() > at))
        .sort(
          (a, b) =>
            (a.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY) - (b.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY) ||
            a.createdAt.getTime() - b.createdAt.getTime(),
        );
      for (const c of usable) {
        if (toConsume === 0) break;
        const take = Math.min(toConsume, remaining.get(c.id) ?? 0);
        remaining.set(c.id, (remaining.get(c.id) ?? 0) - take);
        toConsume -= take;
      }
    }
  }
  return remaining;
}

/** Nivel según umbrales de XP: [0, 100, 300, …] → nivel 1 desde 0, nivel 2 desde 100… */
export function levelFor(xp: number, thresholds: readonly number[]): { number: number; fromXp: number; nextAt: number | null } {
  let index = 0;
  for (let i = 0; i < thresholds.length; i++) if (xp >= (thresholds[i] as number)) index = i;
  return { number: index + 1, fromXp: thresholds[index] as number, nextAt: thresholds[index + 1] ?? null };
}
