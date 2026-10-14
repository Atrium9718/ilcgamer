import type { OptInContacts, Registrations } from '@ilc/contracts';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Personas con cuenta activa cuya última decisión de MARKETING es «sí». Cada consulta se audita (sin los datos). */
  async optIns(actorId: string, requestId: string): Promise<OptInContacts> {
    const latest = await this.prisma.$queryRaw<Array<{ userId: string; granted: boolean; source: string; createdAt: Date }>>`
      SELECT DISTINCT ON ("userId") "userId", granted, source, "createdAt"
      FROM consent_records
      WHERE purpose = 'MARKETING'
      ORDER BY "userId", "createdAt" DESC`;
    const granted = latest.filter((c) => c.granted);
    const users = await this.prisma.user.findMany({
      where: { id: { in: granted.map((g) => g.userId) }, status: 'ACTIVA', deletedAt: null },
      select: { id: true, alias: true, pii: { select: { email: true, phone: true } } },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    const rows = granted
      .flatMap((g) => {
        const u = byId.get(g.userId);
        return u ? [{ alias: u.alias, email: u.pii?.email ?? null, phone: u.pii?.phone ?? null, optedInAt: g.createdAt.toISOString(), source: g.source }] : [];
      })
      .sort((a, b) => b.optedInAt.localeCompare(a.optedInAt));
    await this.audit.record({ actorId, action: 'contacts.listed', resource: 'consent_records', requestId, metadata: { count: rows.length } });
    return { total: rows.length, rows };
  }

  /**
   * Panel de registros: personas que autorizaron el tratamiento de datos (decisión vigente = sí), con su contacto y si aceptaron
   * novedades. Totales, serie por día (hora de Colombia) y filas para descargar. Cada consulta se audita (sin los datos).
   */
  async registrations(actorId: string, requestId: string, days: number, now = new Date()): Promise<Registrations> {
    const latest = await this.prisma.$queryRaw<Array<{ userId: string; purpose: string; granted: boolean; source: string; createdAt: Date }>>`
      SELECT DISTINCT ON ("userId", purpose) "userId", purpose::text AS purpose, granted, source, "createdAt"
      FROM consent_records
      WHERE purpose IN ('TERMINOS_Y_PRIVACIDAD', 'MARKETING')
      ORDER BY "userId", purpose, "createdAt" DESC`;
    const terms = latest.filter((c) => c.purpose === 'TERMINOS_Y_PRIVACIDAD' && c.granted);
    const marketing = new Map(latest.filter((c) => c.purpose === 'MARKETING').map((c) => [c.userId, c]));
    const users = await this.prisma.user.findMany({
      where: { id: { in: terms.map((t) => t.userId) }, status: { not: 'ELIMINADA' }, deletedAt: null },
      select: { id: true, pii: { select: { fullName: true, email: true, phone: true } } },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    const rows = terms
      .flatMap((t) => {
        const u = byId.get(t.userId);
        if (!u) return [];
        const m = marketing.get(t.userId);
        return [
          {
            fullName: u.pii?.fullName ?? null,
            email: u.pii?.email ?? null,
            phone: u.pii?.phone ?? null,
            registeredAt: t.createdAt.toISOString(),
            marketing: m?.granted === true,
            marketingAt: m?.granted ? m.createdAt.toISOString() : null,
            source: t.source,
          },
        ];
      })
      .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt));
    const dayOf = (iso: string) => new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
    const since = new Date(now.getTime() - days * 86_400_000).toISOString();
    const counts = new Map<string, number>();
    for (const r of rows) if (r.registeredAt >= since) counts.set(dayOf(r.registeredAt), (counts.get(dayOf(r.registeredAt)) ?? 0) + 1);
    const byDay = Array.from({ length: days }, (_, i) => {
      const date = dayOf(new Date(now.getTime() - (days - 1 - i) * 86_400_000).toISOString());
      return { date, count: counts.get(date) ?? 0 };
    });
    await this.audit.record({ actorId, action: 'contacts.registrations_listed', resource: 'consent_records', requestId, metadata: { count: rows.length } });
    return {
      days,
      summary: {
        total: rows.length,
        withMarketing: rows.filter((r) => r.marketing).length,
        withEmail: rows.filter((r) => r.email).length,
        withPhone: rows.filter((r) => r.phone).length,
        inPeriod: rows.filter((r) => r.registeredAt >= since).length,
        today: counts.get(dayOf(now.toISOString())) ?? 0,
      },
      byDay,
      rows,
    };
  }
}
