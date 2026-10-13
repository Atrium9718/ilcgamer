import { createHash, randomBytes } from 'node:crypto';
import {
  type AdminEntry,
  type ContestAdminSummary,
  type ContestAdminView,
  type ContestEntryView,
  type ContestPhase,
  type ContestScreen,
  type ContestView,
  type CreateContest,
  type CreateEvent,
  ENTRY_PHOTO_GUIDELINES,
  type EventAdminView,
  type ModerateEntry,
  type PublicEvent,
  type UpsertEntry,
} from '@ilc/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service.ts';
import { AuditService } from '../audit/audit.service.ts';
import type { Actor } from '../campaigns/campaigns.service.ts';
import { DomainError } from '../common/domain-error.ts';
import { ENV } from '../config/config.module.ts';
import { type Env, separationOfDutiesApplies } from '../config/env.ts';
import type { Contest, ContestEntry, Event, User } from '../generated/prisma/client.ts';
import { Prisma } from '../generated/prisma/client.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { sanitizeJpeg } from './jpeg.ts';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SCREEN_TOKEN = /^[A-Za-z0-9_-]{20,40}$/;

const newCode = (len = 8): string => Array.from(randomBytes(len), (b) => ALPHABET[b % 32]).join('');
const newScreenToken = (): string => randomBytes(18).toString('base64url');
const sortKey = (userId: string, id: string): string => createHash('sha256').update(`${userId}:${id}`).digest('hex');
const iso = (d: Date): string => d.toISOString();

/** Fase del concurso: la calcula el servidor con sus fechas; nadie la elige desde el cliente. */
export function phaseOf(c: Pick<Contest, 'status' | 'uploadsCloseAt' | 'votingOpensAt' | 'votingClosesAt'>, now = new Date()): ContestPhase {
  if (c.status === 'BORRADOR') return 'PROXIMAMENTE';
  if (c.status === 'CERRADO' || now >= c.votingClosesAt) return 'TERMINADO';
  if (now >= c.votingOpensAt) return 'VOTACION';
  if (now < c.uploadsCloseAt) return 'INSCRIPCION';
  return 'ENTRE_FASES';
}

type ContestWithEvent = Contest & { event: Event };

/**
 * Eventos y concursos (concurso de disfraces). El servidor decide: fases por fecha, un voto por cuenta, nadie vota por sí mismo,
 * moderación previa de toda foto y desempate determinista (más votos; si empatan, quien se inscribió primero).
 * Votar y concursar NO emite Puntos ILC ni XP: el premio se entrega en persona con un código.
 */
@Injectable()
export class EventsService {
  private readonly screenCache = new Map<string, { at: number; value: ContestScreen }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly analytics: AnalyticsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ───────────────────────── Persona ─────────────────────────

  async listPublic(now = new Date()): Promise<PublicEvent[]> {
    const events = await this.prisma.event.findMany({
      where: { status: 'PUBLICADO', endsAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } },
      orderBy: { startsAt: 'asc' },
      include: { contests: { where: { status: { in: ['ABIERTO', 'CERRADO'] } }, orderBy: { createdAt: 'asc' } } },
    });
    return events.map((e) => ({
      slug: e.slug,
      title: e.title,
      description: e.description,
      city: e.city,
      startsAt: iso(e.startsAt),
      endsAt: iso(e.endsAt),
      contests: e.contests.map((c) => ({ id: c.id, title: c.title, prize: c.prize, kind: c.kind, phase: phaseOf(c, now) })),
    }));
  }

  async publicEvent(slug: string, now = new Date()): Promise<PublicEvent> {
    const found = (await this.listPublic(now)).find((e) => e.slug === slug);
    if (!found) throw new DomainError('NOT_FOUND', 'No encontramos ese evento.');
    return found;
  }

  private async visibleContest(id: string): Promise<ContestWithEvent> {
    const c = await this.prisma.contest.findUnique({ where: { id }, include: { event: true } });
    if (!c || c.status === 'BORRADOR' || c.event.status !== 'PUBLICADO') throw new DomainError('CONTEST_NOT_AVAILABLE', 'Este concurso no está disponible.');
    return c;
  }

  private photoUrl(contestId: string, entryId: string, hasPhoto: boolean): string | null {
    return hasPhoto ? `/api/v1/contests/${contestId}/entries/${entryId}/photo` : null;
  }

  async contestFor(user: User, id: string, now = new Date()): Promise<ContestView> {
    const c = await this.visibleContest(id);
    const phase = phaseOf(c, now);
    const [rows, vote] = await Promise.all([
      this.prisma.contestEntry.findMany({
        where: { contestId: id, OR: [{ status: 'APROBADA' }, { userId: user.id }] },
        include: { user: { select: { alias: true } }, photo: { select: { entryId: true } } },
      }),
      this.prisma.contestVote.findUnique({ where: { contestId_userId: { contestId: id, userId: user.id } } }),
    ]);
    const view = (e: (typeof rows)[number]): ContestEntryView => {
      const mine = e.userId === user.id;
      return {
        id: e.id,
        title: e.title,
        caption: e.caption,
        alias: e.user.alias,
        mine,
        photoUrl: this.photoUrl(id, e.id, !!e.photo),
        ...(mine ? { status: e.status, rejectionReason: e.rejectionReason } : {}),
      };
    };
    const mineRow = rows.find((e) => e.userId === user.id);
    // Orden estable por persona y distinto entre personas: ninguna inscripción queda siempre primera.
    const approved = rows.filter((e) => e.status === 'APROBADA').sort((a, b) => (sortKey(user.id, a.id) < sortKey(user.id, b.id) ? -1 : 1));
    let winner: ContestView['winner'] = null;
    if (c.winnerEntryId) {
      const w = await this.prisma.contestEntry.findUnique({
        where: { id: c.winnerEntryId },
        include: { user: { select: { alias: true } }, photo: { select: { entryId: true } } },
      });
      if (w) winner = { entryId: w.id, alias: w.user.alias, title: w.title, photoUrl: this.photoUrl(id, w.id, !!w.photo) };
    }
    const wonByMe = !!c.winnerEntryId && mineRow?.id === c.winnerEntryId;
    return {
      id: c.id,
      eventSlug: c.event.slug,
      eventTitle: c.event.title,
      slug: c.slug,
      kind: c.kind,
      title: c.title,
      description: c.description,
      prize: c.prize,
      prizeConditions: c.prizeConditions,
      phase,
      uploadsCloseAt: iso(c.uploadsCloseAt),
      votingOpensAt: iso(c.votingOpensAt),
      votingClosesAt: iso(c.votingClosesAt),
      guidelines: [...ENTRY_PHOTO_GUIDELINES],
      entries: approved.map(view),
      myEntry: mineRow ? view(mineRow) : null,
      votedEntryId: vote?.entryId ?? null,
      prizeCode: wonByMe ? c.winnerCode : null,
      winner,
    };
  }

  private requireAccount(user: User): void {
    if (user.status !== 'ACTIVA') throw new DomainError('ACCOUNT_REQUIRED', 'Guarda tu progreso con tu número o correo para participar.');
  }

  async upsertEntry(user: User, id: string, input: UpsertEntry, now = new Date()): Promise<ContestView> {
    this.requireAccount(user);
    const c = await this.visibleContest(id);
    if (phaseOf(c, now) !== 'INSCRIPCION') throw new DomainError('CONTEST_PHASE_CLOSED', 'La inscripción de este concurso ya cerró.');
    const existing = await this.prisma.contestEntry.findUnique({ where: { contestId_userId: { contestId: id, userId: user.id } } });
    const data = {
      title: input.title,
      caption: input.caption,
      consentDisplayAt: now,
      status: 'PENDIENTE' as const,
      rejectionReason: null,
      moderatedById: null,
      moderatedAt: null,
    };
    if (existing) {
      // Editar vuelve la inscripción a moderación y libera los votos que tenía (no se vota por algo que cambió).
      await this.prisma.$transaction([
        this.prisma.contestVote.deleteMany({ where: { entryId: existing.id } }),
        this.prisma.contestEntry.update({ where: { id: existing.id }, data }),
      ]);
    } else await this.prisma.contestEntry.create({ data: { contestId: id, userId: user.id, ...data } });
    await this.analytics.emit('contest_entry_submitted', { channel: 'EVENTO', properties: { kind: c.kind } });
    return this.contestFor(user, id, now);
  }

  async putPhoto(user: User, id: string, body: unknown, now = new Date()): Promise<ContestView> {
    this.requireAccount(user);
    const c = await this.visibleContest(id);
    if (phaseOf(c, now) !== 'INSCRIPCION') throw new DomainError('CONTEST_PHASE_CLOSED', 'La inscripción de este concurso ya cerró.');
    const entry = await this.prisma.contestEntry.findUnique({ where: { contestId_userId: { contestId: id, userId: user.id } } });
    if (!entry) throw new DomainError('NOT_FOUND', 'Primero registra el título de tu disfraz.');
    if (!Buffer.isBuffer(body)) throw new DomainError('VALIDATION_FAILED', 'Envía la foto como imagen JPEG.');
    const clean = sanitizeJpeg(body);
    if (!clean) throw new DomainError('VALIDATION_FAILED', 'La foto debe ser una imagen JPEG válida, de al menos 200 px por lado.');
    const sha256 = createHash('sha256').update(clean.data).digest('hex');
    await this.prisma.$transaction(async (tx) => {
      await tx.entryPhoto.upsert({
        where: { entryId: entry.id },
        update: { data: new Uint8Array(clean.data), bytes: clean.data.length, sha256 },
        create: { entryId: entry.id, data: new Uint8Array(clean.data), bytes: clean.data.length, sha256 },
      });
      // Una foto nueva vuelve a moderación y retira los votos que había recibido la anterior.
      await tx.contestVote.deleteMany({ where: { entryId: entry.id } });
      await tx.contestEntry.update({ where: { id: entry.id }, data: { status: 'PENDIENTE', rejectionReason: null, moderatedById: null, moderatedAt: null } });
    });
    return this.contestFor(user, id, now);
  }

  async withdraw(user: User, id: string, now = new Date()): Promise<void> {
    const c = await this.visibleContest(id);
    if (phaseOf(c, now) === 'TERMINADO') throw new DomainError('CONTEST_PHASE_CLOSED', 'El concurso ya terminó.');
    await this.prisma.contestEntry.deleteMany({ where: { contestId: id, userId: user.id } });
  }

  async photoFor(user: User, contestId: string, entryId: string): Promise<{ data: Buffer; sha256: string }> {
    await this.visibleContest(contestId);
    const e = await this.prisma.contestEntry.findFirst({
      where: { id: entryId, contestId, OR: [{ status: 'APROBADA' }, { userId: user.id }] },
      include: { photo: true },
    });
    if (!e?.photo) throw new DomainError('NOT_FOUND', 'No encontramos esa foto.');
    return { data: Buffer.from(e.photo.data), sha256: e.photo.sha256 };
  }

  async vote(user: User, contestId: string, entryId: string, now = new Date()): Promise<ContestView> {
    this.requireAccount(user);
    const c = await this.visibleContest(contestId);
    if (phaseOf(c, now) !== 'VOTACION') throw new DomainError('CONTEST_PHASE_CLOSED', 'La votación no está abierta en este momento.');
    const entry = await this.prisma.contestEntry.findFirst({ where: { id: entryId, contestId, status: 'APROBADA' } });
    if (!entry) throw new DomainError('NOT_FOUND', 'No encontramos esa inscripción.');
    if (entry.userId === user.id) throw new DomainError('FORBIDDEN', 'No puedes votar por tu propio disfraz.');
    try {
      await this.prisma.contestVote.create({ data: { contestId, entryId, userId: user.id } });
      await this.analytics.emit('contest_vote_cast', { channel: 'EVENTO', properties: { kind: c.kind } });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
      const prior = await this.prisma.contestVote.findUnique({ where: { contestId_userId: { contestId, userId: user.id } } });
      // Repetir el mismo voto es idempotente; votar por otra inscripción no se permite (un voto por cuenta).
      if (prior?.entryId !== entryId) throw new DomainError('CONFLICT', 'Ya votaste en este concurso. Solo hay un voto por persona.');
    }
    return this.contestFor(user, contestId, now);
  }

  // ───────────────────────── Consola ─────────────────────────

  private async summarize(c: Contest, now: Date): Promise<ContestAdminSummary> {
    const [entries, pending, votes] = await Promise.all([
      this.prisma.contestEntry.count({ where: { contestId: c.id } }),
      this.prisma.contestEntry.count({ where: { contestId: c.id, status: 'PENDIENTE' } }),
      this.prisma.contestVote.count({ where: { contestId: c.id } }),
    ]);
    return {
      id: c.id,
      slug: c.slug,
      kind: c.kind,
      title: c.title,
      prize: c.prize,
      status: c.status,
      phase: phaseOf(c, now),
      uploadsCloseAt: iso(c.uploadsCloseAt),
      votingOpensAt: iso(c.votingOpensAt),
      votingClosesAt: iso(c.votingClosesAt),
      entries,
      pending,
      votes,
    };
  }

  async listAdmin(now = new Date()): Promise<EventAdminView[]> {
    const events = await this.prisma.event.findMany({ orderBy: { startsAt: 'desc' }, include: { contests: { orderBy: { createdAt: 'asc' } } } });
    return Promise.all(
      events.map(async (e) => ({
        id: e.id,
        slug: e.slug,
        title: e.title,
        description: e.description,
        city: e.city,
        status: e.status,
        startsAt: iso(e.startsAt),
        endsAt: iso(e.endsAt),
        contests: await Promise.all(e.contests.map((c) => this.summarize(c, now))),
      })),
    );
  }

  async createEvent(actor: Actor, input: CreateEvent): Promise<EventAdminView> {
    try {
      const e = await this.prisma.$transaction(async (tx) => {
        const created = await tx.event.create({
          data: { ...input, startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt), createdById: actor.userId },
        });
        await this.audit.record(
          {
            actorId: actor.userId,
            action: 'event.created',
            resource: 'event',
            resourceId: created.id,
            requestId: actor.requestId,
            metadata: { slug: created.slug },
          },
          tx,
        );
        return created;
      });
      return (await this.listAdmin()).find((x) => x.id === e.id) as EventAdminView;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
        throw new DomainError('CONFLICT', 'Ya existe un evento con ese identificador.');
      throw err;
    }
  }

  async setEventStatus(actor: Actor, id: string, status: 'PUBLICADO' | 'CERRADO'): Promise<EventAdminView> {
    const e = await this.prisma.event.findUnique({ where: { id } });
    if (!e) throw new DomainError('NOT_FOUND', 'No existe ese evento.');
    if (status === 'PUBLICADO' && e.status === 'CERRADO') throw new DomainError('CONFLICT', 'Un evento cerrado no se vuelve a publicar.');
    await this.prisma.$transaction(async (tx) => {
      await tx.event.update({ where: { id }, data: { status } });
      await this.audit.record(
        {
          actorId: actor.userId,
          action: status === 'PUBLICADO' ? 'event.published' : 'event.closed',
          resource: 'event',
          resourceId: id,
          requestId: actor.requestId,
        },
        tx,
      );
    });
    return (await this.listAdmin()).find((x) => x.id === id) as EventAdminView;
  }

  async createContest(actor: Actor, eventId: string, input: CreateContest): Promise<ContestAdminView> {
    const e = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!e) throw new DomainError('NOT_FOUND', 'No existe ese evento.');
    try {
      const c = await this.prisma.$transaction(async (tx) => {
        const created = await tx.contest.create({
          data: {
            eventId,
            slug: input.slug,
            kind: input.kind,
            title: input.title,
            description: input.description,
            prize: input.prize,
            prizeConditions: input.prizeConditions,
            uploadsCloseAt: new Date(input.uploadsCloseAt),
            votingOpensAt: new Date(input.votingOpensAt),
            votingClosesAt: new Date(input.votingClosesAt),
            screenToken: newScreenToken(),
            createdById: actor.userId,
          },
        });
        await this.audit.record(
          {
            actorId: actor.userId,
            action: 'contest.created',
            resource: 'contest',
            resourceId: created.id,
            requestId: actor.requestId,
            metadata: { slug: created.slug },
          },
          tx,
        );
        return created;
      });
      return this.adminContest(c.id);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
        throw new DomainError('CONFLICT', 'Ya existe un concurso con ese identificador en este evento.');
      throw err;
    }
  }

  async adminContest(id: string, now = new Date()): Promise<ContestAdminView> {
    const c = await this.prisma.contest.findUnique({ where: { id }, include: { event: true } });
    if (!c) throw new DomainError('NOT_FOUND', 'No existe ese concurso.');
    const [summary, entries, counts] = await Promise.all([
      this.summarize(c, now),
      this.prisma.contestEntry.findMany({
        where: { contestId: id },
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { alias: true } }, photo: { select: { entryId: true } } },
      }),
      this.prisma.contestVote.groupBy({ by: ['entryId'], where: { contestId: id }, _count: { _all: true } }),
    ]);
    const votes = new Map(counts.map((r) => [r.entryId, r._count._all]));
    const list: AdminEntry[] = entries.map((e) => ({
      id: e.id,
      alias: e.user.alias,
      title: e.title,
      caption: e.caption,
      status: e.status,
      rejectionReason: e.rejectionReason,
      hasPhoto: !!e.photo,
      votes: votes.get(e.id) ?? 0,
      createdAt: iso(e.createdAt),
    }));
    const w = c.winnerEntryId ? list.find((e) => e.id === c.winnerEntryId) : undefined;
    return {
      ...summary,
      eventSlug: c.event.slug,
      eventTitle: c.event.title,
      description: c.description,
      prizeConditions: c.prizeConditions,
      screenPath: `/pantalla/${c.screenToken}`,
      entriesList: list,
      winner: w ? { entryId: w.id, alias: w.alias, title: w.title, votes: w.votes, deliveredAt: c.prizeDeliveredAt ? iso(c.prizeDeliveredAt) : null } : null,
    };
  }

  async openContest(actor: Actor, id: string): Promise<ContestAdminView> {
    const c = await this.prisma.contest.findUnique({ where: { id } });
    if (!c) throw new DomainError('NOT_FOUND', 'No existe ese concurso.');
    if (c.status !== 'BORRADOR') throw new DomainError('CONFLICT', 'El concurso ya está abierto o cerrado.');
    // Separación de funciones: quien define el concurso y su premio no lo abre.
    if (separationOfDutiesApplies(this.env) && c.createdById === actor.userId)
      throw new DomainError('FORBIDDEN', 'Quien creó el concurso no puede abrirlo: pide a otra persona de Marca.');
    if (c.votingClosesAt <= new Date()) throw new DomainError('CONFLICT', 'Las fechas del concurso ya pasaron.');
    await this.prisma.$transaction(async (tx) => {
      await tx.contest.update({ where: { id }, data: { status: 'ABIERTO', openedById: actor.userId } });
      await this.audit.record({ actorId: actor.userId, action: 'contest.opened', resource: 'contest', resourceId: id, requestId: actor.requestId }, tx);
    });
    return this.adminContest(id);
  }

  async moderate(actor: Actor, contestId: string, entryId: string, input: ModerateEntry, now = new Date()): Promise<ContestAdminView> {
    const c = await this.prisma.contest.findUnique({ where: { id: contestId } });
    const entry = await this.prisma.contestEntry.findFirst({ where: { id: entryId, contestId }, include: { photo: { select: { entryId: true } } } });
    if (!c || !entry) throw new DomainError('NOT_FOUND', 'No existe esa inscripción.');
    if (phaseOf(c, now) === 'TERMINADO') throw new DomainError('CONTEST_PHASE_CLOSED', 'El concurso ya terminó.');
    if (input.decision === 'APROBADA' && !entry.photo) throw new DomainError('CONFLICT', 'No se puede aprobar una inscripción sin foto.');
    await this.prisma.$transaction(async (tx) => {
      await tx.contestEntry.update({
        where: { id: entryId },
        data: {
          status: input.decision,
          rejectionReason: input.decision === 'RECHAZADA' ? (input.reason ?? null) : null,
          moderatedById: actor.userId,
          moderatedAt: now,
        },
      });
      // Si se rechaza una inscripción que ya tenía votos, esos votos se liberan para que quienes votaron puedan elegir de nuevo.
      const freed = input.decision === 'RECHAZADA' ? (await tx.contestVote.deleteMany({ where: { entryId } })).count : 0;
      await this.audit.record(
        {
          actorId: actor.userId,
          action: input.decision === 'APROBADA' ? 'contest.entry_approved' : 'contest.entry_rejected',
          resource: 'contest_entry',
          resourceId: entryId,
          requestId: actor.requestId,
          metadata: { contestId, freedVotes: freed },
        },
        tx,
      );
    });
    return this.adminContest(contestId, now);
  }

  async adminPhoto(contestId: string, entryId: string): Promise<{ data: Buffer; sha256: string }> {
    const p = await this.prisma.entryPhoto.findFirst({ where: { entryId, entry: { contestId } } });
    if (!p) throw new DomainError('NOT_FOUND', 'No encontramos esa foto.');
    return { data: Buffer.from(p.data), sha256: p.sha256 };
  }

  async rotateScreen(actor: Actor, id: string): Promise<ContestAdminView> {
    const c = await this.prisma.contest.findUnique({ where: { id } });
    if (!c) throw new DomainError('NOT_FOUND', 'No existe ese concurso.');
    await this.prisma.$transaction(async (tx) => {
      await tx.contest.update({ where: { id }, data: { screenToken: newScreenToken() } });
      await this.audit.record({ actorId: actor.userId, action: 'contest.screen_rotated', resource: 'contest', resourceId: id, requestId: actor.requestId }, tx);
    });
    this.screenCache.delete(c.screenToken);
    return this.adminContest(id);
  }

  /** Resultado determinista: más votos; si empatan, quien se inscribió primero. Sin votos no hay ganador. */
  private async ranking(
    contestId: string,
  ): Promise<Array<{ entry: ContestEntry & { user: { alias: string }; photo: { sha256: string } | null }; votes: number; rank: number }>> {
    const [entries, counts] = await Promise.all([
      this.prisma.contestEntry.findMany({
        where: { contestId, status: 'APROBADA' },
        include: { user: { select: { alias: true } }, photo: { select: { sha256: true } } },
      }),
      this.prisma.contestVote.groupBy({ by: ['entryId'], where: { contestId }, _count: { _all: true } }),
    ]);
    const votes = new Map(counts.map((r) => [r.entryId, r._count._all]));
    return entries
      .map((entry) => ({ entry, votes: votes.get(entry.id) ?? 0 }))
      .sort((a, b) => b.votes - a.votes || a.entry.createdAt.getTime() - b.entry.createdAt.getTime() || (a.entry.id < b.entry.id ? -1 : 1))
      .map((row, i) => ({ ...row, rank: i + 1 }));
  }

  /** Cierra un concurso cuya votación terminó y fija el ganador. Idempotente. */
  async closeContest(actor: Actor | null, id: string, now = new Date()): Promise<ContestAdminView> {
    const c = await this.prisma.contest.findUnique({ where: { id } });
    if (!c) throw new DomainError('NOT_FOUND', 'No existe ese concurso.');
    if (c.status === 'CERRADO') return this.adminContest(id, now);
    if (c.status !== 'ABIERTO') throw new DomainError('CONFLICT', 'Solo se cierra un concurso abierto.');
    if (now < c.votingClosesAt) throw new DomainError('CONFLICT', 'La votación todavía no termina.');
    const ranking = await this.ranking(id);
    const top = ranking[0];
    const winner = top && top.votes > 0 ? top : undefined;
    const tie = !!winner && ranking.filter((r) => r.votes === winner.votes).length > 1;
    await this.prisma.$transaction(async (tx) => {
      await tx.contest.update({
        where: { id },
        data: { status: 'CERRADO', closedAt: now, winnerEntryId: winner?.entry.id ?? null, winnerCode: winner ? newCode() : null },
      });
      await this.audit.record(
        {
          actorId: actor?.userId ?? null,
          action: 'contest.closed',
          resource: 'contest',
          resourceId: id,
          requestId: actor?.requestId,
          metadata: { winnerEntryId: winner?.entry.id ?? null, votes: winner?.votes ?? 0, tieBrokenByRegistration: tie },
        },
        tx,
      );
    });
    return this.adminContest(id, now);
  }

  /** Cierre automático de los concursos cuya votación ya terminó (lo llama el programador). */
  async tick(now = new Date()): Promise<number> {
    const due = await this.prisma.contest.findMany({ where: { status: 'ABIERTO', votingClosesAt: { lte: now } }, select: { id: true } });
    for (const c of due) await this.closeContest(null, c.id, now);
    return due.length;
  }

  async deliverPrize(actor: Actor, id: string, code: string): Promise<ContestAdminView> {
    const c = await this.prisma.contest.findUnique({ where: { id }, include: { winnerEntry: true } });
    if (!c || c.status !== 'CERRADO' || !c.winnerEntry || !c.winnerCode) throw new DomainError('CONFLICT', 'Este concurso no tiene un ganador por entregar.');
    if (c.prizeDeliveredAt) throw new DomainError('CONFLICT', 'El premio ya se entregó.');
    if (c.winnerCode !== code.trim().toUpperCase()) throw new DomainError('VALIDATION_FAILED', 'El código no corresponde al ganador.');
    if (c.winnerEntry.userId === actor.userId) throw new DomainError('FORBIDDEN', 'No puedes registrar tu propia entrega.');
    await this.prisma.$transaction(async (tx) => {
      await tx.contest.update({ where: { id }, data: { prizeDeliveredAt: new Date(), prizeDeliveredById: actor.userId } });
      await this.audit.record(
        { actorId: actor.userId, action: 'contest.prize_delivered', resource: 'contest', resourceId: id, requestId: actor.requestId },
        tx,
      );
    });
    return this.adminContest(id);
  }

  // ───────────────────────── Pantalla pública ─────────────────────────

  private async contestByToken(token: string): Promise<ContestWithEvent> {
    if (!SCREEN_TOKEN.test(token)) throw new DomainError('NOT_FOUND', 'No encontramos esta pantalla.');
    const c = await this.prisma.contest.findUnique({ where: { screenToken: token }, include: { event: true } });
    if (!c || c.status === 'BORRADOR' || c.event.status !== 'PUBLICADO') throw new DomainError('NOT_FOUND', 'No encontramos esta pantalla.');
    return c;
  }

  /** Estado para proyectar. Sin sesión: solo alias, título, foto aprobada y conteos (nunca datos de contacto). */
  async screen(token: string, now = new Date()): Promise<ContestScreen> {
    const cached = this.screenCache.get(token);
    if (cached && this.env.NODE_ENV !== 'test' && now.getTime() - cached.at < 2000) return cached.value;
    const c = await this.contestByToken(token);
    const ranking = await this.ranking(c.id);
    const total = ranking.reduce((n, r) => n + r.votes, 0);
    const winner = c.winnerEntryId ? ranking.find((r) => r.entry.id === c.winnerEntryId) : undefined;
    const value: ContestScreen = {
      title: c.title,
      eventTitle: c.event.title,
      prize: c.prize,
      phase: phaseOf(c, now),
      votingClosesAt: iso(c.votingClosesAt),
      totalVotes: total,
      entries: ranking.slice(0, 24).map((r) => ({
        id: r.entry.id,
        rank: r.rank,
        title: r.entry.title,
        alias: r.entry.user.alias,
        votes: r.votes,
        photoUrl: r.entry.photo ? `/api/v1/screens/${token}/photos/${r.entry.id}?v=${r.entry.photo.sha256.slice(0, 10)}` : null,
      })),
      winner: winner ? { entryId: winner.entry.id, alias: winner.entry.user.alias, title: winner.entry.title, votes: winner.votes } : null,
      votePath: `/concursos/${c.id}`,
      updatedAt: iso(now),
    };
    this.screenCache.set(token, { at: now.getTime(), value });
    if (this.screenCache.size > 200) this.screenCache.clear();
    return value;
  }

  async screenPhoto(token: string, entryId: string): Promise<{ data: Buffer; sha256: string }> {
    const c = await this.contestByToken(token);
    const e = await this.prisma.contestEntry.findFirst({ where: { id: entryId, contestId: c.id, status: 'APROBADA' }, include: { photo: true } });
    if (!e?.photo) throw new DomainError('NOT_FOUND', 'No encontramos esa foto.');
    return { data: Buffer.from(e.photo.data), sha256: e.photo.sha256 };
  }

  /** Fotos de concursos cerrados hace más de `days` días (retención). Devuelve cuántas se eliminaron. */
  async purgePhotos(before: Date): Promise<number> {
    const r = await this.prisma.entryPhoto.deleteMany({ where: { entry: { contest: { closedAt: { lt: before } } } } });
    return r.count;
  }
}
