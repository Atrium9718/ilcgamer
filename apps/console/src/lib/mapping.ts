import {
  APPROVER_ROLE,
  type ApprovalStatus,
  type CampaignDraft,
  type CampaignSummary,
  type CampaignView,
  CHECKLIST_KEYS,
  type CreateCampaign,
  type CreateReward,
  PUBLISH_CHECKLIST,
  type Role,
} from '@ilc/contracts';
import type {
  ApprovalRow,
  CampaignDetailData,
  CampaignEditorValue,
  CampaignPermissions,
  CampaignRow,
  LifecycleAction,
  NewRewardValue,
  NewVenueValue,
} from '@ilc/ui';

/**
 * Traducción entre los contratos de la API y los modelos de las vistas puras de la consola.
 * Las fechas se editan y muestran en hora de Colombia (UTC−5, sin horario de verano), sin importar la zona
 * del equipo de quien edita: la vigencia de una campaña no puede depender del computador.
 */

export const TIME_ZONE = 'America/Bogota';
const OFFSET = '-05:00';
const OFFSET_MS = 5 * 60 * 60 * 1000;

export const BRANDS: ReadonlyArray<{ slug: string; label: string }> = [
  { slug: 'ilc', label: 'ILC corporativo' },
  { slug: 'ron-viejo-de-caldas', label: 'Ron Viejo de Caldas' },
  { slug: 'aguardiente-amarillo', label: 'Aguardiente Amarillo de Manzanares' },
  { slug: 'aguardiente-cristal', label: 'Aguardiente Cristal' },
];
const brandLabel = (slug: string) => BRANDS.find((b) => b.slug === slug)?.label ?? slug;

const CHANNEL_LABEL: Record<string, string> = { ON_PREMISE: 'On-premise', OFF_PREMISE: 'Off-premise', EVENTO: 'Eventos', DIGITAL: 'Digital' };
const VERSION_STATE_LABEL: Record<string, string> = {
  BORRADOR: 'Borrador',
  EN_REVISION: 'En revisión',
  APROBADA: 'Aprobada',
  PUBLICADA: 'Publicada',
  REEMPLAZADA: 'Reemplazada',
};

export const ROLE_LABEL: Record<string, string> = {
  SUPERADMIN: 'Superadministración',
  ADMIN_MARCA: 'Administración de marca',
  EDITOR_CONTENIDO: 'Edición de contenido',
  REVISOR_MARCA: 'Revisión de marca',
  REVISOR_JURIDICO: 'Revisión jurídica',
  RESPONSABLE_PRIVACIDAD: 'Privacidad',
  STAFF: 'Staff',
  DEALER: 'Comercio',
};

/** "2026-12-15T00:00" (hora Colombia) → ISO UTC. */
export function localToIso(local: string): string {
  if (!local) return '';
  const d = new Date(`${local.length === 16 ? `${local}:00` : local}${OFFSET}`);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/** ISO UTC → "2026-12-15T00:00" en hora Colombia (para <input type="datetime-local">). */
export function isoToLocal(iso: string): string {
  return new Date(new Date(iso).getTime() - OFFSET_MS).toISOString().slice(0, 16);
}

const dateFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TIME_ZONE });
const dateTimeFmt = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});
export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso));
export const windowLabel = (startsAt: string, endsAt: string) => `${formatDate(startsAt)} – ${formatDate(endsAt)}`;

export function summaryToRow(s: CampaignSummary): CampaignRow {
  return {
    slug: s.slug,
    internalName: s.internalName,
    route: s.route,
    status: s.status,
    brandLabels: s.brandSlugs.map(brandLabel),
    windowLabel: windowLabel(s.startsAt, s.endsAt),
    version: s.version,
    approvals: s.approvals,
  };
}

export function viewToDetail(c: CampaignView): CampaignDetailData {
  const w = c.workingVersion;
  const d = w.draft;
  return {
    slug: c.slug,
    internalName: d.internalName,
    publicTitle: d.publicTitle,
    publicDescription: d.publicDescription,
    objective: d.objective,
    kpi: d.kpi,
    ownerTeam: d.ownerTeam,
    route: c.route,
    status: c.status,
    brandLabels: d.brandSlugs.map(brandLabel),
    channelLabels: d.channels.map((ch) => CHANNEL_LABEL[ch] ?? ch),
    territories: d.territories,
    windowLabel: windowLabel(d.startsAt, d.endsAt),
    minAge: d.minAge,
    terms: d.terms,
    activeVersion: c.activeVersion,
    working: { version: w.version, state: w.state, stateLabel: VERSION_STATE_LABEL[w.state] ?? w.state },
    versions: c.versions.map((v) => ({ version: v.version, stateLabel: VERSION_STATE_LABEL[v.state] ?? v.state, createdLabel: formatDate(v.createdAt) })),
    rules: {
      pointsBySku: Object.entries(d.rules.pointsBySku).map(([sku, points]) => ({ sku, points })),
      multipliers: d.rules.multipliers.map((m) => ({ label: m.label, factor: m.factor, windowLabel: windowLabel(m.startsAt, m.endsAt) })),
      energyMinutes: d.rules.energyMinutes,
      sessionEndsAtLocalTime: d.rules.sessionEndsAtLocalTime,
      pointsExpiryDays: d.rules.pointsExpiryDays,
      activationsPerUserPerDay: d.rules.limits.activationsPerUserPerDay,
      activationsPerUserTotal: d.rules.limits.activationsPerUserTotal,
      xpPerActivation: d.rules.xpPerActivation,
    },
    theme: { mode: d.theme.mode, brand: d.theme.brand, accent: d.theme.brandColors?.['brand-accent'], surface: d.theme.brandColors?.['brand-surface'] },
    dataUsage: d.dataUsage,
  };
}

export function approvalRows(approvals: ApprovalStatus[]): ApprovalRow[] {
  return approvals.map((a) => ({
    kind: a.kind,
    required: a.required,
    status: a.status,
    byAlias: a.byAlias,
    atLabel: a.at ? formatDateTime(a.at) : null,
    note: a.note,
  }));
}

export const CHECKLIST = CHECKLIST_KEYS.map((key) => ({ key, label: PUBLISH_CHECKLIST[key] }));

/**
 * Qué puede hacer la persona según sus roles y el estado. Es solo para la interfaz: la API aplica de nuevo
 * cada regla (RBAC, separación de funciones, contenido aprobado) y es la que decide.
 */
export function permissionsFor(roles: readonly string[], c: CampaignView): CampaignPermissions {
  const has = (...r: Role[]) => roles.includes('SUPERADMIN') || r.some((x) => roles.includes(x));
  const state = c.workingVersion.state;
  const editor = has('ADMIN_MARCA', 'EDITOR_CONTENIDO');
  const publisher = has('ADMIN_MARCA');
  const closed = c.status === 'CERRADA' || c.status === 'ARCHIVADA';
  const decideKinds =
    state === 'EN_REVISION'
      ? c.workingVersion.approvals.filter((a) => a.required && a.status === 'pending' && has(APPROVER_ROLE[a.kind])).map((a) => a.kind)
      : [];
  const transitions: LifecycleAction[] = [];
  if (publisher) {
    if (c.status === 'ACTIVA') transitions.push('pause');
    if (c.status === 'PAUSADA') transitions.push('resume');
    if (c.status === 'PROGRAMADA' || c.status === 'ACTIVA' || c.status === 'PAUSADA') transitions.push('close');
    if (c.status === 'BORRADOR' || c.status === 'CERRADA') transitions.push('archive');
  }
  return {
    canEdit: editor && state === 'BORRADOR' && !closed,
    canSubmit: editor && state === 'BORRADOR' && !closed,
    canNewVersion: editor && state === 'PUBLICADA' && !closed,
    canPublish: publisher && state === 'APROBADA',
    decideKinds,
    transitions,
  };
}

export const canCreateCampaign = (roles: readonly string[]) => roles.some((r) => r === 'SUPERADMIN' || r === 'ADMIN_MARCA' || r === 'EDITOR_CONTENIDO');

export function emptyEditorValue(): CampaignEditorValue {
  return {
    slug: '',
    route: 'A_COMERCIAL',
    internalName: '',
    publicTitle: '',
    publicDescription: '',
    objective: '',
    kpi: '',
    ownerTeam: '',
    brandSlugs: [],
    channels: [],
    territoriesText: '',
    minAge: 18,
    startsAt: '',
    endsAt: '',
    terms: '',
    points: [],
    multipliers: [],
    energyMinutes: 45,
    sessionEndsAtLocalTime: '06:00',
    pointsExpiryDays: null,
    activationsPerUserPerDay: 3,
    xpPerActivation: null,
    modules: [],
    themeMode: 'dark',
    themeBrand: 'ilc',
    accent: null,
    location: false,
    extraData: false,
  };
}

export function viewToEditor(c: CampaignView): CampaignEditorValue {
  const d = c.workingVersion.draft;
  return {
    slug: c.slug,
    route: c.route,
    internalName: d.internalName,
    publicTitle: d.publicTitle,
    publicDescription: d.publicDescription,
    objective: d.objective,
    kpi: d.kpi,
    ownerTeam: d.ownerTeam,
    brandSlugs: d.brandSlugs,
    channels: d.channels,
    territoriesText: d.territories.join(', '),
    minAge: d.minAge,
    startsAt: isoToLocal(d.startsAt),
    endsAt: isoToLocal(d.endsAt),
    terms: d.terms,
    points: Object.entries(d.rules.pointsBySku).map(([sku, points]) => ({ sku, points })),
    multipliers: d.rules.multipliers.map((m) => ({ label: m.label, factor: m.factor, startsAt: isoToLocal(m.startsAt), endsAt: isoToLocal(m.endsAt) })),
    energyMinutes: d.rules.energyMinutes,
    sessionEndsAtLocalTime: d.rules.sessionEndsAtLocalTime,
    pointsExpiryDays: d.rules.pointsExpiryDays ?? null,
    activationsPerUserPerDay: d.rules.limits.activationsPerUserPerDay,
    xpPerActivation: d.rules.xpPerActivation ?? null,
    modules: d.modules,
    themeMode: d.theme.mode,
    themeBrand: d.theme.brand,
    accent: d.theme.brandColors?.['brand-accent'] ?? null,
    location: d.dataUsage.location,
    extraData: d.dataUsage.extraData,
  };
}

/**
 * Formulario → contenido de versión. `base` conserva los campos que el formulario no edita
 * (p. ej. el tope total de activaciones o colores de superficie del tema) para no borrarlos al guardar.
 */
export function editorToDraft(v: CampaignEditorValue, base?: CampaignDraft): CampaignDraft {
  const baseColors = base?.theme.brandColors ?? {};
  const { 'brand-accent': _accent, ...otherColors } = baseColors;
  const brandColors = { ...otherColors, ...(v.accent ? { 'brand-accent': v.accent } : {}) };
  return {
    internalName: v.internalName.trim(),
    publicTitle: v.publicTitle.trim(),
    publicDescription: v.publicDescription.trim(),
    objective: v.objective.trim(),
    kpi: v.kpi.trim(),
    ownerTeam: v.ownerTeam.trim(),
    brandSlugs: v.brandSlugs,
    channels: v.channels,
    territories: v.territoriesText
      .split(/[,\n]/)
      .map((t) => t.trim())
      .filter(Boolean),
    minAge: v.minAge,
    startsAt: localToIso(v.startsAt),
    endsAt: localToIso(v.endsAt),
    terms: v.terms.trim(),
    rules: {
      pointsBySku: Object.fromEntries(v.points.filter((p) => p.sku.trim()).map((p) => [p.sku.trim().toUpperCase(), p.points])),
      multipliers: v.multipliers.map((m) => ({ label: m.label.trim(), factor: m.factor, startsAt: localToIso(m.startsAt), endsAt: localToIso(m.endsAt) })),
      energyMinutes: v.energyMinutes,
      sessionEndsAtLocalTime: v.sessionEndsAtLocalTime,
      ...(v.pointsExpiryDays ? { pointsExpiryDays: v.pointsExpiryDays } : {}),
      // La XP por activación solo se envía en campañas mixtas (la API la rechaza en las demás).
      ...(v.route === 'MIXTA' && v.xpPerActivation ? { xpPerActivation: v.xpPerActivation } : {}),
      limits: { ...base?.rules.limits, activationsPerUserPerDay: v.activationsPerUserPerDay },
    },
    theme: { mode: v.themeMode, brand: v.themeBrand, ...(Object.keys(brandColors).length ? { brandColors } : {}) },
    dataUsage: { location: v.location, extraData: v.extraData },
    modules: v.modules,
  };
}

export const editorToCreate = (v: CampaignEditorValue): CreateCampaign => ({ slug: v.slug, route: v.route, draft: editorToDraft(v) });

export function roleLabel(roles: readonly string[]): string {
  const labels = roles.map((r) => ROLE_LABEL[r]).filter(Boolean);
  return labels.length ? labels.join(' · ') : 'Sin rol de consola';
}

// ───────────── Recompensas ─────────────

export const emptyRewardForm = (): NewRewardValue => ({
  slug: '',
  name: '',
  description: '',
  type: 'MERCHANDISING',
  cost: 0,
  conditionsText: '',
  maxPerUser: 1,
  startsAt: '',
  endsAt: '',
  fulfillment: '',
  campaignSlug: '',
  zonesText: '',
});

/** Medianoche de Colombia (UTC-5) del día indicado, en ISO. */
const bogotaMidnight = (date: string, addDays = 0): string => {
  const d = new Date(`${date}T05:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + addDays);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
};

/** "Manizales: 10" o "Manizales: 10: 3" (cantidad y umbral de alerta) → zonas del contrato. */
export function parseZones(text: string): CreateReward['zones'] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [zone = '', qty = '', alert] = line.split(':').map((x) => x.trim());
      return { zone, available: Number(qty), lowStockAlert: alert === undefined || alert === '' ? 5 : Number(alert) };
    });
}

/** Formulario → contrato. Las fechas son días completos de Colombia: el último día incluye hasta la medianoche siguiente. */
export function rewardFormToInput(v: NewRewardValue): CreateReward {
  return {
    slug: v.slug.trim(),
    name: v.name.trim(),
    description: v.description.trim(),
    type: v.type,
    icon: 'redeem',
    cost: v.cost,
    conditions: v.conditionsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
    maxPerUser: v.maxPerUser,
    startsAt: bogotaMidnight(v.startsAt),
    endsAt: bogotaMidnight(v.endsAt, 1),
    fulfillment: v.fulfillment.trim(),
    ...(v.campaignSlug ? { campaignSlug: v.campaignSlug } : {}),
    zones: parseZones(v.zonesText),
  };
}

// ───────────── Comercios ─────────────

export const emptyVenueForm = (): NewVenueValue => ({ name: '', channel: 'ON_PREMISE', city: '', department: '', address: '' });
