import { describe, expect, it } from 'vitest';
import { buildCardContent } from './shareCard.ts';

describe('contenido de la tarjeta social (Guía Técnica §5.10)', () => {
  it('celebra un logro cultural sin cifras, sin datos de la persona y sin presión', () => {
    const c = buildCardContent({ name: 'Guardianes del bosque', icon: 'eco' }, 'Los del bosque');
    const text = `${c.headline} ${c.message} ${c.badgeName}`;
    expect(text).toMatch(/Guardianes del bosque/);
    expect(text).not.toMatch(/\d/);
    expect(text).not.toMatch(/puntos|botella|tomar|beber|copas|\+57|@/i);
  });

  it('sin logros usa un texto genérico y neutral', () => {
    const c = buildCardContent(null);
    expect(c.headline).toBe('Descubriendo el origen');
    expect(`${c.headline}${c.message}`).not.toMatch(/\d/);
  });
});
