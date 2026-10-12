import { CampaignDraftSchema, type GameCatalog, type GameManifest, GameManifestSchema, MAX_ROUTE_B_PER_CONTEXT } from '@ilc/contracts';
import { Injectable } from '@nestjs/common';
import { isCampaignOpen } from '../campaigns/campaign-state.ts';
import { DomainError } from '../common/domain-error.ts';
import type { User } from '../generated/prisma/client.ts';
import { SettingsService } from '../platform/settings.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

export interface GameContext {
  campaign: { id: string; slug: string; title: string; versionId: string } | null;
  sessionId?: string;
  /** Identificadores permitidos (ya limitados a 2 de Ruta B). */
  allowed: string[];
}

export interface ActiveModule {
  moduleId: string;
  slug: string;
  versionId: string;
  version: string;
  manifest: GameManifest;
}

/**
 * Qué juegos ve una persona y dónde (Guía Técnica §5.4; Instrucciones §13.2). El contexto es el Parche en el que está,
 * o la campaña activa, o —sin campaña— la lista por defecto de la plataforma. Solo se ofrecen módulos con una versión
 * ACTIVA, y nunca más de 2 de Ruta B aunque la configuración lo intentara.
 */
@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async resolveContext(user: User, input: { campaignSlug?: string; sessionId?: string }, now = new Date()): Promise<GameContext> {
    let campaignVersionId: string | null = null;
    if (input.sessionId) {
      const s = await this.prisma.session.findUnique({ where: { id: input.sessionId }, include: { participants: { where: { userId: user.id } } } });
      const p = s?.participants[0];
      if (!s || !p || p.status === 'SALIO') throw new DomainError('SESSION_NOT_FOUND', 'No encontramos ese Parche.');
      if (!['CREADA', 'ABIERTA', 'EN_CURSO'].includes(s.status) || s.expiresAt <= now) throw new DomainError('SESSION_EXPIRED', 'Este Parche ya terminó.');
      campaignVersionId = s.campaignVersionId;
    }
    let campaign: GameContext['campaign'] = null;
    let listed: string[] = [];
    if (input.campaignSlug || campaignVersionId) {
      const version = campaignVersionId
        ? await this.prisma.campaignVersion.findUnique({ where: { id: campaignVersionId }, include: { campaign: true } })
        : await this.prisma.campaign
            .findUnique({ where: { slug: input.campaignSlug }, include: { activeVersion: true } })
            .then((c) => (c?.activeVersion ? { ...c.activeVersion, campaign: c } : null));
      if (!version || !isCampaignOpen(version.campaign, version, now))
        throw new DomainError('CAMPAIGN_NOT_ACTIVE', 'Esa campaña no está activa en este momento.');
      if (version.minAge > (user.ageVerifiedMinAge ?? 18))
        throw new DomainError('AGE_GATE_REQUIRED', `Esta experiencia es solo para mayores de ${version.minAge} años. Confirma tu edad para continuar.`);
      const draft = CampaignDraftSchema.parse(version.content);
      campaign = { id: version.campaign.id, slug: version.campaign.slug, title: draft.publicTitle, versionId: version.id };
      listed = draft.modules;
    }
    // Sin lista propia, rige la de la plataforma.
    const slugs = listed.length ? listed : [...((await this.settings.get('games.defaultModules')) as readonly string[])];
    const active = await this.activeModules(slugs);
    const bySlug = new Map(active.map((a) => [a.slug, a]));
    const ordered = slugs.map((s) => bySlug.get(s)).filter((a): a is ActiveModule => !!a);
    let routeB = 0;
    const allowed = ordered.filter((m) => m.manifest.route !== 'B' || ++routeB <= MAX_ROUTE_B_PER_CONTEXT).map((m) => m.slug);
    return { campaign, sessionId: input.sessionId, allowed };
  }

  async activeModules(slugs: readonly string[]): Promise<ActiveModule[]> {
    if (slugs.length === 0) return [];
    const rows = await this.prisma.moduleVersion.findMany({ where: { status: 'ACTIVO', module: { slug: { in: [...slugs] } } }, include: { module: true } });
    return rows.map((r) => ({
      moduleId: r.moduleId,
      slug: r.module.slug,
      versionId: r.id,
      version: r.version,
      manifest: GameManifestSchema.parse(r.manifest),
    }));
  }

  async catalog(user: User, input: { campaignSlug?: string; sessionId?: string }, now = new Date()): Promise<GameCatalog> {
    const ctx = await this.resolveContext(user, input, now);
    const modules = await this.activeModules(ctx.allowed);
    const progress = await this.chapterProgress(
      user.id,
      modules.map((m) => m.moduleId),
    );
    return {
      campaign: ctx.campaign ? { slug: ctx.campaign.slug, title: ctx.campaign.title } : null,
      games: ctx.allowed
        .map((slug) => modules.find((m) => m.slug === slug))
        .filter((m): m is ActiveModule => !!m)
        .map((m) => {
          const manifest = m.manifest;
          const total =
            manifest.delivery.kind === 'engine' && manifest.delivery.engine === 'chapters'
              ? ((manifest.delivery.config as { chapters: unknown[] }).chapters?.length ?? 0)
              : 0;
          return {
            moduleId: m.slug,
            title: manifest.title,
            description: manifest.description,
            route: manifest.route,
            icon: manifest.icon,
            minutes: manifest.minutes,
            players: manifest.players,
            kind: manifest.delivery.kind,
            progress: total ? { current: progress.get(m.moduleId)?.size ?? 0, total } : null,
          };
        }),
    };
  }

  /** Capítulos ya completados por la persona, por módulo (el progreso es del módulo, no de una versión). */
  async chapterProgress(userId: string, moduleIds: readonly string[]): Promise<Map<string, Set<string>>> {
    const out = new Map<string, Set<string>>();
    if (moduleIds.length === 0) return out;
    const rows = await this.prisma.missionProgress.findMany({
      where: { userId, moduleId: { in: [...moduleIds] }, status: 'VERIFICADA', preview: false, chapterId: { not: null } },
      select: { moduleId: true, chapterId: true },
    });
    for (const r of rows) {
      if (!r.moduleId || !r.chapterId) continue;
      out.set(r.moduleId, (out.get(r.moduleId) ?? new Set()).add(r.chapterId));
    }
    return out;
  }
}
