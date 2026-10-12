import {
  APPROVAL_KINDS,
  APPROVER_ROLE,
  type ApprovalDecisionInput,
  type ApprovalStatus,
  type CampaignDraft,
  CampaignDraftSchema,
  type CampaignSummary,
  type CampaignView,
  CHECKLIST_KEYS,
  type CreateCampaign,
  type PublicCampaign,
  type Role,
} from '@ilc/contracts';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.ts';
import { DomainError } from '../common/domain-error.ts';
import type { ApprovalRecord, Campaign, CampaignVersion, Prisma } from '../generated/prisma/client.ts';
import type { CampaignStatus } from '../generated/prisma/enums.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { isCampaignOpen, MANUAL_TRANSITIONS, type ManualAction } from './campaign-state.ts';
import { contentHash } from './content-hash.ts';

export interface Actor {
  userId: string;
  alias: string;
  roles: Role[];
  requestId: string;
}

type VersionWithApprovals = CampaignVersion & { approvals: (ApprovalRecord & { approverAlias?: string })[] };

const WORKING_STATES = ['BORRADOR', 'EN_REVISION', 'APROBADA'] as const;

/** Columnas de consulta que se copian del contenido validado. */
function denormalize(draft: CampaignDraft) {
  return {
    objective: draft.objective,
    channels: draft.channels,
    territories: draft.territories,
    minAge: draft.minAge,
    startsAt: new Date(draft.startsAt),
    endsAt: new Date(draft.endsAt),
    rules: draft.rules as Prisma.InputJsonValue,
    themeId: draft.theme.brand,
    content: draft as unknown as Prisma.InputJsonValue,
    contentHash: contentHash(draft),
  };
}

/**
 * Campañas versionadas con gobierno editorial (Guía Técnica §5.3, §5.11):
 * borrador → revisión (marca, jurídica, privacidad si aplica) → aprobada → publicada (con checklist §16)
 * → programada/activa → pausada/cerrada → archivada. Una aprobación vale solo para el hash exacto revisado.
 */
/** Solo una campaña MIXTA puede vincular Puntos ILC con XP (Guía Técnica §5.7). */
function assertEconomyLink(route: string, draft: CampaignDraft): void {
  if (draft.rules.xpPerActivation && route !== 'MIXTA') {
    throw new DomainError('VALIDATION_FAILED', 'Solo las campañas mixtas pueden otorgar XP por activación.', {
      fields: { 'draft.rules.xpPerActivation': ['Solo en campañas mixtas'] },
    });
  }
}

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ───────────── Lectura ─────────────

  async list(status?: CampaignStatus): Promise<CampaignSummary[]> {
    const campaigns = await this.prisma.campaign.findMany({
      where: status ? { status } : { status: { not: 'ARCHIVADA' } },
      orderBy: { updatedAt: 'desc' },
      include: { versions: { orderBy: { version: 'desc' }, take: 1, include: { approvals: true } } },
    });
    return campaigns.flatMap((c) => {
      const v = c.versions[0];
      if (!v) return [];
      const draft = v.content as unknown as CampaignDraft;
      return [
        {
          slug: c.slug,
          internalName: draft.internalName,
          route: c.route,
          status: c.status,
          brandSlugs: draft.brandSlugs,
          startsAt: v.startsAt.toISOString(),
          endsAt: v.endsAt.toISOString(),
          version: v.version,
          approvals: this.approvalStatuses(v).map(({ kind, status }) => ({ kind, status })),
        },
      ];
    });
  }

  async get(slug: string): Promise<CampaignView> {
    const campaign = await this.findCampaign(slug);
    return this.view(campaign);
  }

  /** Vista pública: solo campañas activas dentro de su ventana; lo demás responde "no existe" (§5.3). */
  async publicView(slug: string, now = new Date()): Promise<PublicCampaign> {
    const campaign = await this.prisma.campaign.findUnique({ where: { slug }, include: { activeVersion: true } });
    if (!campaign || !isCampaignOpen(campaign, campaign.activeVersion, now) || !campaign.activeVersion) throw new DomainError('NOT_FOUND');
    const d = campaign.activeVersion.content as unknown as CampaignDraft;
    return {
      slug: campaign.slug,
      title: d.publicTitle,
      description: d.publicDescription,
      route: campaign.route,
      minAge: d.minAge,
      startsAt: d.startsAt,
      endsAt: d.endsAt,
      theme: d.theme,
      energyMinutes: d.rules.energyMinutes,
      terms: d.terms,
    };
  }

  // ───────────── Edición ─────────────

  async create(actor: Actor, input: CreateCampaign): Promise<CampaignView> {
    if (await this.prisma.campaign.findUnique({ where: { slug: input.slug } }))
      throw new DomainError('CONFLICT', 'Ya existe una campaña con ese identificador.');
    assertEconomyLink(input.route, input.draft);
    const campaign = await this.prisma.$transaction(async (tx) => {
      const c = await tx.campaign.create({ data: { slug: input.slug, internalName: input.draft.internalName, route: input.route, status: 'BORRADOR' } });
      await tx.campaignVersion.create({ data: { campaignId: c.id, version: 1, createdById: actor.userId, ...denormalize(input.draft) } });
      await this.audit.record({ actorId: actor.userId, action: 'campaign.created', resource: 'campaign', resourceId: c.id, requestId: actor.requestId }, tx);
      return c;
    });
    return this.get(campaign.slug);
  }

  /** Solo una versión en BORRADOR se edita. El nuevo hash invalida cualquier aprobación anterior. */
  async updateDraft(actor: Actor, slug: string, draftInput: CampaignDraft): Promise<CampaignView> {
    const draft = CampaignDraftSchema.parse(draftInput);
    const campaign = await this.findCampaign(slug);
    const working = this.working(campaign);
    if (working.state !== 'BORRADOR') throw new DomainError('CONFLICT', 'Esta versión ya está en revisión o aprobada. Crea una nueva versión para cambiarla.');
    assertEconomyLink(campaign.route, draft);
    await this.prisma.$transaction(async (tx) => {
      await tx.campaignVersion.update({ where: { id: working.id }, data: denormalize(draft) });
      await tx.campaign.update({ where: { id: campaign.id }, data: { internalName: draft.internalName } });
      await this.audit.record(
        {
          actorId: actor.userId,
          action: 'campaign.draft_updated',
          resource: 'campaign',
          resourceId: campaign.id,
          requestId: actor.requestId,
          metadata: { version: working.version },
        },
        tx,
      );
    });
    return this.get(slug);
  }

  /** Nueva versión a partir de la publicada (campaña en curso). Requiere que no haya otra versión de trabajo. */
  async newVersion(actor: Actor, slug: string): Promise<CampaignView> {
    const campaign = await this.findCampaign(slug);
    if (campaign.versions.some((v) => (WORKING_STATES as readonly string[]).includes(v.state))) {
      throw new DomainError('CONFLICT', 'Ya hay una versión en edición o revisión.');
    }
    const base = campaign.versions.find((v) => v.state === 'PUBLICADA') ?? campaign.versions[0];
    if (!base) throw new DomainError('NOT_FOUND');
    const next = Math.max(...campaign.versions.map((v) => v.version)) + 1;
    await this.prisma.$transaction(async (tx) => {
      await tx.campaignVersion.create({
        data: { campaignId: campaign.id, version: next, createdById: actor.userId, ...denormalize(base.content as unknown as CampaignDraft) },
      });
      await this.audit.record(
        {
          actorId: actor.userId,
          action: 'campaign.version_created',
          resource: 'campaign',
          resourceId: campaign.id,
          requestId: actor.requestId,
          metadata: { version: next },
        },
        tx,
      );
    });
    return this.get(slug);
  }

  async submit(actor: Actor, slug: string): Promise<CampaignView> {
    const campaign = await this.findCampaign(slug);
    const working = this.working(campaign);
    if (working.state !== 'BORRADOR') throw new DomainError('CONFLICT', 'Solo un borrador se puede enviar a revisión.');
    CampaignDraftSchema.parse(working.content);
    await this.prisma.$transaction(async (tx) => {
      await tx.campaignVersion.update({ where: { id: working.id }, data: { state: 'EN_REVISION', submittedAt: new Date(), submittedById: actor.userId } });
      if (campaign.status === 'BORRADOR') await tx.campaign.update({ where: { id: campaign.id }, data: { status: 'EN_REVISION' } });
      await this.audit.record(
        {
          actorId: actor.userId,
          action: 'campaign.submitted',
          resource: 'campaign',
          resourceId: campaign.id,
          requestId: actor.requestId,
          metadata: { version: working.version, contentHash: working.contentHash },
        },
        tx,
      );
    });
    return this.get(slug);
  }

  // ───────────── Aprobaciones ─────────────

  /**
   * Decisión de un revisor (§5.11). Reglas:
   * - Solo el rol correspondiente emite cada tipo (o SUPERADMIN).
   * - Separación de funciones: quien creó o envió la versión no puede aprobarla.
   * - La aprobación queda ligada al hash del contenido revisado.
   * - Un rechazo devuelve la versión a borrador; con todas las requeridas aprobadas pasa a APROBADA.
   */
  async decide(actor: Actor, slug: string, input: ApprovalDecisionInput): Promise<CampaignView> {
    const campaign = await this.findCampaign(slug);
    const working = this.working(campaign);
    if (working.state !== 'EN_REVISION') throw new DomainError('CONFLICT', 'La versión no está en revisión.');
    if (!actor.roles.includes(APPROVER_ROLE[input.kind]) && !actor.roles.includes('SUPERADMIN')) {
      throw new DomainError('FORBIDDEN', 'Tu rol no puede emitir esta aprobación.');
    }
    if (actor.userId === working.createdById || actor.userId === working.submittedById) {
      throw new DomainError('FORBIDDEN', 'Quien crea o envía una versión no puede aprobarla.');
    }
    if (!this.requiredKinds(working).includes(input.kind)) throw new DomainError('CONFLICT', 'Esta versión no requiere esa aprobación.');

    await this.prisma.$transaction(async (tx) => {
      await tx.approvalRecord.create({
        data: {
          campaignVersionId: working.id,
          kind: input.kind,
          decision: input.decision,
          note: input.note,
          approverId: actor.userId,
          contentHash: working.contentHash,
        },
      });
      if (input.decision === 'RECHAZADO') {
        await tx.campaignVersion.update({ where: { id: working.id }, data: { state: 'BORRADOR', submittedAt: null, submittedById: null } });
        if (campaign.status === 'EN_REVISION') await tx.campaign.update({ where: { id: campaign.id }, data: { status: 'BORRADOR' } });
      } else {
        const fresh = await tx.campaignVersion.findUniqueOrThrow({ where: { id: working.id }, include: { approvals: true } });
        const allApproved = this.approvalStatuses(fresh).every((a) => !a.required || a.status === 'approved');
        if (allApproved) {
          await tx.campaignVersion.update({ where: { id: working.id }, data: { state: 'APROBADA' } });
          if (campaign.status === 'EN_REVISION') await tx.campaign.update({ where: { id: campaign.id }, data: { status: 'APROBADA' } });
        }
      }
      await this.audit.record(
        {
          actorId: actor.userId,
          action: input.decision === 'APROBADO' ? 'campaign.approved' : 'campaign.rejected',
          resource: 'campaign',
          resourceId: campaign.id,
          requestId: actor.requestId,
          reason: input.note,
          metadata: { kind: input.kind, version: working.version, contentHash: working.contentHash },
        },
        tx,
      );
    });
    return this.get(slug);
  }

  // ───────────── Publicación y ciclo de vida ─────────────

  /** Publica la versión aprobada. Bloquea si falta cualquier aprobación o confirmación del checklist (§5.11, §16). */
  async publish(actor: Actor, slug: string, checklist: Record<string, true>, now = new Date()): Promise<CampaignView> {
    const campaign = await this.findCampaign(slug);
    const working = this.working(campaign);
    const missing = this.publishMissing(working, checklist);
    if (missing.length) throw new DomainError('CONFLICT', `No se puede publicar: ${missing.join('; ')}.`);
    if (working.endsAt.getTime() <= now.getTime()) throw new DomainError('CONFLICT', 'La ventana de la campaña ya terminó.');

    const firstPublication = !campaign.activeVersionId;
    const status: CampaignStatus =
      firstPublication || campaign.status === 'PROGRAMADA' ? (working.startsAt.getTime() > now.getTime() ? 'PROGRAMADA' : 'ACTIVA') : campaign.status;

    await this.prisma.$transaction(async (tx) => {
      await tx.campaignVersion.updateMany({ where: { campaignId: campaign.id, state: 'PUBLICADA' }, data: { state: 'REEMPLAZADA' } });
      await tx.campaignVersion.update({
        where: { id: working.id },
        data: { state: 'PUBLICADA', publishedAt: now, publishedById: actor.userId, publishChecklist: checklist },
      });
      await tx.campaign.update({ where: { id: campaign.id }, data: { activeVersionId: working.id, status } });
      await this.audit.record(
        {
          actorId: actor.userId,
          action: 'campaign.published',
          resource: 'campaign',
          resourceId: campaign.id,
          requestId: actor.requestId,
          metadata: { version: working.version, status, contentHash: working.contentHash },
        },
        tx,
      );
    });
    return this.get(slug);
  }

  async transition(actor: Actor, slug: string, action: ManualAction, now = new Date()): Promise<CampaignView> {
    const campaign = await this.findCampaign(slug);
    const rule = MANUAL_TRANSITIONS[action];
    if (!(rule.from as readonly string[]).includes(campaign.status)) {
      throw new DomainError('CONFLICT', `No se puede ${ACTION_LABEL[action]} una campaña en estado ${campaign.status}.`);
    }
    if (action === 'resume') {
      const active = campaign.versions.find((v) => v.id === campaign.activeVersionId);
      if (!active || active.endsAt.getTime() <= now.getTime()) throw new DomainError('CONFLICT', 'La ventana de la campaña ya terminó.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.campaign.update({ where: { id: campaign.id }, data: { status: rule.to } });
      if (rule.to === 'CERRADA') await this.expireCodes(campaign.id, tx);
      await this.audit.record(
        {
          actorId: actor.userId,
          action: `campaign.${action}`,
          resource: 'campaign',
          resourceId: campaign.id,
          requestId: actor.requestId,
          metadata: { from: campaign.status, to: rule.to },
        },
        tx,
      );
    });
    return this.get(slug);
  }

  /** Transiciones automáticas por fecha. La ejecuta el programador cada minuto (y las pruebas con `now`). */
  async tick(now = new Date()): Promise<{ activated: number; closed: number }> {
    const due = await this.prisma.campaign.findMany({
      where: {
        OR: [
          { status: 'PROGRAMADA', activeVersion: { startsAt: { lte: now } } },
          { status: { in: ['PROGRAMADA', 'ACTIVA', 'PAUSADA'] }, activeVersion: { endsAt: { lte: now } } },
        ],
      },
      include: { activeVersion: true },
    });
    let activated = 0;
    let closed = 0;
    for (const c of due) {
      const ended = (c.activeVersion?.endsAt.getTime() ?? 0) <= now.getTime();
      const to: CampaignStatus = ended ? 'CERRADA' : 'ACTIVA';
      // Actualización condicional: si dos instancias corren a la vez, solo una aplica el cambio.
      const res = await this.prisma.campaign.updateMany({ where: { id: c.id, status: c.status }, data: { status: to } });
      if (res.count === 0) continue;
      if (ended) await this.expireCodes(c.id);
      await this.audit.record({
        actorId: null,
        action: `campaign.auto_${ended ? 'closed' : 'activated'}`,
        resource: 'campaign',
        resourceId: c.id,
        metadata: { from: c.status, to },
      });
      if (ended) closed++;
      else activated++;
    }
    return { activated, closed };
  }

  // ───────────── Auxiliares ─────────────

  /** Al cerrar una campaña sus códigos sin reclamar pasan a EXPIRADO (§5.6); los reclamados no cambian. */
  private expireCodes(campaignId: string, tx: Prisma.TransactionClient = this.prisma) {
    return tx.campaignCode.updateMany({ where: { campaignId, status: { in: ['CREADO', 'DISPONIBLE'] } }, data: { status: 'EXPIRADO' } });
  }

  private async findCampaign(slug: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { slug },
      include: { versions: { orderBy: { version: 'desc' }, include: { approvals: { orderBy: { createdAt: 'asc' } } } } },
    });
    if (!campaign) throw new DomainError('NOT_FOUND', 'No existe esa campaña.');
    return campaign;
  }

  /** Versión de trabajo: la que está en edición/revisión; si no hay, la publicada (o la última). */
  private working(campaign: Campaign & { versions: VersionWithApprovals[] }): VersionWithApprovals {
    const v =
      campaign.versions.find((x) => (WORKING_STATES as readonly string[]).includes(x.state)) ??
      campaign.versions.find((x) => x.state === 'PUBLICADA') ??
      campaign.versions[0];
    if (!v) throw new DomainError('NOT_FOUND');
    return v;
  }

  private requiredKinds(version: CampaignVersion): Array<(typeof APPROVAL_KINDS)[number]> {
    const usage = (version.content as unknown as CampaignDraft).dataUsage;
    return usage?.location || usage?.extraData ? ['MARCA', 'JURIDICA', 'PRIVACIDAD'] : ['MARCA', 'JURIDICA'];
  }

  /** Estado por tipo: cuenta solo la última decisión emitida sobre el hash ACTUAL del contenido. */
  private approvalStatuses(version: VersionWithApprovals, aliases: Map<string, string> = new Map()): ApprovalStatus[] {
    const required = this.requiredKinds(version);
    return APPROVAL_KINDS.filter((k) => k !== 'TI').map((kind) => {
      const last = [...version.approvals].reverse().find((a) => a.kind === kind && a.contentHash === version.contentHash);
      const isRequired = required.includes(kind);
      return {
        kind,
        required: isRequired,
        status: !isRequired ? 'not_required' : !last ? 'pending' : last.decision === 'APROBADO' ? 'approved' : 'rejected',
        byAlias: last ? (aliases.get(last.approverId) ?? null) : null,
        at: last?.createdAt.toISOString() ?? null,
        note: last?.note ?? null,
      };
    });
  }

  private publishMissing(version: VersionWithApprovals, checklist: Record<string, true> | null): string[] {
    const missing: string[] = [];
    if (version.state === 'PUBLICADA') return ['la versión ya está publicada'];
    if (version.state !== 'APROBADA') missing.push('la versión no está aprobada');
    for (const a of this.approvalStatuses(version)) {
      if (a.required && a.status !== 'approved') missing.push(`aprobación de ${KIND_LABEL[a.kind]}`);
    }
    if (checklist) {
      const pending = CHECKLIST_KEYS.filter((k) => checklist[k] !== true);
      if (pending.length) missing.push(`checklist (${pending.length} pendientes)`);
    }
    return missing;
  }

  private async view(campaign: Campaign & { versions: VersionWithApprovals[] }): Promise<CampaignView> {
    const working = this.working(campaign);
    const approverIds = [...new Set(working.approvals.map((a) => a.approverId))];
    const users = approverIds.length ? await this.prisma.user.findMany({ where: { id: { in: approverIds } }, select: { id: true, alias: true } }) : [];
    const aliases = new Map(users.map((u) => [u.id, u.alias]));
    const active = campaign.versions.find((v) => v.id === campaign.activeVersionId);
    const missing = this.publishMissing(working, null);
    return {
      id: campaign.id,
      slug: campaign.slug,
      route: campaign.route,
      status: campaign.status,
      activeVersion: active?.version ?? null,
      workingVersion: {
        id: working.id,
        version: working.version,
        state: working.state,
        contentHash: working.contentHash,
        draft: working.content as unknown as CampaignDraft,
        createdAt: working.createdAt.toISOString(),
        submittedAt: working.submittedAt?.toISOString() ?? null,
        publishedAt: working.publishedAt?.toISOString() ?? null,
        approvals: this.approvalStatuses(working, aliases),
      },
      versions: campaign.versions.map((v) => ({ version: v.version, state: v.state, createdAt: v.createdAt.toISOString() })),
      // "allowed" = aprobaciones completas; el checklist §16 se confirma al publicar.
      publish: { allowed: missing.length === 0, missing },
      updatedAt: campaign.updatedAt.toISOString(),
    };
  }
}

const KIND_LABEL: Record<(typeof APPROVAL_KINDS)[number], string> = { MARCA: 'Marca', JURIDICA: 'Jurídica', PRIVACIDAD: 'Privacidad', TI: 'TI' };
const ACTION_LABEL: Record<ManualAction, string> = { pause: 'pausar', resume: 'reanudar', close: 'cerrar', archive: 'archivar' };
