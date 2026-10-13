import { describe, expect, it } from 'vitest';
import { defaultPartyManifest, MAX_PARTY_IMAGE_CHARS, PARTY_GAMES, PARTY_TEMPLATES, partyTextIssue, validateManifest } from '../src/index.ts';

describe('juegos de fiesta: contrato', () => {
  it('las siete plantillas son manifiestos válidos (Ruta A, sin puntuación, sin presión de alcohol)', () => {
    for (const g of PARTY_GAMES) {
      const r = validateManifest(defaultPartyManifest(g));
      expect(r.ok, `${g}: ${JSON.stringify(!r.ok && r.errors)}`).toBe(true);
    }
    expect(PARTY_GAMES).toHaveLength(7);
  });

  it('rechaza textos que incitan o penalizan con consumo de alcohol, con o sin tildes y mayúsculas', () => {
    for (const bad of [
      'Tómate un shot de aguardiente',
      'TOMA UN TRAGO',
      'haz fondo blanco',
      'imita a un borracho',
      'a tomarse un trago o shot',
      'te toca resaca',
      'brinda con ella',
    ]) {
      expect(partyTextIssue(bad), bad).not.toBeNull();
    }
    for (const ok of ['Cuenta tu mejor anécdota', 'Aguardiente Cristal', 'Copa Mundial', 'Toma agua y sigue', 'Feria de Manizales']) {
      expect(partyTextIssue(ok), ok).toBeNull();
    }
  });

  it('la validación del manifiesto señala el campo con el texto prohibido', () => {
    const m = defaultPartyManifest('truth-dare');
    (m.delivery.config as { dares: string[] }).dares = ['Tómate un shot sin manos', 'Baila 30 segundos', 'Canta una canción'];
    const r = validateManifest(m);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).some((k) => k.startsWith('delivery.config.dares.0'))).toBe(true);
  });

  it('un juego de fiesta no puede puntuar ni dar XP, y el girador no admite botella', () => {
    const scored = defaultPartyManifest('spinner');
    expect(validateManifest({ ...scored, scoring: { ...scored.scoring, parcheScoreMax: 10 } }).ok).toBe(false);
    const bottle = defaultPartyManifest('spinner');
    (bottle.delivery.config as { spinner: { shape: string } }).spinner.shape = 'botella';
    expect(validateManifest(bottle).ok).toBe(false);
  });

  it('exige lo mínimo de cada juego (listas y colores válidos)', () => {
    const short = defaultPartyManifest('never-never');
    (short.delivery.config as { phrases: string[] }).phrases = ['Una sola frase'];
    expect(validateManifest(short).ok).toBe(false);
    const color = defaultPartyManifest('steady-hand');
    (color.delivery.config as { look: { accent: string } }).look.accent = 'rojo';
    expect(validateManifest(color).ok).toBe(false);
    expect(PARTY_TEMPLATES.headband.config.game).toBe('headband');
  });
});

describe('plantillas: aislamiento', () => {
  it('cada manifiesto es una copia: cambiarlo no altera la plantilla', () => {
    const a = defaultPartyManifest('spinner');
    (a.delivery.config as { heading: string }).heading = 'OTRO';
    (a.players as { max: number }).max = 3;
    const b = defaultPartyManifest('spinner');
    expect((b.delivery.config as { heading: string }).heading).toBe('PICO DE FLECHA');
    expect(b.players.max).toBe(12);
  });

  it('el girador acepta una imagen propia en data: PNG/WebP/JPEG y rechaza SVG, enlaces externos o archivos enormes', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    const make = (image: string) => {
      const m = defaultPartyManifest('spinner');
      (m.delivery.config as { spinner: { image?: string } }).spinner.image = image;
      return validateManifest(m);
    };
    expect(make(png).ok).toBe(true);
    expect(make('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=').ok).toBe(false);
    expect(make('https://tercero.example/flecha.png').ok).toBe(false);
    expect(make(`data:image/png;base64,${'A'.repeat(MAX_PARTY_IMAGE_CHARS)}`).ok).toBe(false);
  });
});
