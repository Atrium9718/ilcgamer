import { type AdminAccount, CampaignDraftSchema, type Reconciliation, type Wallet, type WalletEntry, XpLevelsSchema } from '@ilc/contracts';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.ts';
import type { Actor } from '../campaigns/campaigns.service.ts';
import { DomainError } from '../common/domain-error.ts';
import type { LedgerEntry } from '../generated/prisma/client.ts';
import { Prisma } from '../generated/prisma/client.ts';
import { SettingsService } from '../platform/settings.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { levelFor, remainingByCredit } from './allocation.ts';

type Tx = Prisma.TransactionClient;
const PAGE = 30;
const DAY = 86_400_000;
const EXPIRY_PREFIX = 'expiry:';
const REVERSE_PREFIX = 'reverse:';

/** Candado por persona: el mismo que usa la reclamación, para que ningún movimiento corra en paralelo con otro. */
const lockUser = (tx: Tx, userId: string) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;

/**
 * Ledger de Puntos ILC (Guía Técnica §5.7). Nunca se edita ni se borra un movimiento (lo impide la base de datos):
 * vencimientos y reversos son movimientos compensatorios con referencia al original, motivo y actor.
 * El saldo en caché se actualiza en la misma transacción y se concilia periódicamente con la suma del ledger.
 */
@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  // ───────── Billetera del titular ─────────

  async wallet(userId: string, cursor: string | undefined, now = new Date()): Promise<Wallet> {
    const currencyName = String(await this.settings.get('economy.currencyName'));
    const account = await this.prisma.ledgerAccount.findUnique({ where: { userId } });
    if (!account) return { balance: 0, currencyName, expiring: null, entries: [], nextCursor: null };

    const page = await this.prisma.ledgerEntry.findMany({
      where: { accountId: account.id },
      orderBy: { id: 'desc' },
      take: PAGE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const visible = page.slice(0, PAGE);
    const describe = await this.describer(visible);
    return {
      balance: account.balance,
      currencyName,
      expiring: await this.expiring(account.id, now),
      entries: visible.map(describe),
      nextCursor: page.length > PAGE ? (visible.at(-1)?.id ?? null) : null,
    };
  }

  /** Próximo vencimiento con saldo sin usar dentro de la ventana de aviso. */
  private async expiring(accountId: string, now: Date): Promise<Wallet['expiring']> {
    const days = Number(await this.settings.get('economy.expiringNoticeDays'));
    const entries = await this.prisma.ledgerEntry.findMany({ where: { accountId } });
    const remaining = remainingByCredit(entries);
    const soon = entries
      .filter((e) => e.type === 'CREDITO' && e.expiresAt && e.expiresAt > now && e.expiresAt.getTime() <= now.getTime() + days * DAY)
      .filter((e) => (remaining.get(e.id) ?? 0) > 0)
      .sort((a, b) => (a.expiresAt as Date).getTime() - (b.expiresAt as Date).getTime());
    const first = soon[0];
    if (!first?.expiresAt) return null;
    const sameDay = soon.filter((e) => e.expiresAt?.toISOString().slice(0, 10) === first.expiresAt?.toISOString().slice(0, 10));
    return { amount: sameDay.reduce((n, e) => n + (remaining.get(e.id) ?? 0), 0), at: first.expiresAt.toISOString() };
  }

  /** Texto visible de cada movimiento. Los motivos internos de un reverso no se muestran al titular. */
  private async describer(entries: LedgerEntry[]): Promise<(e: LedgerEntry) => WalletEntry> {
    const originals = await this.prisma.ledgerEntry.findMany({ where: { id: { in: entries.map((e) => e.originalEntryId).filter((x): x is string => !!x) } } });
    const versionIds = [...entries, ...originals].map((e) => e.campaignVersionId).filter((x): x is string => !!x);
    const versions = await this.prisma.campaignVersion.findMany({ where: { id: { in: versionIds } }, select: { id: true, content: true } });
    const title = (versionId: string | null) => {
      const v = versions.find((x) => x.id === versionId);
      return v ? CampaignDraftSchema.parse(v.content).publicTitle : undefined;
    };
    const base = (e: LedgerEntry): Pick<WalletEntry, 'description' | 'detail'> => {
      if (e.type === 'CREDITO' && e.sourceType === 'claim') return { description: 'Código activado', detail: title(e.campaignVersionId) };
      if (e.type === 'CREDITO') return { description: 'Puntos acreditados', detail: title(e.campaignVersionId) };
      if (e.type === 'DEBITO') return { description: 'Canje de recompensa' };
      return { description: 'Movimiento' };
    };
    return (e) => {
      const original = originals.find((o) => o.id === e.originalEntryId);
      const from = original ? `${base(original).description}${title(original.campaignVersionId) ? ` · ${title(original.campaignVersionId)}` : ''}` : undefined;
      const expiry = e.idempotencyKey.startsWith(EXPIRY_PREFIX);
      const view =
        e.type === 'REVERSO' && e.sourceType === 'reward_refund'
          ? { kind: 'reversal' as const, description: 'Devolución de canje', detail: e.reason ?? undefined }
          : e.type === 'REVERSO'
            ? { kind: 'reversal' as const, description: 'Reverso auditado', detail: from }
            : expiry
              ? { kind: 'expiry' as const, description: 'Vencimiento de puntos', detail: from }
              : e.type === 'AJUSTE'
                ? { kind: 'adjustment' as const, description: 'Ajuste auditado', detail: from }
                : { kind: e.type === 'DEBITO' ? ('debit' as const) : ('credit' as const), ...base(e) };
      return { id: e.id, amount: e.amount, at: e.createdAt.toISOString(), expiresAt: e.expiresAt?.toISOString() ?? null, ...view };
    };
  }

  // ───────── Vencimientos ─────────

  /**
   * Vence lo que queda sin usar de los créditos cuya vigencia terminó (§5.7). Idempotente: cada crédito vence una
   * sola vez (clave `expiry:{id}` única por cuenta). La expiración del Parche NO vence el saldo individual.
   */
  async expireDue(now = new Date()): Promise<{ accounts: number; expired: number; points: number }> {
    const candidates = await this.prisma.$queryRaw<Array<{ accountId: string; userId: string }>>`
      SELECT DISTINCT a.id AS "accountId", a."userId"
      FROM ledger_accounts a JOIN ledger_entries c ON c."accountId" = a.id
      WHERE a.balance > 0 AND a."userId" IS NOT NULL AND c.type = 'CREDITO' AND c."expiresAt" <= ${now}
        AND NOT EXISTS (SELECT 1 FROM ledger_entries x WHERE x."accountId" = a.id AND x."idempotencyKey" = 'expiry:' || c.id::text)`;
    let expired = 0;
    let points = 0;
    for (const { accountId, userId } of candidates) {
      const r = await this.prisma.$transaction(async (tx) => {
        await lockUser(tx, userId);
        const entries = await tx.ledgerEntry.findMany({ where: { accountId } });
        const remaining = remainingByCredit(entries);
        const done = new Set(entries.filter((e) => e.idempotencyKey.startsWith(EXPIRY_PREFIX)).map((e) => e.originalEntryId));
        let count = 0;
        let total = 0;
        for (const c of entries) {
          if (c.type !== 'CREDITO' || !c.expiresAt || c.expiresAt > now || done.has(c.id)) continue;
          const left = remaining.get(c.id) ?? 0;
          if (left <= 0) continue;
          await tx.ledgerEntry.create({
            data: {
              accountId,
              type: 'AJUSTE',
              amount: -left,
              campaignVersionId: c.campaignVersionId,
              ruleId: 'pointsExpiryDays',
              sourceType: 'expiry',
              sourceId: c.id,
              originalEntryId: c.id,
              reason: 'Vencimiento de puntos según la vigencia de la campaña',
              idempotencyKey: `${EXPIRY_PREFIX}${c.id}`,
            },
          });
          count++;
          total += left;
        }
        if (total > 0) {
          await tx.ledgerAccount.update({ where: { id: accountId }, data: { balance: { decrement: total } } });
          await this.audit.record(
            { actorId: null, action: 'ledger.points_expired', resource: 'ledger_account', resourceId: accountId, metadata: { entries: count, points: total } },
            tx,
          );
        }
        return { count, total };
      });
      expired += r.count;
      points += r.total;
    }
    return { accounts: candidates.length, expired, points };
  }

  // ───────── Reversos (consola) ─────────

  /**
   * Reverso auditado de un crédito (§5.7 regla 3, §9.1): descuenta solo lo que sigue sin usar, exige motivo,
   * queda ligado al original y no se puede repetir. Quien reversa no puede ser el titular de la cuenta.
   */
  async reverse(actor: Actor, entryId: string, reason: string): Promise<AdminAccount> {
    const entry = await this.prisma.ledgerEntry.findUnique({ where: { id: entryId }, include: { account: true } });
    if (!entry) throw new DomainError('NOT_FOUND', 'No existe ese movimiento.');
    if (entry.type !== 'CREDITO') throw new DomainError('CONFLICT', 'Solo se reversan créditos.');
    const userId = entry.account.userId;
    if (!userId) throw new DomainError('CONFLICT', 'Los saldos del Parche se gestionan en su sesión.');
    if (userId === actor.userId) throw new DomainError('FORBIDDEN', 'No puedes reversar movimientos de tu propia cuenta.');
    try {
      await this.prisma.$transaction(async (tx) => {
        await lockUser(tx, userId);
        const entries = await tx.ledgerEntry.findMany({ where: { accountId: entry.accountId } });
        if (entries.some((e) => e.idempotencyKey === `${REVERSE_PREFIX}${entry.id}`)) throw new DomainError('CONFLICT', 'Este movimiento ya fue reversado.');
        const left = remainingByCredit(entries).get(entry.id) ?? 0;
        if (left <= 0) throw new DomainError('CONFLICT', 'No queda saldo de este movimiento: ya se usó o venció.');
        const created = await tx.ledgerEntry.create({
          data: {
            accountId: entry.accountId,
            type: 'REVERSO',
            amount: -left,
            campaignVersionId: entry.campaignVersionId,
            sourceType: 'reversal',
            sourceId: entry.id,
            originalEntryId: entry.id,
            reason,
            actorId: actor.userId,
            idempotencyKey: `${REVERSE_PREFIX}${entry.id}`,
          },
        });
        await tx.ledgerAccount.update({ where: { id: entry.accountId }, data: { balance: { decrement: left } } });
        await this.audit.record(
          {
            actorId: actor.userId,
            action: 'ledger.reversed',
            resource: 'ledger_entry',
            resourceId: entry.id,
            requestId: actor.requestId,
            reason,
            metadata: { reversalId: created.id, amount: left, originalAmount: entry.amount, accountUserId: userId },
          },
          tx,
        );
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new DomainError('CONFLICT', 'Este movimiento ya fue reversado.');
      throw err;
    }
    return this.account({ userId });
  }

  // ───────── Consulta de consola ─────────

  async account(by: { claimId: string } | { userId: string }): Promise<AdminAccount> {
    const userId = 'userId' in by ? by.userId : (await this.prisma.claim.findUnique({ where: { id: by.claimId }, select: { userId: true } }))?.userId;
    const user = userId ? await this.prisma.user.findUnique({ where: { id: userId } }) : null;
    if (!user) throw new DomainError('NOT_FOUND', 'No encontramos esa cuenta.');
    const account = await this.prisma.ledgerAccount.findUnique({ where: { userId: user.id } });
    const entries = account ? await this.prisma.ledgerEntry.findMany({ where: { accountId: account.id }, orderBy: { id: 'desc' } }) : [];
    const remaining = remainingByCredit(entries);
    const compensated = new Set(entries.map((e) => e.originalEntryId).filter(Boolean));
    const describe = await this.describer(entries);
    const xp = (await this.prisma.xpEntry.aggregate({ where: { userId: user.id }, _sum: { amount: true } }))._sum.amount ?? 0;
    const levels = XpLevelsSchema.parse(await this.settings.get('economy.xpLevels'));
    return {
      userId: user.id,
      alias: user.alias,
      status: user.status,
      balance: account?.balance ?? 0,
      ledgerSum: entries.reduce((n, e) => n + e.amount, 0),
      xp,
      level: levelFor(xp, levels).number,
      entries: entries.map((e) => ({
        ...describe(e),
        type: e.type,
        remaining: e.type === 'CREDITO' ? (remaining.get(e.id) ?? 0) : null,
        compensated: compensated.has(e.id),
        reason: e.reason,
        sourceType: e.sourceType,
        sourceId: e.sourceId,
      })),
    };
  }

  // ───────── Conciliación ─────────

  /** Compara el saldo en caché con la suma del ledger. Una diferencia es un incidente de severidad ALTA (§12.2). */
  async reconcile(now = new Date()): Promise<Reconciliation> {
    const rows = await this.prisma.$queryRaw<Array<{ userId: string | null; balance: number; ledgerSum: bigint }>>`
      SELECT a."userId", a.balance, COALESCE(SUM(e.amount), 0) AS "ledgerSum"
      FROM ledger_accounts a LEFT JOIN ledger_entries e ON e."accountId" = a.id
      GROUP BY a.id`;
    const mismatches = rows
      .filter((r) => Number(r.ledgerSum) !== r.balance)
      .map((r) => ({ userId: r.userId, balance: r.balance, ledgerSum: Number(r.ledgerSum) }));
    if (mismatches.length) {
      await this.prisma.securityEvent.create({ data: { type: 'ledger.reconciliation_mismatch', severity: 'ALTA', metadata: { mismatches } } });
    }
    return { checkedAccounts: rows.length, mismatches, checkedAt: now.toISOString() };
  }
}
