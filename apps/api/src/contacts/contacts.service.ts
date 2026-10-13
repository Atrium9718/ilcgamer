import type { OptInContacts } from '@ilc/contracts';
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
}
