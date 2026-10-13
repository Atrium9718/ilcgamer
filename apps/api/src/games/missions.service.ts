import {
  type ChaptersConfig,
  ChaptersConfigSchema,
  type GameManifest,
  GameManifestSchema,
  type MissionResult,
  MissionResultSchema,
  type MissionStart,
  MissionStartSchema,
  PartyConfigSchema,
  type ProviderCallback,
  type StartMission,
  type SubmitMission,
  TriviaConfigSchema,
  WheelConfigSchema,
} from '@ilc/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service.ts';
import { AuditService } from '../audit/audit.service.ts';
import { canonicalJson } from '../campaigns/content-hash.ts';
import { startOfColombiaDay } from '../codes/rules.ts';
import { hmac, safeEqualHex, sha256 } from '../common/crypto.ts';
import { DomainError } from '../common/domain-error.ts';
import { ENV } from '../config/config.module.ts';
import type { Env } from '../config/env.ts';
import { ProgressService } from '../economy/progress.service.ts';
import type { User } from '../generated/prisma/client.ts';
import { Prisma } from '../generated/prisma/client.ts';
import { ParcheService } from '../parche/parche.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { ReferralsService } from '../referrals/referrals.service.ts';
import { type ActiveModule, CatalogService } from './catalog.service.ts';
import {
  type Evaluation,
  evaluateChapter,
  evaluateTrivia,
  evaluateWheel,
  type Prepared,
  prepareChapters,
  prepareParty,
  prepareTrivia,
  prepareWheel,
} from './engines.ts';
import { providerSecret } from './modules.service.ts';

type Tx = Prisma.TransactionClient;
type Mission = Prisma.MissionProgressGetPayload<{ include: { moduleVersion: { include: { module: true } } } }>;

const GRACE_MS = 10_000;
const CALLBACK_WINDOW_MS = 5 * 60_000;
const ROLES_FOR_PREVIEW = ['SUPERADMIN', 'ADMIN_MARCA', 'EDITOR_CONTENIDO', 'REVISOR_MARCA', 'REVISOR_JURIDICO', 'RESPONSABLE_PRIVACIDAD'];

const lockUserModule = (tx: Tx, userId: string, moduleId: string) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`mission:${userId}:${moduleId}`}, 0))`;

/**
 * Misiones (Guía Técnica §5.4, §5.7). El cliente nunca se autoasigna recompensa: el servidor sortea, puntúa y acredita,
 * o espera la confirmación firmada del proveedor del módulo. Reglas que no dependen del juego:
 * - jamás se emiten Puntos ILC por jugar (solo por reclamar un código);
 * - el XP existe solo en módulos de Ruta B y cada capítulo lo da una sola vez (índice único en la base de datos);
 * - lo que sumó al marcador del Parche cuenta solo si la persona sigue en el Parche y este sigue vivo;
 * - hay una sola partida abierta por persona y módulo (no se "re-sortean" preguntas) y un tope diario de intentos.
 */
@Injectable()
export class MissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly progress: ProgressService,
    private readonly parche: ParcheService,
    private readonly audit: AuditService,
    private readonly analytics: AnalyticsService,
    private readonly referrals: ReferralsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ───────── Inicio ─────────

  async start(user: User, input: StartMission, idempotencyKey: string, now = new Date()): Promise<MissionStart> {
    if (!user.ageVerifiedAt) throw new DomainError('AGE_GATE_REQUIRED', 'Confirma tu edad para jugar.');
    const key = sha256(`${user.id}:${idempotencyKey}`);
    const replay = await this.prisma.missionProgress.findUnique({ where: { idempotencyKey: key } });
    if (replay) return this.stored(replay, user.id);

    const preview = input.preview === true;
    let module: ActiveModule | undefined;
    let ctx: Awaited<ReturnType<CatalogService['resolveContext']>> | null = null;
    if (preview) {
      await this.assertEditor(user.id);
      module = await this.previewModule(input.moduleId);
    } else {
      ctx = await this.catalog.resolveContext(user, input, now);
      if (!ctx.allowed.includes(input.moduleId)) throw new DomainError('GAME_NOT_AVAILABLE', 'Este juego no está disponible aquí.');
      module = (await this.catalog.activeModules([input.moduleId]))[0];
    }
    if (!module) throw new DomainError('GAME_NOT_AVAILABLE', 'Este juego no está disponible.');
    const manifest = module.manifest;

    const created = await this.prisma.$transaction(async (tx) => {
      await lockUserModule(tx, user.id, module.moduleId);
      // Una sola partida abierta por persona y módulo: si hay una vigente, se retoma (no se re-sortea).
      const open = await tx.missionProgress.findFirst({
        where: { userId: user.id, moduleId: module.moduleId, status: 'INICIADA', preview },
        orderBy: { startedAt: 'desc' },
      });
      if (open && this.deadlineOf(open) > now.getTime()) return { mission: open, fresh: false };
      if (open) await tx.missionProgress.update({ where: { id: open.id }, data: { status: 'ABANDONADA' } });

      if (!preview) {
        const today = await tx.missionProgress.count({
          where: { userId: user.id, moduleId: module.moduleId, preview: false, startedAt: { gte: startOfColombiaDay(now) } },
        });
        if (today >= manifest.scoring.attemptsPerDay)
          throw new DomainError('GAME_LIMIT_REACHED', `Ya jugaste ${manifest.scoring.attemptsPerDay} veces hoy. Vuelve mañana.`);
      }
      const completed =
        manifest.delivery.kind === 'engine' && manifest.delivery.engine === 'chapters'
          ? [...((await this.catalog.chapterProgress(user.id, [module.moduleId])).get(module.moduleId) ?? [])]
          : [];
      const prepared = this.prepare(manifest, completed);
      const startPayload: MissionStart = {
        missionId: '00000000-0000-0000-0000-000000000000',
        moduleId: module.slug,
        title: manifest.title,
        route: manifest.route,
        preview,
        maxSeconds: prepared.maxSeconds,
        play: prepared.play,
      };
      const mission = await tx.missionProgress.create({
        data: {
          userId: user.id,
          sessionId: ctx?.sessionId ?? null,
          moduleVersionId: module.versionId,
          moduleId: module.moduleId,
          campaignVersionId: ctx?.campaign?.versionId ?? null,
          chapterId: prepared.play.kind === 'chapters' ? prepared.play.chapter.id : null,
          status: 'INICIADA',
          idempotencyKey: key,
          preview,
          state: {
            private: prepared.state,
            start: startPayload,
            deadline: new Date(now.getTime() + prepared.maxSeconds * 1000).toISOString(),
          } as unknown as Prisma.InputJsonValue,
        },
      });
      if (!preview) {
        await this.analytics.emit(
          'mission_started',
          { campaignId: ctx?.campaign?.id ?? null, properties: { moduleId: module.slug, route: manifest.route }, occurredAt: now },
          tx,
        );
      }
      return { mission, fresh: true };
    });
    return this.stored(created.mission, user.id);
  }

  private prepare(manifest: GameManifest, completed: readonly string[]): Prepared {
    const d = manifest.delivery;
    if (d.kind === 'iframe')
      return { play: { kind: 'iframe', entryUrl: d.entryUrl, allowedOrigin: d.allowedOrigin }, state: {}, maxSeconds: manifest.scoring.maxSeconds };
    if (d.engine === 'trivia') return prepareTrivia(TriviaConfigSchema.parse(d.config), manifest);
    if (d.engine === 'wheel') return prepareWheel(WheelConfigSchema.parse(d.config), manifest);
    if (d.engine === 'party') return prepareParty(PartyConfigSchema.parse(d.config), manifest);
    return prepareChapters(ChaptersConfigSchema.parse(d.config), manifest, completed);
  }

  private async assertEditor(userId: string): Promise<void> {
    const roles = (await this.prisma.userRole.findMany({ where: { userId }, select: { role: true } })).map((r) => r.role as string);
    if (!roles.some((r) => ROLES_FOR_PREVIEW.includes(r))) throw new DomainError('FORBIDDEN', 'Las pruebas son del equipo editorial.');
  }

  /** La versión más reciente en prueba, aprobada o activa (las pruebas no necesitan estar activas). */
  private async previewModule(slug: string): Promise<ActiveModule | undefined> {
    const v = await this.prisma.moduleVersion.findFirst({
      where: { module: { slug }, status: { in: ['EN_PRUEBA', 'APROBADO', 'ACTIVO'] } },
      orderBy: { createdAt: 'desc' },
      include: { module: true },
    });
    return v ? { moduleId: v.moduleId, slug: v.module.slug, versionId: v.id, version: v.version, manifest: GameManifestSchema.parse(v.manifest) } : undefined;
  }

  private deadlineOf(m: { state: unknown; startedAt: Date }): number {
    const d = (m.state as { deadline?: string } | null)?.deadline;
    return d ? new Date(d).getTime() : m.startedAt.getTime();
  }

  /** Reconstruye la respuesta de inicio con el id real de la misión (el cliente nunca recibe las claves). */
  private stored(m: { id: string; userId: string | null; state: unknown }, userId: string): MissionStart {
    if (m.userId !== userId) throw new DomainError('NOT_FOUND', 'No encontramos esa partida.');
    const start = (m.state as { start: MissionStart }).start;
    return MissionStartSchema.parse({ ...start, missionId: m.id });
  }

  // ───────── Entrega ─────────

  async submit(user: User, missionId: string, body: SubmitMission, requestId: string, now = new Date()): Promise<MissionResult> {
    const m = await this.load(missionId, user.id);
    if (m.status === 'VERIFICADA' || m.status === 'COMPLETADA_PENDIENTE' || m.status === 'RECHAZADA') return this.resultOf(m);
    if (m.status === 'ABANDONADA') throw new DomainError('GAME_NOT_AVAILABLE', 'Esta partida ya no está disponible.');
    if (now.getTime() > this.deadlineOf(m) + GRACE_MS) {
      await this.prisma.missionProgress.updateMany({ where: { id: m.id, status: 'INICIADA' }, data: { status: 'ABANDONADA' } });
      throw new DomainError('GAME_NOT_AVAILABLE', 'Se acabó el tiempo de esta partida.');
    }
    const manifest = GameManifestSchema.parse(m.moduleVersion.manifest);
    const d = manifest.delivery;

    if (d.kind === 'iframe') {
      // El módulo del proveedor dice "terminé", pero el resultado lo confirma el proveedor desde su servidor (§5.4).
      await this.prisma.missionProgress.updateMany({ where: { id: m.id, status: 'INICIADA' }, data: { status: 'COMPLETADA_PENDIENTE', completedAt: now } });
      return this.resultOf(await this.load(missionId, user.id));
    }

    // Los juegos de fiesta no tienen resultado que enviar (no puntúan): jugar nunca acredita nada.
    if (d.engine === 'party') throw new DomainError('CONFLICT', 'Este juego no envía resultados.');

    const priv = ((m.state as { private?: Record<string, unknown> } | null)?.private ?? {}) as Record<string, unknown>;
    let evaluation: Evaluation;
    if (d.engine === 'trivia') evaluation = evaluateTrivia(TriviaConfigSchema.parse(d.config), priv, body);
    else if (d.engine === 'wheel') evaluation = evaluateWheel(WheelConfigSchema.parse(d.config));
    else {
      const config: ChaptersConfig = ChaptersConfigSchema.parse(d.config);
      const done = [...((await this.catalog.chapterProgress(user.id, [m.moduleId as string])).get(m.moduleId as string) ?? [])];
      evaluation = evaluateChapter(config, priv, body, done);
      if (!evaluation.finished) {
        await this.prisma.missionProgress.update({ where: { id: m.id }, data: { attempts: { increment: 1 } } });
        return this.build(m, evaluation, { parcheScore: 0, xp: 0, badge: null, completedModule: false, hasNext: true }, 'INICIADA');
      }
    }
    return this.finalize(m, manifest, evaluation, requestId, now);
  }

  async get(user: User, missionId: string): Promise<MissionResult> {
    return this.resultOf(await this.load(missionId, user.id));
  }

  private async load(id: string, userId: string): Promise<Mission> {
    const m = await this.prisma.missionProgress.findUnique({ where: { id }, include: { moduleVersion: { include: { module: true } } } });
    if (!m || m.userId !== userId) throw new DomainError('NOT_FOUND', 'No encontramos esa partida.');
    return m;
  }

  // ───────── Confirmación del proveedor (módulos iframe) ─────────

  /**
   * Llamada backend a backend del proveedor (§5.4). Firma HMAC-SHA256 del JSON canónico con el secreto del módulo,
   * ventana de ±5 min contra repeticiones y misión de un solo uso. Los topes del manifiesto acotan lo que puede dar.
   */
  async providerCallback(body: ProviderCallback, signature: string | undefined, requestId: string, now = new Date()): Promise<{ status: string }> {
    const invalid = () => new DomainError('UNAUTHENTICATED', 'Firma de proveedor no válida.');
    const m = await this.prisma.missionProgress.findUnique({ where: { id: body.missionId }, include: { moduleVersion: { include: { module: true } } } });
    if (!m) throw invalid();
    const secret = providerSecret(this.env.APP_SECRET, m.moduleVersion.module.slug, m.moduleVersion.module.secretEpoch);
    const given = /^sha256=([0-9a-f]{64})$/.exec(signature ?? '')?.[1];
    if (!given || !safeEqualHex(hmac(secret, canonicalJson(body)), given)) throw invalid();
    if (Math.abs(now.getTime() - new Date(body.issuedAt).getTime()) > CALLBACK_WINDOW_MS)
      throw new DomainError('UNAUTHENTICATED', 'La marca de tiempo está fuera de la ventana permitida.');
    const manifest = GameManifestSchema.parse(m.moduleVersion.manifest);
    if (manifest.delivery.kind !== 'iframe') throw new DomainError('CONFLICT', 'Este módulo no usa confirmación del proveedor.');
    if (m.status === 'VERIFICADA' || m.status === 'RECHAZADA' || m.status === 'ABANDONADA') return { status: m.status };

    if (body.outcome === 'rejected') {
      await this.prisma.missionProgress.updateMany({
        where: { id: m.id, status: { in: ['INICIADA', 'COMPLETADA_PENDIENTE'] } },
        data: { status: 'RECHAZADA', verifiedAt: now },
      });
      await this.audit.record({
        actorId: null,
        action: 'mission.provider_rejected',
        resource: 'mission',
        resourceId: m.id,
        requestId,
        metadata: { moduleId: m.moduleVersion.module.slug },
      });
      return { status: 'RECHAZADA' };
    }
    const evaluation: Evaluation = {
      correct: null,
      finished: true,
      parcheScore: body.parcheScore,
      xp: body.xp,
      headline: 'Terminaste el juego',
      summary: 'El proveedor confirmó tu resultado.',
      fact: null,
      outcome: null,
    };
    const result = await this.finalize(m, manifest, evaluation, requestId, now);
    return { status: result.status };
  }

  // ───────── Acreditación ─────────

  /**
   * Cierra la misión una sola vez y acredita lo ganado dentro de la misma transacción. Los topes del manifiesto
   * acotan siempre el resultado, venga del motor o del proveedor.
   */
  private async finalize(m: Mission, manifest: GameManifest, ev: Evaluation, requestId: string, now: Date): Promise<MissionResult> {
    const slug = m.moduleVersion.module.slug;
    const moduleId = m.moduleId as string;
    let parcheScore = Math.min(ev.parcheScore, manifest.scoring.parcheScoreMax);
    const xp = manifest.route === 'B' ? Math.min(ev.xp, manifest.scoring.xpMax) : 0;
    const config = manifest.delivery.kind === 'engine' && manifest.delivery.engine === 'chapters' ? ChaptersConfigSchema.parse(manifest.delivery.config) : null;
    let outcome: { parcheScore: number; xp: number; badge: { slug: string; name: string } | null; completedModule: boolean; hasNext: boolean };

    try {
      outcome = await this.prisma.$transaction(async (tx) => {
        const taken = await tx.missionProgress.updateMany({
          where: { id: m.id, status: { in: ['INICIADA', 'COMPLETADA_PENDIENTE'] } },
          data: { status: 'VERIFICADA', verifiedAt: now, completedAt: m.completedAt ?? now },
        });
        if (taken.count === 0) throw new AlreadyFinalized();

        let applied = 0;
        let badge: { slug: string; name: string } | null = null;
        let completedModule = false;
        let hasNext = false;
        if (!m.preview) {
          if (m.sessionId && parcheScore > 0) applied = await this.parche.addScoreTx(tx, m.sessionId, m.userId as string, parcheScore, now);
          if (xp > 0) {
            // Hash: persona + módulo + capítulo caben en los 80 caracteres de la clave y no dependen de la versión del módulo.
            const xpKey = m.chapterId ? `chapter-xp:${sha256(`${m.userId}:${moduleId}:${m.chapterId}`)}` : `mission-xp:${m.id}`;
            await this.progress.awardXp({ userId: m.userId as string, amount: xp, source: `game:${slug}`, idempotencyKey: xpKey, missionId: m.id }, tx);
          }
          if (config && m.chapterId) {
            const done = await tx.missionProgress.findMany({
              where: { userId: m.userId as string, moduleId, status: 'VERIFICADA', preview: false, chapterId: { not: null } },
              select: { chapterId: true },
            });
            const ids = new Set(done.map((d) => d.chapterId as string));
            ids.add(m.chapterId);
            hasNext = config.chapters.some((c) => !ids.has(c.id));
            completedModule = !hasNext;
            const badgeSlug = manifest.badge ?? config.finalBadge;
            if (completedModule && badgeSlug) {
              await this.progress.awardBadge(m.userId as string, badgeSlug, m.id, tx);
              const b = await tx.badge.findUnique({ where: { slug: badgeSlug } });
              badge = b ? { slug: b.slug, name: b.name } : null;
            }
          }
          await this.audit.record(
            {
              actorId: m.userId,
              action: 'mission.verified',
              resource: 'mission',
              resourceId: m.id,
              requestId,
              metadata: { moduleId: slug, version: m.moduleVersion.version, xp, parcheScore: applied, chapterId: m.chapterId },
            },
            tx,
          );
          await this.analytics.emit('mission_completed', { properties: { moduleId: slug, route: manifest.route, xp }, occurredAt: now }, tx);
          if (m.userId) await this.referrals.onFirstMission(tx, m.userId, m.id, now);
        } else {
          hasNext = !!config;
        }
        parcheScore = applied;
        const result = this.build(m, ev, { parcheScore: applied, xp: m.preview ? 0 : xp, badge, completedModule, hasNext }, 'VERIFICADA');
        await tx.missionProgress.update({ where: { id: m.id }, data: { result: result as unknown as Prisma.InputJsonValue } });
        return { parcheScore: applied, xp: m.preview ? 0 : xp, badge, completedModule, hasNext };
      });
    } catch (err) {
      if (err instanceof AlreadyFinalized) return this.resultOf(await this.load(m.id, m.userId as string));
      // Capítulo ya completado en paralelo (índice único): no se repite el XP.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        await this.prisma.missionProgress.updateMany({
          where: { id: m.id, status: { in: ['INICIADA', 'COMPLETADA_PENDIENTE'] } },
          data: { status: 'ABANDONADA' },
        });
        return this.build(
          m,
          { ...ev, headline: 'Ya completaste este capítulo', summary: 'No se repite el XP.' },
          { parcheScore: 0, xp: 0, badge: null, completedModule: false, hasNext: true },
          'VERIFICADA',
        );
      }
      throw err;
    }
    if (m.sessionId && outcome.parcheScore > 0) void this.parche.publish(m.sessionId);
    return this.build(m, ev, outcome, 'VERIFICADA');
  }

  private build(
    m: Pick<Mission, 'id' | 'preview'>,
    ev: Pick<Evaluation, 'headline' | 'summary' | 'correct' | 'fact' | 'outcome'>,
    given: { parcheScore: number; xp: number; badge: { slug: string; name: string } | null; completedModule: boolean; hasNext: boolean },
    status: MissionResult['status'],
  ): MissionResult {
    return {
      missionId: m.id,
      status,
      preview: m.preview,
      headline: ev.headline,
      summary: ev.summary,
      correct: ev.correct,
      parcheScore: given.parcheScore,
      xp: given.xp,
      pointsEarned: 0,
      badge: given.badge,
      fact: ev.fact,
      outcome: ev.outcome,
      hasNext: given.hasNext,
      completedModule: given.completedModule,
    };
  }

  private resultOf(m: Mission): MissionResult {
    if (m.result) return MissionResultSchema.parse(m.result);
    const label: Record<string, [string, string]> = {
      INICIADA: ['En curso', 'La partida sigue abierta.'],
      COMPLETADA_PENDIENTE: ['Verificando tu resultado', 'Estamos confirmando el resultado con el proveedor del juego.'],
      RECHAZADA: ['No pudimos validar tu resultado', 'El proveedor no confirmó esta partida.'],
      ABANDONADA: ['Partida cerrada', 'Esta partida ya no está disponible.'],
      VERIFICADA: ['Resultado verificado', ''],
    };
    const [headline, summary] = label[m.status] ?? ['Partida', ''];
    return this.build(
      m,
      { headline: headline as string, summary: summary as string, correct: null, fact: null, outcome: null },
      { parcheScore: 0, xp: 0, badge: null, completedModule: false, hasNext: false },
      m.status,
    );
  }
}

/** Otra solicitud cerró la misión antes: se devuelve el resultado ya guardado. */
class AlreadyFinalized extends Error {}
