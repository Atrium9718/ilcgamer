import { readFile } from 'node:fs/promises';
import {
  APPROVER_ROLE,
  type DefaultModules,
  type GameManifest,
  GameManifestSchema,
  MAX_ROUTE_B_PER_CONTEXT,
  type ModuleVersionView,
  type ModuleView,
  requiredModuleApprovals,
  validateManifest,
} from '@ilc/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.ts';
import type { Actor } from '../campaigns/campaigns.service.ts';
import { contentHash } from '../campaigns/content-hash.ts';
import { hmac } from '../common/crypto.ts';
import { DomainError } from '../common/domain-error.ts';
import { ENV } from '../config/config.module.ts';
import { type Env, separationOfDutiesApplies } from '../config/env.ts';
import { Prisma } from '../generated/prisma/client.ts';
import { SettingsService } from '../platform/settings.service.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

type VersionRow = Prisma.ModuleVersionGetPayload<{ include: { approvals: true } }>;
const KIND_LABEL = { MARCA: 'Marca', JURIDICA: 'Jurídica', PRIVACIDAD: 'Privacidad', TI: 'TI' } as const;
const routeEnum = (r: 'A' | 'B') => (r === 'A' ? ('A_COMERCIAL' as const) : ('B_EXPERIENCIAL' as const));
const letter = (r: string) => (r === 'B_EXPERIENCIAL' ? ('B' as const) : ('A' as const));

/** Secreto con el que el proveedor de un módulo iframe firma sus confirmaciones. Se deriva; no se guarda. */
export const providerSecret = (appSecret: string, slug: string, epoch: number): string => hmac(appSecret, `provider:${slug}:${epoch}`);

/**
 * Ciclo de vida de los módulos (Guía Técnica §5.4): "El CMS debe permitir probar, aprobar, programar, desactivar y
 * revertir un módulo". Registrar → en prueba → aprobaciones ligadas al hash del manifiesto → activo; desactivar y
 * volver a una versión anterior aprobada. Nadie publica ni cambia código de un módulo sin pasar por aquí.
 */
@Injectable()
export class ModulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ───────── Consulta ─────────

  async list(): Promise<ModuleView[]> {
    const modules = await this.prisma.module.findMany({
      orderBy: { slug: 'asc' },
      include: { versions: { orderBy: { createdAt: 'desc' }, include: { approvals: { orderBy: { createdAt: 'asc' } } } } },
    });
    return modules.map((m) => ({
      moduleId: m.slug,
      provider: m.provider,
      route: letter(m.route),
      activeVersion: m.versions.find((v) => v.status === 'ACTIVO')?.version ?? null,
      versions: m.versions.map((v) => this.view(v)),
    }));
  }

  private view(v: VersionRow): ModuleVersionView {
    const manifest = GameManifestSchema.parse(v.manifest);
    return {
      version: v.version,
      status: v.status,
      manifest,
      manifestHash: v.manifestHash,
      approvals: this.approvalStatuses(v, manifest),
      createdAt: v.createdAt.toISOString(),
    };
  }

  private approvalStatuses(v: VersionRow, manifest: GameManifest): ModuleVersionView['approvals'] {
    const required = requiredModuleApprovals(manifest);
    return (['MARCA', 'JURIDICA', 'PRIVACIDAD'] as const).map((kind) => {
      const isRequired = required.includes(kind);
      // Solo cuenta lo emitido sobre el hash exacto; lo más reciente manda.
      const last = [...v.approvals].reverse().find((a) => a.kind === kind && a.contentHash === v.manifestHash);
      const status = !isRequired ? 'not_required' : !last ? 'pending' : last.decision === 'APROBADO' ? 'approved' : 'rejected';
      return { kind, required: isRequired, status, note: last?.note ?? null };
    });
  }

  private async load(slug: string, version: string) {
    const v = await this.prisma.moduleVersion.findFirst({ where: { module: { slug }, version }, include: { approvals: true, module: true } });
    if (!v) throw new DomainError('NOT_FOUND', 'No existe esa versión del módulo.');
    return v;
  }

  // ───────── Registro ─────────

  async register(actor: Actor, input: unknown): Promise<ModuleView> {
    const checked = validateManifest(input);
    if (!checked.ok) throw new DomainError('VALIDATION_FAILED', 'El manifiesto no es válido.', { fields: checked.errors });
    const m = checked.manifest;
    await this.assertBadges(m);
    try {
      await this.prisma.$transaction(async (tx) => {
        const existing = await tx.module.findUnique({ where: { slug: m.moduleId } });
        if (existing && (existing.provider !== m.provider || existing.route !== routeEnum(m.route))) {
          throw new DomainError('CONFLICT', 'El proveedor y la ruta de un módulo no cambian entre versiones. Registra otro identificador.');
        }
        const module = existing ?? (await tx.module.create({ data: { slug: m.moduleId, provider: m.provider, route: routeEnum(m.route) } }));
        await tx.moduleVersion.create({
          data: {
            moduleId: module.id,
            version: m.version,
            status: 'BORRADOR',
            manifest: m as unknown as Prisma.InputJsonValue,
            manifestHash: contentHash(m),
            createdById: actor.userId,
          },
        });
        await this.audit.record(
          {
            actorId: actor.userId,
            action: 'module.registered',
            resource: 'module',
            resourceId: module.id,
            requestId: actor.requestId,
            metadata: { moduleId: m.moduleId, version: m.version },
          },
          tx,
        );
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
        throw new DomainError('CONFLICT', `La versión ${m.version} de ${m.moduleId} ya existe. Sube un número de versión nuevo.`);
      throw err;
    }
    return this.one(m.moduleId);
  }

  /** La insignia del manifiesto debe existir en el catálogo (se crea antes en Economía → Insignias). */
  private async assertBadges(m: GameManifest): Promise<void> {
    const slugs = [
      m.badge,
      m.delivery.kind === 'engine' && m.delivery.engine === 'chapters' ? (m.delivery.config as { finalBadge?: string }).finalBadge : undefined,
    ].filter((x): x is string => !!x);
    for (const slug of new Set(slugs)) {
      if (!(await this.prisma.badge.findUnique({ where: { slug } }))) {
        throw new DomainError('VALIDATION_FAILED', 'La insignia no existe.', { fields: { badge: [`Crea primero la insignia «${slug}» en Economía`] } });
      }
    }
  }

  private async one(slug: string): Promise<ModuleView> {
    const found = (await this.list()).find((m) => m.moduleId === slug);
    if (!found) throw new DomainError('NOT_FOUND', 'No existe ese módulo.');
    return found;
  }

  // ───────── Prueba, aprobación y activación ─────────

  async toTest(actor: Actor, slug: string, version: string): Promise<ModuleView> {
    const v = await this.load(slug, version);
    if (v.status !== 'BORRADOR') throw new DomainError('CONFLICT', 'Solo un borrador pasa a prueba.');
    await this.prisma.$transaction(async (tx) => {
      await tx.moduleVersion.update({ where: { id: v.id }, data: { status: 'EN_PRUEBA', submittedById: actor.userId } });
      await this.audit.record(
        {
          actorId: actor.userId,
          action: 'module.testing',
          resource: 'module',
          resourceId: v.moduleId,
          requestId: actor.requestId,
          metadata: { moduleId: slug, version },
        },
        tx,
      );
    });
    return this.one(slug);
  }

  async decide(
    actor: Actor,
    slug: string,
    version: string,
    input: { kind: keyof typeof KIND_LABEL; decision: 'APROBADO' | 'RECHAZADO'; note?: string },
  ): Promise<ModuleView> {
    const v = await this.load(slug, version);
    if (v.status !== 'EN_PRUEBA') throw new DomainError('CONFLICT', 'Solo se aprueba una versión que está en prueba.');
    if (!actor.roles.includes(APPROVER_ROLE[input.kind]) && !actor.roles.includes('SUPERADMIN'))
      throw new DomainError('FORBIDDEN', 'Tu rol no puede emitir esta aprobación.');
    if (separationOfDutiesApplies(this.env) && (actor.userId === v.createdById || actor.userId === v.submittedById))
      throw new DomainError('FORBIDDEN', 'Quien registra o envía a prueba un módulo no puede aprobarlo.');
    const manifest = GameManifestSchema.parse(v.manifest);
    if (!requiredModuleApprovals(manifest).includes(input.kind)) throw new DomainError('CONFLICT', 'Este módulo no requiere esa aprobación.');
    await this.prisma.$transaction(async (tx) => {
      await tx.approvalRecord.create({
        data: { moduleVersionId: v.id, kind: input.kind, decision: input.decision, note: input.note, approverId: actor.userId, contentHash: v.manifestHash },
      });
      if (input.decision === 'RECHAZADO') {
        await tx.moduleVersion.update({ where: { id: v.id }, data: { status: 'BORRADOR', submittedById: null } });
      } else {
        const fresh = await tx.moduleVersion.findUniqueOrThrow({ where: { id: v.id }, include: { approvals: true } });
        if (this.approvalStatuses(fresh, manifest).every((a) => !a.required || a.status === 'approved')) {
          await tx.moduleVersion.update({ where: { id: v.id }, data: { status: 'APROBADO' } });
        }
      }
      await this.audit.record(
        {
          actorId: actor.userId,
          action: input.decision === 'APROBADO' ? 'module.approved' : 'module.rejected',
          resource: 'module',
          resourceId: v.moduleId,
          requestId: actor.requestId,
          reason: input.note,
          metadata: { moduleId: slug, version, kind: input.kind, manifestHash: v.manifestHash },
        },
        tx,
      );
    });
    return this.one(slug);
  }

  /** Activa una versión aprobada (o vuelve a una anterior ya aprobada). La versión activa previa queda desactivada. */
  async activate(actor: Actor, slug: string, version: string): Promise<ModuleView> {
    const v = await this.load(slug, version);
    if (v.status === 'ACTIVO') throw new DomainError('CONFLICT', 'Esa versión ya está activa.');
    if (v.status !== 'APROBADO' && v.status !== 'DESACTIVADO') throw new DomainError('CONFLICT', 'Solo se activa una versión aprobada.');
    const manifest = GameManifestSchema.parse(v.manifest);
    const missing = this.approvalStatuses(v, manifest).filter((a) => a.required && a.status !== 'approved');
    if (missing.length) throw new DomainError('CONFLICT', `No se puede activar: falta la aprobación de ${missing.map((a) => KIND_LABEL[a.kind]).join(' y ')}.`);
    await this.assertBadges(manifest);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.moduleVersion.updateMany({ where: { moduleId: v.moduleId, status: 'ACTIVO' }, data: { status: 'DESACTIVADO' } });
        await tx.moduleVersion.update({ where: { id: v.id }, data: { status: 'ACTIVO' } });
        await this.audit.record(
          {
            actorId: actor.userId,
            action: 'module.activated',
            resource: 'module',
            resourceId: v.moduleId,
            requestId: actor.requestId,
            metadata: { moduleId: slug, version, rollback: v.status === 'DESACTIVADO' },
          },
          tx,
        );
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
        throw new DomainError('CONFLICT', 'Otra persona activó una versión al mismo tiempo. Revisa el estado e intenta de nuevo.');
      throw err;
    }
    return this.one(slug);
  }

  async deactivate(actor: Actor, slug: string, reason: string): Promise<ModuleView> {
    const active = await this.prisma.moduleVersion.findFirst({ where: { module: { slug }, status: 'ACTIVO' } });
    if (!active) throw new DomainError('CONFLICT', 'Este módulo no tiene una versión activa.');
    await this.prisma.$transaction(async (tx) => {
      await tx.moduleVersion.update({ where: { id: active.id }, data: { status: 'DESACTIVADO' } });
      await this.audit.record(
        {
          actorId: actor.userId,
          action: 'module.deactivated',
          resource: 'module',
          resourceId: active.moduleId,
          requestId: actor.requestId,
          reason,
          metadata: { moduleId: slug, version: active.version },
        },
        tx,
      );
    });
    return this.one(slug);
  }

  // ───────── Contexto por defecto y reglas de Ruta B ─────────

  /**
   * Máximo 2 experiencias de Ruta B por persona en un contexto (Instrucciones §13.2). Cualquier lista de módulos
   * (campaña o plataforma) se valida aquí: los módulos existen y no hay más de 2 de Ruta B.
   */
  async assertModuleList(slugs: readonly string[], field: string): Promise<void> {
    if (new Set(slugs).size !== slugs.length)
      throw new DomainError('VALIDATION_FAILED', 'Hay juegos repetidos.', { fields: { [field]: ['Juegos repetidos'] } });
    if (slugs.length === 0) return;
    const found = await this.prisma.module.findMany({ where: { slug: { in: [...slugs] } }, select: { slug: true, route: true } });
    const unknown = slugs.filter((s) => !found.some((f) => f.slug === s));
    if (unknown.length)
      throw new DomainError('VALIDATION_FAILED', 'Hay juegos que no existen.', { fields: { [field]: [`No existen: ${unknown.join(', ')}`] } });
    if (found.filter((f) => f.route === 'B_EXPERIENCIAL').length > MAX_ROUTE_B_PER_CONTEXT) {
      throw new DomainError('VALIDATION_FAILED', `Máximo ${MAX_ROUTE_B_PER_CONTEXT} juegos de Ruta B por contexto.`, {
        fields: { [field]: [`Máximo ${MAX_ROUTE_B_PER_CONTEXT} experiencias de Ruta B; cambiar el límite requiere decisión formal`] },
      });
    }
  }

  async defaults(): Promise<DefaultModules> {
    return { modules: [...((await this.settings.get('games.defaultModules')) as readonly string[])] };
  }

  async setDefaults(actor: Actor, modules: string[]): Promise<DefaultModules> {
    await this.assertModuleList(modules, 'modules');
    await this.settings.set('games.defaultModules', modules, actor.userId);
    await this.audit.record({
      actorId: actor.userId,
      action: 'setting.updated',
      resource: 'platform_setting',
      resourceId: 'games.defaultModules',
      requestId: actor.requestId,
      metadata: { modules },
    });
    return { modules };
  }

  // ───────── Secreto del proveedor y guía ─────────

  /** Revela el secreto de firma de un módulo iframe a TI (queda en auditoría). `rotate` invalida el anterior. */
  async providerSecret(actor: Actor, slug: string, rotate: boolean): Promise<{ secret: string; epoch: number }> {
    const m = await this.prisma.module.findUnique({ where: { slug } });
    if (!m) throw new DomainError('NOT_FOUND', 'No existe ese módulo.');
    const updated = rotate ? await this.prisma.module.update({ where: { id: m.id }, data: { secretEpoch: { increment: 1 } } }) : m;
    await this.audit.record({
      actorId: actor.userId,
      action: rotate ? 'module.secret_rotated' : 'module.secret_revealed',
      resource: 'module',
      resourceId: m.id,
      requestId: actor.requestId,
      metadata: { moduleId: slug, epoch: updated.secretEpoch },
    });
    return { secret: providerSecret(this.env.APP_SECRET, slug, updated.secretEpoch), epoch: updated.secretEpoch };
  }

  /** Guía de integración para administradores (Instrucciones §13.1). Se empaqueta junto al build de la API. */
  async guide(): Promise<{ markdown: string }> {
    const candidates = [
      new URL('./INTEGRACION_JUEGOS.md', import.meta.url),
      new URL('../../../../docs/INTEGRACION_JUEGOS.md', import.meta.url),
      new URL('../INTEGRACION_JUEGOS.md', import.meta.url),
    ];
    for (const url of candidates) {
      try {
        return { markdown: await readFile(url, 'utf8') };
      } catch {
        /* siguiente ubicación */
      }
    }
    throw new DomainError('NOT_FOUND', 'La guía de integración no está disponible en este servidor.');
  }
}
