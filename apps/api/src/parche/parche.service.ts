import { CampaignDraftSchema, type CreateParche, type ParcheState, PIN_LOCK_MINUTES, PIN_MAX_FAILURES } from '@ilc/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.ts';
import { isCampaignOpen } from '../campaigns/campaign-state.ts';
import { hmac, randomDigits, safeEqualHex } from '../common/crypto.ts';
import { DomainError } from '../common/domain-error.ts';
import { ENV } from '../config/config.module.ts';
import type { Env } from '../config/env.ts';
import type { User } from '../generated/prisma/client.ts';
import { Prisma } from '../generated/prisma/client.ts';
import { SettingsService } from '../platform/settings.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { RedisService } from '../redis/redis.service.ts';
import { nextLocalTime } from './clock.ts';
import { ParcheBus } from './parche-bus.ts';

type Tx = Prisma.TransactionClient;
const LIVE = ['CREADA', 'ABIERTA', 'EN_CURSO'] as const;
const MIN = 60_000;

/** Candado por persona: crear/unirse/salir no corre en paralelo para la misma persona. */
const lockUser = (tx: Tx, userId: string) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`parche:${userId}`}, 0))`;
const lockSession = (tx: Tx, sessionId: string) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`session:${sessionId}`}, 0))`;

/**
 * El Parche (Guía Técnica §5.5). El servidor es autoritativo: estado, reloj de energía, cierre y marcador viven
 * aquí; los clientes solo reflejan el estado vigente (versión creciente) y nunca reproducen acciones.
 */
@Injectable()
export class ParcheService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly bus: ParcheBus,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ───────── Crear ─────────

  async create(user: User, input: CreateParche, requestId: string, now = new Date()): Promise<ParcheState> {
    if (!user.ageVerifiedAt) throw new DomainError('AGE_GATE_REQUIRED', 'Confirma tu edad para crear un Parche.');
    const origin = await this.origin(user, input, now);
    const single = input.mode === 'UN_DISPOSITIVO';
    const localPlayers = single ? [...new Set((input.localPlayers ?? []).map((p) => p.trim()))] : [];
    const capacity = single ? 1 + localPlayers.length : Number(await this.settings.get('parche.capacity'));
    const closesAt = nextLocalTime(now, origin.endsAtLocalTime);
    const expiresAt = origin.campaignEndsAt && origin.campaignEndsAt < closesAt ? origin.campaignEndsAt : closesAt;
    const energyEndsAt = new Date(Math.min(now.getTime() + origin.energyMinutes * MIN, expiresAt.getTime()));

    for (let attempt = 0; attempt < 20; attempt++) {
      const pin = randomDigits(4);
      try {
        const session = await this.prisma.$transaction(async (tx) => {
          await lockUser(tx, user.id);
          const left = await this.leaveOthers(tx, user.id, now);
          const s = await tx.session.create({
            data: {
              name: input.name.trim(),
              route: origin.route,
              mode: input.mode,
              status: 'ABIERTA',
              hostId: user.id,
              campaignVersionId: origin.campaignVersionId,
              pinLookup: this.pinLookup(pin),
              capacity,
              energyMinutes: origin.energyMinutes,
              energyEndsAt,
              expiresAt,
              localPlayers,
              activations: origin.fromClaim ? 1 : 0,
              participants: { create: { userId: user.id, alias: input.alias.trim() } },
            },
          });
          await this.audit.record(
            {
              actorId: user.id,
              action: 'parche.created',
              resource: 'session',
              resourceId: s.id,
              requestId,
              metadata: { route: s.route, mode: s.mode, campaignVersionId: s.campaignVersionId, fromClaim: origin.fromClaim },
            },
            tx,
          );
          return { s, left };
        });
        for (const id of session.left) void this.bus.publish(id);
        await (await this.kv()).set(this.pinKey(session.s.id), pin, 'PXAT', expiresAt.getTime()).catch(() => undefined);
        return this.state(session.s.id, user.id, pin);
      } catch (err) {
        // PIN repetido entre sesiones vivas (índice único parcial): se genera otro.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
        throw err;
      }
    }
    throw new DomainError('SERVICE_UNAVAILABLE', 'No pudimos generar un PIN libre. Intenta de nuevo.');
  }

  /** Reglas de origen: activación propia (Ruta A), campaña/evento activo, o Parche libre de Ruta B. */
  private async origin(user: User, input: CreateParche, now: Date) {
    const free = {
      route: 'B_EXPERIENCIAL' as const,
      campaignVersionId: null as string | null,
      campaignEndsAt: null as Date | null,
      energyMinutes: Number(await this.settings.get('parche.energyMinutes')),
      endsAtLocalTime: String(await this.settings.get('parche.endsAtLocalTime')),
      fromClaim: false,
    };
    let campaign: Prisma.CampaignGetPayload<{ include: { activeVersion: true } }> | null = null;
    if (input.claimId) {
      const claim = await this.prisma.claim.findUnique({
        where: { id: input.claimId },
        include: { campaignCode: { include: { campaign: { include: { activeVersion: true } } } } },
      });
      if (!claim || claim.userId !== user.id || !claim.confirmed) throw new DomainError('NOT_FOUND', 'No encontramos esa activación.');
      campaign = claim.campaignCode.campaign;
    } else if (input.campaignSlug) {
      campaign = await this.prisma.campaign.findUnique({ where: { slug: input.campaignSlug }, include: { activeVersion: true } });
    } else {
      return free;
    }
    const version = campaign?.activeVersion;
    if (!campaign || !version || !isCampaignOpen(campaign, version, now))
      throw new DomainError('CAMPAIGN_NOT_ACTIVE', 'Esa campaña no está activa en este momento.');
    if (version.minAge > (user.ageVerifiedMinAge ?? 18)) {
      throw new DomainError('AGE_GATE_REQUIRED', `Esta experiencia es solo para mayores de ${version.minAge} años. Confirma tu edad para continuar.`);
    }
    const rules = CampaignDraftSchema.parse(version.content).rules;
    return {
      route: campaign.route,
      campaignVersionId: version.id,
      campaignEndsAt: version.endsAt,
      energyMinutes: rules.energyMinutes,
      endsAtLocalTime: rules.sessionEndsAtLocalTime,
      fromClaim: !!input.claimId,
    };
  }

  // ───────── Unirse ─────────

  /**
   * Unirse con PIN (Instrucciones §3.2). El PIN de 4 dígitos no se adivina: cada persona e IP tiene
   * `PIN_MAX_FAILURES` intentos fallidos por ventana (§5.5, §9.2), además del límite por IP de la ruta.
   */
  async joinByPin(user: User, pin: string, alias: string, ip: string, requestId: string, now = new Date()): Promise<ParcheState> {
    await this.assertNotLocked(user.id, ip);
    const session = await this.prisma.session.findFirst({ where: { pinLookup: this.pinLookup(pin), status: { in: [...LIVE] }, expiresAt: { gt: now } } });
    if (!session) {
      const left = await this.noteFailure(user.id, ip);
      if (left === 0) throw new DomainError('SESSION_PIN_LOCKED', `Demasiados intentos. Espera ${PIN_LOCK_MINUTES} minutos.`);
      throw new DomainError('SESSION_PIN_INVALID', `PIN incorrecto o vencido. Te quedan ${left} ${left === 1 ? 'intento' : 'intentos'}.`);
    }
    await this.clearFailures(user.id);
    return this.join(user, session.id, alias, requestId, now);
  }

  /** Unirse con el QR firmado del anfitrión: solo vale para esa sesión y mientras siga viva (§9.2). */
  async joinByInvite(user: User, sessionId: string, invite: string, alias: string, requestId: string, now = new Date()): Promise<ParcheState> {
    if (!safeEqualHex(this.inviteFor(sessionId), Buffer.from(invite, 'base64url').toString('hex'))) {
      throw new DomainError('SESSION_NOT_FOUND', 'La invitación no es válida o ya venció.');
    }
    return this.join(user, sessionId, alias, requestId, now);
  }

  private async join(user: User, sessionId: string, alias: string, requestId: string, now: Date): Promise<ParcheState> {
    if (!user.ageVerifiedAt) throw new DomainError('AGE_GATE_REQUIRED', 'Confirma tu edad para unirte.');
    const left = await this.prisma.$transaction(async (tx) => {
      await lockUser(tx, user.id);
      await lockSession(tx, sessionId);
      const s = await tx.session.findUnique({ where: { id: sessionId }, include: { participants: true } });
      this.assertLive(s, now);
      if (s.mode === 'UN_DISPOSITIVO') throw new DomainError('CONFLICT', 'Este Parche se juega en un solo celular.');
      if (s.campaignVersionId) {
        const v = await tx.campaignVersion.findUnique({ where: { id: s.campaignVersionId }, select: { minAge: true } });
        if (v && v.minAge > (user.ageVerifiedMinAge ?? 18)) throw new DomainError('AGE_GATE_REQUIRED', `Este Parche es solo para mayores de ${v.minAge} años.`);
      }
      const existing = s.participants.find((p) => p.userId === user.id);
      const active = s.participants.filter((p) => p.status !== 'SALIO').length;
      if (!existing || existing.status === 'SALIO') {
        if (active >= s.capacity) throw new DomainError('CONFLICT', 'El Parche está completo.');
      }
      const others = await this.leaveOthers(tx, user.id, now, sessionId);
      // Reconexión: misma fila, sin duplicar participante ni progreso (§5.5).
      await tx.sessionParticipant.upsert({
        where: { sessionId_userId: { sessionId, userId: user.id } },
        update: { alias: alias.trim(), status: 'CONECTADO', leftAt: null },
        create: { sessionId, userId: user.id, alias: alias.trim() },
      });
      await this.touch(tx, sessionId, now);
      if (!existing) await this.audit.record({ actorId: user.id, action: 'parche.joined', resource: 'session', resourceId: sessionId, requestId }, tx);
      return others;
    });
    for (const id of [...left, sessionId]) void this.bus.publish(id);
    return this.state(sessionId, user.id);
  }

  // ───────── Salir y cerrar ─────────

  /** Salir no bloquea al grupo: si sale el anfitrión, el anfitrión pasa a quien llegó primero (§5.5). */
  async leave(user: User, sessionId: string, now = new Date()): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockSession(tx, sessionId);
      await this.leaveSession(tx, sessionId, user.id, now);
    });
    void this.bus.publish(sessionId);
  }

  async close(user: User, sessionId: string, requestId: string, now = new Date()): Promise<ParcheState> {
    await this.prisma.$transaction(async (tx) => {
      await lockSession(tx, sessionId);
      const s = await tx.session.findUnique({ where: { id: sessionId } });
      this.assertLive(s, now);
      if (s.hostId !== user.id) throw new DomainError('FORBIDDEN', 'Solo el anfitrión puede cerrar el Parche.');
      await tx.session.update({ where: { id: sessionId }, data: { status: 'FINALIZADA', closedAt: now, stateVersion: { increment: 1 } } });
      await this.audit.record({ actorId: user.id, action: 'parche.closed', resource: 'session', resourceId: sessionId, requestId }, tx);
    });
    await this.redis.client.del(this.pinKey(sessionId)).catch(() => undefined);
    void this.bus.publish(sessionId);
    return this.state(sessionId, user.id);
  }

  /** Sale de cualquier otra sesión viva (una persona participa en un solo Parche a la vez). */
  private async leaveOthers(tx: Tx, userId: string, now: Date, keep?: string): Promise<string[]> {
    const others = await tx.sessionParticipant.findMany({
      where: { userId, status: { not: 'SALIO' }, sessionId: keep ? { not: keep } : undefined, session: { status: { in: [...LIVE] } } },
      select: { sessionId: true },
    });
    for (const o of others) await this.leaveSession(tx, o.sessionId, userId, now);
    return others.map((o) => o.sessionId);
  }

  private async leaveSession(tx: Tx, sessionId: string, userId: string, now: Date): Promise<void> {
    const s = await tx.session.findUnique({ where: { id: sessionId }, include: { participants: { orderBy: { joinedAt: 'asc' } } } });
    const me = s?.participants.find((p) => p.userId === userId);
    if (!s || !me || me.status === 'SALIO') return;
    await tx.sessionParticipant.update({ where: { sessionId_userId: { sessionId, userId } }, data: { status: 'SALIO', leftAt: now } });
    const remaining = s.participants.filter((p) => p.userId !== userId && p.status !== 'SALIO');
    const data: Prisma.SessionUpdateInput = { stateVersion: { increment: 1 }, lastActivityAt: now };
    if (remaining.length === 0) Object.assign(data, { status: 'FINALIZADA', closedAt: now });
    else if (s.hostId === userId) data.host = { connect: { id: (remaining.find((p) => p.status === 'CONECTADO') ?? remaining[0])?.userId } };
    await tx.session.update({ where: { id: sessionId }, data });
  }

  // ───────── Energía, marcador y presencia ─────────

  /**
   * Una activación válida dentro del Parche recarga un bloque de energía (Instrucciones §5 paso 5), sin pasar del
   * cierre de la sesión. Se llama dentro de la transacción de la reclamación. Devuelve false si no aplica.
   */
  async rechargeFromClaim(tx: Tx, sessionId: string, userId: string, now = new Date()): Promise<boolean> {
    await lockSession(tx, sessionId);
    const s = await tx.session.findUnique({ where: { id: sessionId }, include: { participants: { where: { userId } } } });
    if (!s || !(LIVE as readonly string[]).includes(s.status) || s.expiresAt <= now) return false;
    if (!s.participants[0] || s.participants[0].status === 'SALIO') return false;
    const from = Math.max(now.getTime(), s.energyEndsAt?.getTime() ?? 0);
    const energyEndsAt = new Date(Math.min(from + s.energyMinutes * MIN, s.expiresAt.getTime()));
    await tx.session.update({
      where: { id: sessionId },
      data: { energyEndsAt, activations: { increment: 1 }, stateVersion: { increment: 1 }, lastActivityAt: now },
    });
    return true;
  }

  /**
   * Suma al marcador del Parche dentro de una transacción (la usa el motor de juegos). Solo cuenta si la persona
   * sigue en el Parche y este sigue vivo. Devuelve los puntos aplicados (0 si no aplica).
   */
  async addScoreTx(tx: Tx, sessionId: string, userId: string, points: number, now = new Date()): Promise<number> {
    if (!Number.isInteger(points) || points <= 0) return 0;
    const s = await tx.session.findUnique({ where: { id: sessionId }, include: { participants: { where: { userId } } } });
    if (!s || !(LIVE as readonly string[]).includes(s.status) || s.expiresAt <= now) return 0;
    if (!s.participants[0] || s.participants[0].status === 'SALIO') return 0;
    await tx.session.update({ where: { id: sessionId }, data: { score: { increment: points }, stateVersion: { increment: 1 }, lastActivityAt: now } });
    return points;
  }

  /** Suma al marcador experiencial. */
  async addScore(sessionId: string, points: number): Promise<void> {
    if (!Number.isInteger(points) || points <= 0) throw new DomainError('VALIDATION_FAILED', 'Puntaje inválido.');
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { score: { increment: points }, stateVersion: { increment: 1 }, lastActivityAt: new Date() },
    });
    void this.bus.publish(sessionId);
  }

  /** Presencia por conexión en vivo: conectado / reconectando. Nunca reactiva a quien salió. */
  async setPresence(sessionId: string, userId: string, online: boolean, now = new Date()): Promise<void> {
    const res = await this.prisma.sessionParticipant.updateMany({
      where: { sessionId, userId, status: online ? 'RECONECTANDO' : 'CONECTADO' },
      data: { status: online ? 'CONECTADO' : 'RECONECTANDO' },
    });
    if (res.count === 0) return;
    await this.prisma.session.update({ where: { id: sessionId }, data: { stateVersion: { increment: 1 }, ...(online ? { lastActivityAt: now } : {}) } });
    void this.bus.publish(sessionId);
  }

  publish(sessionId: string): Promise<void> {
    return this.bus.publish(sessionId);
  }

  // ───────── Expiración ─────────

  /** Cierra por hora de cierre (p. ej. 6:00 a. m.) o por inactividad. El saldo individual no vence con el Parche. */
  async tick(now = new Date()): Promise<number> {
    const inactivity = Number(await this.settings.get('parche.inactivityMinutes'));
    const due = await this.prisma.session.findMany({
      where: { status: { in: [...LIVE] }, OR: [{ expiresAt: { lte: now } }, { lastActivityAt: { lte: new Date(now.getTime() - inactivity * MIN) } }] },
      select: { id: true, status: true },
    });
    let expired = 0;
    for (const s of due) {
      const r = await this.prisma.session.updateMany({
        where: { id: s.id, status: s.status },
        data: { status: 'EXPIRADA', closedAt: now, stateVersion: { increment: 1 } },
      });
      if (r.count === 0) continue;
      expired++;
      await this.redis.client.del(this.pinKey(s.id)).catch(() => undefined);
      void this.bus.publish(s.id);
    }
    return expired;
  }

  // ───────── Estado ─────────

  /** Estado visible para una persona del Parche. Lanza si no participa (autorización por sesión — §8). */
  async state(sessionId: string, viewerId: string, knownPin?: string, now = new Date()): Promise<ParcheState> {
    const s = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { participants: { orderBy: { joinedAt: 'asc' } } },
    });
    const me = s?.participants.find((p) => p.userId === viewerId);
    if (!s || !me) throw new DomainError('SESSION_NOT_FOUND', 'No encontramos ese Parche.');
    const live = (LIVE as readonly string[]).includes(s.status) && s.expiresAt > now;
    const inside = live && me.status !== 'SALIO';
    const pin = inside ? (knownPin ?? (await (await this.kv()).get(this.pinKey(s.id)).catch(() => null))) : null;
    const version = s.campaignVersionId
      ? await this.prisma.campaignVersion.findUnique({ where: { id: s.campaignVersionId }, include: { campaign: true } })
      : null;
    const draft = version ? CampaignDraftSchema.parse(version.content) : null;
    return {
      id: s.id,
      name: s.name,
      route: s.route,
      mode: s.mode,
      status: live || !(LIVE as readonly string[]).includes(s.status) ? s.status : 'EXPIRADA',
      isHost: s.hostId === viewerId,
      pin,
      invitePath:
        inside && s.mode === 'MULTI_DISPOSITIVO' ? `/parche/${s.id}/unirse?i=${Buffer.from(this.inviteFor(s.id), 'hex').toString('base64url')}` : null,
      capacity: s.capacity,
      participants: s.participants.map((p) => ({
        id: hmac(this.env.APP_SECRET, `participant:${s.id}:${p.userId}`).slice(0, 12),
        alias: p.alias,
        isHost: p.userId === s.hostId,
        isYou: p.userId === viewerId,
        status: p.status === 'CONECTADO' ? 'connected' : p.status === 'RECONECTANDO' ? 'reconnecting' : 'left',
      })),
      localPlayers: s.localPlayers,
      energy: { minutes: s.energyMinutes, endsAt: s.energyEndsAt?.toISOString() ?? null },
      expiresAt: s.expiresAt.toISOString(),
      score: s.score,
      activations: s.activations,
      campaign: version && draft ? { slug: version.campaign.slug, title: draft.publicTitle, themeId: draft.theme.brand } : null,
      stateVersion: s.stateVersion,
      serverTime: now.toISOString(),
    };
  }

  /** ¿Puede esta persona abrir el canal en vivo de la sesión? */
  async canListen(sessionId: string, userId: string): Promise<boolean> {
    const p = await this.prisma.sessionParticipant.findUnique({ where: { sessionId_userId: { sessionId, userId } } });
    return !!p && p.status !== 'SALIO';
  }

  // ───────── Auxiliares ─────────

  /** Redis con conexión perezosa: se asegura antes de usar el PIN en claro o los contadores de intentos. */
  private async kv() {
    await this.redis.isHealthy();
    return this.redis.client;
  }

  private assertLive<T extends { status: string; expiresAt: Date }>(s: T | null, now: Date): asserts s is T {
    if (!s) throw new DomainError('SESSION_NOT_FOUND', 'No encontramos ese Parche.');
    if (!(LIVE as readonly string[]).includes(s.status) || s.expiresAt <= now) throw new DomainError('SESSION_EXPIRED', 'Este Parche ya terminó.');
  }

  private touch(tx: Tx, sessionId: string, now: Date) {
    return tx.session.update({ where: { id: sessionId }, data: { stateVersion: { increment: 1 }, lastActivityAt: now } });
  }

  private pinLookup(pin: string): string {
    return hmac(this.env.APP_SECRET, `pin:${pin}`);
  }

  /** PIN en claro solo en Redis y solo mientras la sesión vive (para mostrarlo a quienes ya están dentro). */
  private pinKey(sessionId: string): string {
    return `parche:pin:${sessionId}`;
  }

  /** Invitación del QR: HMAC del id de sesión (128 bits). No sirve para otra sesión ni después de cerrar. */
  private inviteFor(sessionId: string): string {
    return hmac(this.env.APP_SECRET, `invite:${sessionId}`).slice(0, 32);
  }

  private async assertNotLocked(userId: string, ip: string): Promise<void> {
    const kv = await this.kv();
    const [u, i] = await Promise.all([kv.get(`pin:fail:u:${userId}`), kv.get(`pin:fail:ip:${ip}`)]).catch(() => [null, null]);
    if (Number(u ?? 0) >= PIN_MAX_FAILURES || Number(i ?? 0) >= PIN_MAX_FAILURES * 3) {
      throw new DomainError('SESSION_PIN_LOCKED', `Demasiados intentos. Espera ${PIN_LOCK_MINUTES} minutos.`);
    }
  }

  /** Devuelve los intentos que le quedan a la persona. Por IP se tolera más (varias personas en un mismo bar). */
  private async noteFailure(userId: string, ip: string): Promise<number> {
    try {
      const ttl = PIN_LOCK_MINUTES * 60;
      const kv = await this.kv();
      const u = await kv.incr(`pin:fail:u:${userId}`);
      if (u === 1) await kv.expire(`pin:fail:u:${userId}`, ttl);
      const i = await kv.incr(`pin:fail:ip:${ip}`);
      if (i === 1) await kv.expire(`pin:fail:ip:${ip}`, ttl);
      if (u === PIN_MAX_FAILURES) {
        await this.prisma.securityEvent.create({ data: { type: 'parche.pin_bruteforce', severity: 'BAJA', subjectId: userId, metadata: { attempts: u } } });
      }
      return Math.max(0, PIN_MAX_FAILURES - u);
    } catch {
      return 0;
    }
  }

  private clearFailures(userId: string): Promise<unknown> {
    return this.redis.client.del(`pin:fail:u:${userId}`).catch(() => undefined);
  }
}
