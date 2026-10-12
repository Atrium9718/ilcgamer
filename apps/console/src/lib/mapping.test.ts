import { CampaignDraftSchema } from '@ilc/contracts';
import { describe, expect, it } from 'vitest';
import { campaignView, DRAFT } from '../test/fakeApi.ts';
import { editorToDraft, isoToLocal, localToIso, permissionsFor, viewToEditor } from './mapping.ts';

describe('mapeo consola ↔ API', () => {
  it('las fechas se interpretan en hora de Colombia', () => {
    expect(localToIso('2026-12-15T00:00')).toBe('2026-12-15T05:00:00.000Z');
    expect(isoToLocal('2026-12-15T05:00:00.000Z')).toBe('2026-12-15T00:00');
    expect(localToIso('')).toBe('');
  });

  it('ida y vuelta del formulario conserva el contenido y lo que el formulario no edita', () => {
    const base = {
      ...DRAFT,
      rules: { ...DRAFT.rules, limits: { activationsPerUserPerDay: 3, activationsPerUserTotal: 40 } },
      theme: { ...DRAFT.theme, brandColors: { 'brand-surface': '#102030' } },
    };
    const view = campaignView({ state: 'BORRADOR' });
    view.workingVersion.draft = base;
    const editor = viewToEditor(view);
    const back = editorToDraft(
      {
        ...editor,
        accent: '#C9A227',
        points: [
          { sku: 'aa-750', points: 300 },
          { sku: ' ', points: 1 },
        ],
      },
      base,
    );
    expect(back.rules.limits).toEqual({ activationsPerUserPerDay: 3, activationsPerUserTotal: 40 });
    expect(back.theme.brandColors).toEqual({ 'brand-surface': '#102030', 'brand-accent': '#C9A227' });
    expect(back.rules.pointsBySku).toEqual({ 'AA-750': 300 });
    expect(back.startsAt).toBe(DRAFT.startsAt);
    expect(CampaignDraftSchema.safeParse(back).success).toBe(true);
  });

  it('los permisos de interfaz siguen los roles y el estado (la API vuelve a validarlos)', () => {
    const review = campaignView({ state: 'EN_REVISION' });
    expect(permissionsFor(['REVISOR_MARCA'], review).decideKinds).toEqual(['MARCA']);
    expect(permissionsFor(['ADMIN_MARCA'], review).decideKinds).toEqual([]);
    expect(permissionsFor(['EDITOR_CONTENIDO'], campaignView({ state: 'BORRADOR' }))).toMatchObject({ canEdit: true, canSubmit: true, canPublish: false });
    expect(permissionsFor(['ADMIN_MARCA'], campaignView({ state: 'APROBADA' })).canPublish).toBe(true);
    expect(permissionsFor(['EDITOR_CONTENIDO'], campaignView({ state: 'APROBADA' })).canPublish).toBe(false);
    expect(permissionsFor(['ADMIN_MARCA'], campaignView({ state: 'APROBADA', status: 'ACTIVA' })).transitions).toEqual(['pause', 'close']);
  });
});
