import { CONSENT_PURPOSES, type ConsentChange, type ConsentState, type Me, type OtpChannel, type ProfileCapture } from '@ilc/contracts';
import { Inject, Injectable } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { AnalyticsService } from '../analytics/analytics.service.ts';
import { AuditService } from '../audit/audit.service.ts';
import { DomainError } from '../common/domain-error.ts';
import { ENV } from '../config/config.module.ts';
import { autoAccountEnabled, type Env } from '../config/env.ts';
import type { User } from '../generated/prisma/client.ts';
import { SettingsService } from '../platform/settings.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { ageOn, isFutureDate } from './age.ts';
import type { AuthContext } from './auth.guard.ts';
import { AuthSessionService } from './auth-session.service.ts';
import { maskDestination, normalizeDestination } from './destination.ts';

export const AGE_GATE_METHOD = 'fecha_y_declaracion';
const DEFAULT_ALIAS = 'Jugador';

/**
 * Identidad progresiva (Guía Técnica §5.2):
 * 1. Control de edad → cuenta TEMPORAL con alias (sin datos personales).
 * 2. Consentimientos con finalidad separada (append-only).
 * 3. Acceso persistente (OTP / Google / Apple) solo cuando hace falta guardar progreso o canjear.
 */
@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: AuthSessionService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly analytics: AnalyticsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Calcula la edad, registra SOLO el resultado (fecha y método) y descarta la fecha de nacimiento. */
  async passAgeGate(birthDate: string, campaignSlug: string | undefined, auth: AuthContext | null, reply: FastifyReply, requestId: string): Promise<Me> {
    const minAge = await this.minAgeFor(campaignSlug);
    if (isFutureDate(birthDate) || ageOn(birthDate) < minAge) {
      // No se crea cuenta ni se guarda ningún dato de quien no cumple la edad (§9.4); solo el resultado agregado.
      await this.analytics.emit('age_gate_result_recorded', { properties: { result: 'blocked' } });
      throw new DomainError('AGE_REQUIREMENT_NOT_MET', `Este contenido es solo para mayores de ${minAge} años.`);
    }
    const now = new Date();
    await this.analytics.emit('age_gate_result_recorded', { properties: { result: 'passed' }, occurredAt: now });
    if (auth) {
      const ageVerifiedMinAge = Math.max(auth.user.ageVerifiedMinAge ?? 18, minAge);
      const user = await this.prisma.user.update({
        where: { id: auth.user.id },
        data: { ageVerifiedAt: now, ageGateMethod: AGE_GATE_METHOD, ageVerifiedMinAge },
      });
      return this.me(user);
    }
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          alias: DEFAULT_ALIAS,
          status: autoAccountEnabled(this.env) ? 'ACTIVA' : 'TEMPORAL',
          ageVerifiedAt: now,
          ageGateMethod: AGE_GATE_METHOD,
          ageVerifiedMinAge: minAge,
        },
      });
      await this.sessions.create(created.id, reply, tx);
      await this.audit.record(
        { actorId: created.id, action: 'age_gate.passed', resource: 'user', resourceId: created.id, requestId, metadata: { method: AGE_GATE_METHOD, minAge } },
        tx,
      );
      return created;
    });
    return this.me(user);
  }

  private async minAgeFor(campaignSlug?: string): Promise<number> {
    const platformMin = Math.max(18, Number(await this.settings.get('platform.minAge')));
    if (!campaignSlug) return platformMin;
    const campaign = await this.prisma.campaign.findUnique({ where: { slug: campaignSlug }, include: { activeVersion: true } });
    return Math.max(platformMin, campaign?.activeVersion?.minAge ?? 18);
  }

  async me(user: User): Promise<Me> {
    // Staging sin usuarios reales: las cuentas temporales ya existentes también pasan a activas (sin pedir registro).
    if (autoAccountEnabled(this.env) && user.status === 'TEMPORAL' && user.ageVerifiedAt)
      user = await this.prisma.user.update({ where: { id: user.id }, data: { status: 'ACTIVA' } });
    const [credentials, consents, pii, roles] = await Promise.all([
      this.prisma.identityCredential.findMany({ where: { userId: user.id }, select: { provider: true } }),
      this.consentState(user.id),
      this.prisma.userPii.findUnique({ where: { userId: user.id }, select: { phone: true, email: true } }),
      this.prisma.userRole.findMany({ where: { userId: user.id }, select: { role: true } }),
    ]);
    return {
      id: user.id,
      alias: user.alias,
      status: user.status,
      ageVerified: user.ageVerifiedAt !== null,
      credentials: credentials.map((c) => {
        const channel = c.provider.replace('otp:', '') as OtpChannel;
        const value = channel === 'email' ? pii?.email : pii?.phone;
        return { provider: c.provider, hint: value ? maskDestination(channel, value) : '' };
      }),
      consents,
      roles: [...new Set(roles.map((r) => r.role))],
    };
  }

  async updateAlias(userId: string, alias: string): Promise<Me> {
    return this.me(await this.prisma.user.update({ where: { id: userId }, data: { alias } }));
  }

  /** Estado vigente = último registro por finalidad. Sin registro: no otorgado. */
  async consentState(userId: string): Promise<ConsentState[]> {
    const rows = await this.prisma.consentRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      distinct: ['purpose'],
    });
    return CONSENT_PURPOSES.map((purpose) => {
      const r = rows.find((x) => x.purpose === purpose);
      return { purpose, granted: r?.granted ?? false, noticeVersion: r?.noticeVersion ?? null, updatedAt: r?.createdAt.toISOString() ?? null };
    });
  }

  /**
   * Registro al entrar (Paso 16): guarda nombre, correo y celular (sin verificar por ahora) y registra, de forma separada y
   * trazable, la autorización del tratamiento de datos (obligatoria) y la de novedades (opcional). Idempotente por persona.
   */
  async captureProfile(user: User, input: ProfileCapture, requestId: string): Promise<Me> {
    const email = normalizeDestination('email', input.email);
    const phone = normalizeDestination('whatsapp', input.phone);
    const clash = await this.prisma.userPii.findFirst({ where: { userId: { not: user.id }, OR: [{ email }, { phone }] }, select: { userId: true } });
    if (clash)
      throw new DomainError('CONFLICT', 'Ese correo o celular ya está registrado.', { fields: { email: ['Ese correo o celular ya está registrado.'] } });
    const current = String(await this.settings.get('legal.noticeVersion'));
    if (input.noticeVersion !== current) throw new DomainError('CONFLICT', 'El aviso de privacidad cambió. Revísalo de nuevo para continuar.');
    const fullName = input.fullName.replace(/\s+/g, ' ').trim();
    await this.prisma.$transaction(async (tx) => {
      await tx.userPii.upsert({ where: { userId: user.id }, update: { fullName, email, phone }, create: { userId: user.id, fullName, email, phone } });
      const source = 'registro';
      await tx.consentRecord.create({ data: { userId: user.id, purpose: 'TERMINOS_Y_PRIVACIDAD', granted: true, noticeVersion: input.noticeVersion, source } });
      await tx.consentRecord.create({
        data: { userId: user.id, purpose: 'MARKETING', granted: input.acceptMarketing, noticeVersion: input.noticeVersion, source },
      });
      await this.audit.record(
        { actorId: user.id, action: 'profile.captured', resource: 'user', resourceId: user.id, requestId, metadata: { marketing: input.acceptMarketing } },
        tx,
      );
    });
    await this.analytics.emit('consent_updated', { properties: { purpose: 'TERMINOS_Y_PRIVACIDAD', granted: true } });
    const fresh = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    return this.me(fresh);
  }

  async recordConsent(userId: string, change: ConsentChange): Promise<ConsentState[]> {
    const current = String(await this.settings.get('legal.noticeVersion'));
    if (change.purpose === 'TERMINOS_Y_PRIVACIDAD' && change.granted && change.noticeVersion !== current) {
      throw new DomainError('CONFLICT', 'El aviso de privacidad cambió. Revísalo de nuevo para continuar.');
    }
    await this.prisma.consentRecord.create({ data: { userId, ...change } });
    await this.analytics.emit('consent_updated', { properties: { purpose: change.purpose, granted: change.granted } });
    return this.consentState(userId);
  }

  /**
   * Vincula un acceso por código. Si el destino ya pertenece a otra cuenta, la sesión pasa a esa cuenta
   * (inicio de sesión en un dispositivo nuevo). La fusión de progreso de la cuenta temporal se define en el Paso 7.
   */
  async completeOtpLogin(
    auth: AuthContext | null,
    channel: OtpChannel,
    destination: string,
    destinationId: string,
    reply: FastifyReply,
    requestId: string,
  ): Promise<Me> {
    const provider = `otp:${channel}`;
    const existing = await this.prisma.identityCredential.findUnique({
      where: { provider_subject: { provider, subject: destinationId } },
      include: { user: true },
    });

    if (existing && existing.userId !== auth?.user.id) {
      if (existing.user.status === 'ELIMINADA' || existing.user.status === 'SUSPENDIDA')
        throw new DomainError('ACCOUNT_UNAVAILABLE', 'Esta cuenta no está disponible.');
      await this.prisma.$transaction(async (tx) => {
        if (auth) await this.sessions.revoke(auth.sessionId, reply, tx);
        await this.sessions.create(existing.userId, reply, tx);
        if (!existing.verifiedAt) await tx.identityCredential.update({ where: { id: existing.id }, data: { verifiedAt: new Date() } });
        await this.audit.record(
          {
            actorId: existing.userId,
            action: 'auth.login',
            resource: 'user',
            resourceId: existing.userId,
            requestId,
            metadata: { provider, abandonedTemporaryUserId: auth?.user.id ?? null },
          },
          tx,
        );
      });
      return this.me(existing.user);
    }

    // Una cuenta nueva exige haber pasado el control de edad en este navegador.
    if (!auth) throw new DomainError('AGE_GATE_REQUIRED', 'Confirma tu edad para crear tu cuenta.');
    const consents = await this.consentState(auth.user.id);
    if (!consents.find((c) => c.purpose === 'TERMINOS_Y_PRIVACIDAD')?.granted) {
      throw new DomainError('CONSENT_REQUIRED', 'Acepta los términos y el aviso de privacidad para crear tu cuenta.');
    }

    const user = await this.prisma.$transaction(async (tx) => {
      if (!existing) await tx.identityCredential.create({ data: { userId: auth.user.id, provider, subject: destinationId, verifiedAt: new Date() } });
      const field = channel === 'email' ? 'email' : 'phone';
      await tx.userPii.upsert({ where: { userId: auth.user.id }, update: { [field]: destination }, create: { userId: auth.user.id, [field]: destination } });
      const updated = await tx.user.update({ where: { id: auth.user.id }, data: { status: 'ACTIVA' } });
      await this.audit.record(
        { actorId: updated.id, action: 'auth.credential_linked', resource: 'user', resourceId: updated.id, requestId, metadata: { provider } },
        tx,
      );
      return updated;
    });
    return this.me(user);
  }

  async logout(auth: AuthContext, reply: FastifyReply): Promise<void> {
    await this.sessions.revoke(auth.sessionId, reply);
  }

  /**
   * Eliminación de cuenta (derecho de supresión, §5.2, §9.3): borra datos personales y credenciales,
   * revoca sesiones y anonimiza el perfil. Se conservan solo registros con base legítima de conservación
   * (consentimientos otorgados/retirados y auditoría), sin datos de contacto.
   */
  async deleteAccount(auth: AuthContext, reply: FastifyReply, requestId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Las fotos y los votos de concursos son datos personales: se eliminan junto con la cuenta.
      await tx.contestVote.deleteMany({ where: { userId: auth.user.id } });
      await tx.contestEntry.deleteMany({ where: { userId: auth.user.id } });
      await tx.userPii.deleteMany({ where: { userId: auth.user.id } });
      await tx.identityCredential.deleteMany({ where: { userId: auth.user.id } });
      await tx.userRole.deleteMany({ where: { userId: auth.user.id } });
      await tx.user.update({ where: { id: auth.user.id }, data: { status: 'ELIMINADA', alias: 'Cuenta eliminada', deletedAt: new Date() } });
      await this.sessions.revokeAll(auth.user.id, tx);
      await this.audit.record({ actorId: auth.user.id, action: 'account.deleted', resource: 'user', resourceId: auth.user.id, requestId }, tx);
    });
    this.sessions.clearCookie(reply);
  }
}
