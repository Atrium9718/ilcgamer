import { randomBytes } from 'node:crypto';
import {
  type AddPersonnel,
  CampaignDraftSchema,
  type CreateVenue,
  type DealerDashboard,
  type PublicVenue,
  type StaffDashboard,
  type VenueAdminView,
  type VenueProfile,
} from '@ilc/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.ts';
import type { Actor } from '../campaigns/campaigns.service.ts';
import { hmac } from '../common/crypto.ts';
import { DomainError } from '../common/domain-error.ts';
import { ENV } from '../config/config.module.ts';
import type { Env } from '../config/env.ts';
import { Prisma } from '../generated/prisma/client.ts';
import { normalizeDestination } from '../identity/destination.ts';
import { SettingsService } from '../platform/settings.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { venueOfDealer, venueOfStaff } from './venue-access.ts';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const newStaffCode = () => Array.from(randomBytes(8), (b) => ALPHABET[b % 32]).join('');
const DAY = 86_400_000;
const bogotaDay = (d: Date) => new Date(d.getTime() - 5 * 3_600_000).toISOString().slice(0, 10);

const statusOf = (v: { approvedAt: Date | null; suspendedAt: Date | null }) => (v.suspendedAt ? 'SUSPENDIDO' : v.approvedAt ? 'APROBADO' : 'PENDIENTE');

/**
 * Establecimientos, Staff y Dealer (Guía Técnica §5.9). Staff y Dealer solo ven lo suyo y siempre en agregado; un
 * establecimiento solo opera mientras esté aprobado y no suspendido. Aprobar y suspender es de Marca/TI y queda en auditoría.
 */
@Injectable()
export class VenuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ───────────────────────── Administración (Marca / TI) ─────────────────────────

  async list(): Promise<VenueAdminView[]> {
    const venues = await this.prisma.venue.findMany({
      include: { staff: { include: { user: true } }, campaigns: { include: { campaign: { include: { activeVersion: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    const dealerRoles = await this.prisma.userRole.findMany({ where: { role: 'DEALER', scopeId: { in: venues.map((v) => v.id) } }, include: { user: true } });
    return venues.map((v) => ({
      id: v.id,
      name: v.name,
      channel: v.channel,
      city: v.city,
      department: v.department,
      address: v.address,
      status: statusOf(v),
      listed: v.listed,
      personnel: [
        ...v.staff.map((s) => ({ userId: s.userId, alias: s.user.alias, role: 'STAFF' as const, code: s.staffCode, active: s.active })),
        ...dealerRoles
          .filter((r) => r.scopeId === v.id)
          .map((r) => ({ userId: r.userId, alias: r.user.alias, role: 'DEALER' as const, code: null, active: true })),
      ],
      campaigns: v.campaigns.map((c) => ({
        slug: c.campaign.slug,
        title: c.campaign.activeVersion ? CampaignDraftSchema.parse(c.campaign.activeVersion.content).publicTitle : c.campaign.slug,
      })),
    }));
  }

  private async one(id: string): Promise<VenueAdminView> {
    const found = (await this.list()).find((v) => v.id === id);
    if (!found) throw new DomainError('NOT_FOUND', 'No existe ese establecimiento.');
    return found;
  }

  async create(actor: Actor, input: CreateVenue): Promise<VenueAdminView> {
    const venue = await this.prisma.$transaction(async (tx) => {
      const v = await tx.venue.create({
        data: { name: input.name, channel: input.channel, city: input.city, department: input.department, address: input.address },
      });
      await this.audit.record(
        {
          actorId: actor.userId,
          action: 'venue.created',
          resource: 'venue',
          resourceId: v.id,
          requestId: actor.requestId,
          metadata: { name: v.name, city: v.city },
        },
        tx,
      );
      return v;
    });
    return this.one(venue.id);
  }

  /** Aprobar habilita al establecimiento; quien lo registró no es relevante aquí, pero toda aprobación queda auditada. */
  async approve(actor: Actor, id: string): Promise<VenueAdminView> {
    const v = await this.prisma.venue.findUnique({ where: { id } });
    if (!v) throw new DomainError('NOT_FOUND', 'No existe ese establecimiento.');
    await this.prisma.$transaction(async (tx) => {
      await tx.venue.update({ where: { id }, data: { approvedAt: v.approvedAt ?? new Date(), approvedById: actor.userId, suspendedAt: null } });
      await this.audit.record(
        { actorId: actor.userId, action: v.suspendedAt ? 'venue.reinstated' : 'venue.approved', resource: 'venue', resourceId: id, requestId: actor.requestId },
        tx,
      );
    });
    return this.one(id);
  }

  async suspend(actor: Actor, id: string, reason: string): Promise<VenueAdminView> {
    const v = await this.prisma.venue.findUnique({ where: { id } });
    if (!v) throw new DomainError('NOT_FOUND', 'No existe ese establecimiento.');
    await this.prisma.$transaction(async (tx) => {
      await tx.venue.update({ where: { id }, data: { suspendedAt: new Date(), listed: false } });
      await this.audit.record({ actorId: actor.userId, action: 'venue.suspended', resource: 'venue', resourceId: id, requestId: actor.requestId, reason }, tx);
    });
    return this.one(id);
  }

  async linkCampaigns(actor: Actor, id: string, slugs: string[]): Promise<VenueAdminView> {
    const campaigns = await this.prisma.campaign.findMany({ where: { slug: { in: slugs } } });
    const missing = slugs.filter((s) => !campaigns.some((c) => c.slug === s));
    if (missing.length)
      throw new DomainError('VALIDATION_FAILED', 'Hay campañas que no existen.', { fields: { campaignSlugs: [`No existen: ${missing.join(', ')}`] } });
    if (!(await this.prisma.venue.findUnique({ where: { id } }))) throw new DomainError('NOT_FOUND', 'No existe ese establecimiento.');
    await this.prisma.$transaction(async (tx) => {
      await tx.venueCampaign.deleteMany({ where: { venueId: id } });
      await tx.venueCampaign.createMany({ data: campaigns.map((c) => ({ venueId: id, campaignId: c.id })) });
      await this.audit.record(
        {
          actorId: actor.userId,
          action: 'venue.campaigns_linked',
          resource: 'venue',
          resourceId: id,
          requestId: actor.requestId,
          metadata: { campaigns: slugs },
        },
        tx,
      );
    });
    return this.one(id);
  }

  /** Agrega personal por correo. La persona debe haber ingresado antes con ese correo (así existe su cuenta). */
  async addPersonnel(actor: Actor, venueId: string, input: AddPersonnel): Promise<VenueAdminView> {
    if (!(await this.prisma.venue.findUnique({ where: { id: venueId } }))) throw new DomainError('NOT_FOUND', 'No existe ese establecimiento.');
    const email = normalizeDestination('email', input.email);
    const subject = hmac(this.env.APP_SECRET, `email:${email}`);
    const user = await this.prisma.user.findFirst({ where: { credentials: { some: { provider: 'otp:email', subject } } } });
    if (!user) throw new DomainError('NOT_FOUND', 'Esa persona todavía no tiene cuenta: pídele que ingrese primero con ese correo.');
    if (user.status !== 'ACTIVA') throw new DomainError('CONFLICT', 'La cuenta de esa persona no está activa.');
    try {
      await this.prisma.$transaction(async (tx) => {
        if (input.role === 'STAFF') {
          const existing = await tx.staffAccount.findUnique({ where: { userId: user.id } });
          if (existing?.active && existing.venueId !== venueId)
            throw new DomainError('CONFLICT', 'Esa persona ya es Staff de otro establecimiento: retírala primero.');
          await tx.staffAccount.upsert({
            where: { userId: user.id },
            update: { venueId, active: true },
            create: { userId: user.id, venueId, staffCode: newStaffCode() },
          });
        }
        await tx.userRole.upsert({
          where: { userId_role_scopeId: { userId: user.id, role: input.role, scopeId: venueId } },
          update: {},
          create: { userId: user.id, role: input.role, scopeId: venueId },
        });
        await this.audit.record(
          {
            actorId: actor.userId,
            action: 'venue.personnel_added',
            resource: 'venue',
            resourceId: venueId,
            requestId: actor.requestId,
            metadata: { userId: user.id, role: input.role },
          },
          tx,
        );
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new DomainError('CONFLICT', 'Esa persona ya tiene ese rol aquí.');
      throw err;
    }
    return this.one(venueId);
  }

  async removePersonnel(actor: Actor, venueId: string, userId: string): Promise<VenueAdminView> {
    await this.prisma.$transaction(async (tx) => {
      await tx.staffAccount.updateMany({ where: { userId, venueId }, data: { active: false } });
      await tx.userRole.deleteMany({ where: { userId, scopeId: venueId, role: { in: ['STAFF', 'DEALER'] } } });
      await this.audit.record(
        { actorId: actor.userId, action: 'venue.personnel_removed', resource: 'venue', resourceId: venueId, requestId: actor.requestId, metadata: { userId } },
        tx,
      );
    });
    return this.one(venueId);
  }

  // ───────────────────────── Directorio público ─────────────────────────

  async directory(city?: string): Promise<PublicVenue[]> {
    const rows = await this.prisma.venue.findMany({
      where: { listed: true, approvedAt: { not: null }, suspendedAt: null, ...(city ? { city: { equals: city, mode: 'insensitive' } } : {}) },
      orderBy: [{ city: 'asc' }, { name: 'asc' }],
    });
    return rows.map((v) => ({
      id: v.id,
      name: v.name,
      channel: v.channel,
      city: v.city,
      department: v.department,
      address: v.address,
      hours: v.hours,
      description: v.description,
    }));
  }

  // ───────────────────────── Staff ─────────────────────────

  /** Panel del Staff: solo su propia actividad, sin datos de las personas ni de las mesas más allá del nombre del Parche. */
  async staffDashboard(userId: string, now = new Date()): Promise<StaffDashboard> {
    const s = await venueOfStaff(this.prisma, userId);
    if (!s) throw new DomainError('FORBIDDEN', 'Tu cuenta de Staff no está activa.');
    const weekAgo = new Date(now.getTime() - 7 * DAY);
    const claims = await this.prisma.claim.findMany({
      where: { staffUserId: userId, confirmed: true, createdAt: { gte: weekAgo } },
      include: { campaignVersion: true },
      orderBy: { createdAt: 'desc' },
    });
    const today = bogotaDay(now);
    const sessionIds = claims.map((c) => c.sessionId).filter((x): x is string => !!x);
    const sessions = sessionIds.length ? await this.prisma.session.findMany({ where: { id: { in: sessionIds } }, select: { id: true, name: true } }) : [];
    return {
      venue: { name: s.venue.name, city: s.venue.city },
      code: s.account.staffCode,
      qrPath: `/s/${s.account.staffCode}`,
      counts: { today: claims.filter((c) => bogotaDay(c.createdAt) === today).length, week: claims.length },
      weeklyGoal: Number(await this.settings.get('staff.weeklyGoal')),
      recent: claims.slice(0, 10).map((c) => ({
        at: c.createdAt.toISOString(),
        campaignTitle: CampaignDraftSchema.parse(c.campaignVersion.content).publicTitle,
        tableName: sessions.find((x) => x.id === c.sessionId)?.name ?? null,
      })),
    };
  }

  // ───────────────────────── Dealer ─────────────────────────

  async dealerDashboard(userId: string, now = new Date()): Promise<DealerDashboard> {
    const venue = await venueOfDealer(this.prisma, userId);
    if (!venue) throw new DomainError('FORBIDDEN', 'Tu cuenta no está asignada a un establecimiento.');
    const since = new Date(now.getTime() - 30 * DAY);
    const rows = await this.prisma.$queryRaw<Array<{ d: string; n: number }>>`
      SELECT to_char((c."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS d, count(*)::int AS n
      FROM claims c
      WHERE c.confirmed AND c."createdAt" >= ${since}
        AND (c."staffUserId" IN (SELECT "userId" FROM staff_accounts WHERE "venueId" = ${venue.id}::uuid)
          OR c."sessionId" IN (SELECT id FROM sessions WHERE "venueId" = ${venue.id}::uuid))
      GROUP BY 1`;
    const byDay = new Map(rows.map((r) => [r.d, r.n]));
    const days = Array.from({ length: 30 }, (_, i) => bogotaDay(new Date(now.getTime() - (29 - i) * DAY)));
    const series = days.map((date) => ({ date, count: byDay.get(date) ?? 0 }));
    const sum = (n: number) => series.slice(-n).reduce((a, d) => a + d.count, 0);

    let rank: DealerDashboard['rank'] = null;
    if (venue.approvedAt && !venue.suspendedAt) {
      const peers = await this.prisma.$queryRaw<Array<{ id: string; n: number }>>`
        SELECT v.id, count(c.id)::int AS n
        FROM venues v
        LEFT JOIN claims c ON c.confirmed AND c."createdAt" >= ${since}
          AND (c."staffUserId" IN (SELECT "userId" FROM staff_accounts s WHERE s."venueId" = v.id)
            OR c."sessionId" IN (SELECT id FROM sessions WHERE "venueId" = v.id))
        WHERE lower(v.city) = lower(${venue.city}) AND v."approvedAt" IS NOT NULL AND v."suspendedAt" IS NULL
        GROUP BY v.id`;
      const mine = peers.find((p) => p.id === venue.id)?.n ?? 0;
      rank = { position: 1 + peers.filter((p) => p.n > mine).length, total: peers.length, city: venue.city };
    }
    const links = await this.prisma.venueCampaign.findMany({ where: { venueId: venue.id }, include: { campaign: { include: { activeVersion: true } } } });
    return {
      venue: { id: venue.id, name: venue.name, city: venue.city, channel: venue.channel },
      counts: { today: sum(1), week: sum(7), month: sum(30) },
      series: series.slice(-14),
      rank,
      campaigns: links.map((l) => ({
        slug: l.campaign.slug,
        title: l.campaign.activeVersion ? CampaignDraftSchema.parse(l.campaign.activeVersion.content).publicTitle : l.campaign.slug,
      })),
      profile: { description: venue.description, hours: venue.hours, address: venue.address, listed: venue.listed },
    };
  }

  async updateProfile(userId: string, profile: VenueProfile, requestId: string): Promise<DealerDashboard> {
    const venue = await venueOfDealer(this.prisma, userId);
    if (!venue) throw new DomainError('FORBIDDEN', 'Tu cuenta no está asignada a un establecimiento.');
    if (profile.listed && (!venue.approvedAt || venue.suspendedAt))
      throw new DomainError('CONFLICT', 'Solo un establecimiento aprobado puede aparecer en el directorio.');
    await this.prisma.$transaction(async (tx) => {
      await tx.venue.update({
        where: { id: venue.id },
        data: { description: profile.description, hours: profile.hours, address: profile.address, listed: profile.listed },
      });
      await this.audit.record(
        { actorId: userId, action: 'venue.profile_updated', resource: 'venue', resourceId: venue.id, requestId, metadata: { listed: profile.listed } },
        tx,
      );
    });
    return this.dealerDashboard(userId);
  }
}
