import { describe, expect, it } from 'vitest';
import { CampaignDraftSchema, CampaignRulesSchema, CampaignThemeSchema, PublishSchema } from '../src/index.ts';

const draft = {
  internalName: 'Feria de Manizales 2027',
  publicTitle: 'Feria de Manizales',
  objective: 'Activaciones válidas en bares aliados',
  kpi: 'Activaciones comerciales válidas',
  ownerTeam: 'Trade Marketing',
  brandSlugs: ['ron-viejo-de-caldas'],
  channels: ['ON_PREMISE'],
  startsAt: '2027-01-02T05:00:00.000Z',
  endsAt: '2027-01-12T05:00:00.000Z',
  rules: { pointsBySku: { 'RVC-8': 500 } },
  theme: { brand: 'ron-viejo-de-caldas' },
};

describe('reglas de campaña (esquema cerrado)', () => {
  it('aplica valores por defecto configurables (no constantes en código)', () => {
    const r = CampaignRulesSchema.parse({});
    expect(r).toMatchObject({ energyMinutes: 45, sessionEndsAtLocalTime: '06:00', limits: { activationsPerUserPerDay: 3 } });
  });

  it('rechaza mecánicas no soportadas (p. ej. premiar el intervalo entre botellas)', () => {
    expect(CampaignRulesSchema.safeParse({ rewardFastestRefill: true }).success).toBe(false);
    expect(CampaignRulesSchema.safeParse({ limits: { bottlesPerHour: 4 } }).success).toBe(false);
  });

  it('acota multiplicadores (máx. x3) y puntos por SKU', () => {
    expect(
      CampaignRulesSchema.safeParse({ multipliers: [{ label: 'Feria', factor: 5, startsAt: '2027-01-01T00:00:00Z', endsAt: '2027-01-02T00:00:00Z' }] }).success,
    ).toBe(false);
    expect(CampaignRulesSchema.safeParse({ pointsBySku: { 'RVC-8': -1 } }).success).toBe(false);
  });
});

describe('borrador de campaña', () => {
  it('acepta un borrador válido y exige edad mínima ≥ 18 y ventana coherente', () => {
    expect(CampaignDraftSchema.safeParse(draft).success).toBe(true);
    expect(CampaignDraftSchema.safeParse({ ...draft, minAge: 16 }).success).toBe(false);
    expect(CampaignDraftSchema.safeParse({ ...draft, endsAt: draft.startsAt }).success).toBe(false);
  });

  it('el tema solo admite variables de marca en hex', () => {
    expect(CampaignThemeSchema.safeParse({ brand: 'ilc', brandColors: { primary: '#000000' } }).success).toBe(false);
    expect(CampaignThemeSchema.safeParse({ brand: 'ilc', brandColors: { 'brand-accent': 'red' } }).success).toBe(false);
  });
});

describe('checklist de publicación (§16)', () => {
  it('solo acepta confirmaciones explícitas', () => {
    expect(PublishSchema.safeParse({ checklist: { menores: false } }).success).toBe(false);
    expect(PublishSchema.safeParse({ checklist: { inventado: true } }).success).toBe(false);
  });
});
