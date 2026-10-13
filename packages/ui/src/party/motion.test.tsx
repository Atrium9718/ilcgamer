import { describe, expect, it } from 'vitest';
import { screenFacing, steadyTarget, tiltStep } from './motion.ts';

describe('El Frentazo: gesto de inclinación', () => {
  it('la pantalla vertical vale ~0, hacia el piso -1 y hacia el techo +1', () => {
    expect(screenFacing(90, 0)).toBeCloseTo(0);
    expect(screenFacing(0, 0)).toBeCloseTo(1);
    expect(screenFacing(180, 0)).toBeCloseTo(-1);
  });
  it('inclinar hacia el piso acierta, hacia el techo pasa, y hay que volver al centro para repetir', () => {
    expect(tiltStep(-0.6, 0, true)).toEqual({ action: 'correct', armed: false });
    expect(tiltStep(0.6, 0, true)).toEqual({ action: 'pass', armed: false });
    expect(tiltStep(-0.6, 0, false)).toEqual({ action: null, armed: false });
    expect(tiltStep(0.1, 0, false)).toEqual({ action: null, armed: true });
    expect(tiltStep(0.2, 0, true)).toEqual({ action: null, armed: true });
  });
  it('se mide respecto a la posición inicial', () => {
    expect(tiltStep(-0.4, 0.3, true).action).toBe('correct');
  });
});

describe('Mano de Cirujano: movimiento del círculo', () => {
  it('cambia de velocidad y de tamaño, y nunca se sale del área', () => {
    const w = 360;
    const h = 420;
    const speeds: number[] = [];
    const radii: number[] = [];
    let prev = steadyTarget(0, w, h, 40);
    for (let i = 1; i <= 600; i++) {
      const p = steadyTarget(i * 0.05, w, h, 40);
      speeds.push(Math.hypot(p.x - prev.x, p.y - prev.y));
      radii.push(p.r);
      expect(p.x - p.r).toBeGreaterThanOrEqual(0);
      expect(p.x + p.r).toBeLessThanOrEqual(w);
      expect(p.y - p.r).toBeGreaterThanOrEqual(0);
      expect(p.y + p.r).toBeLessThanOrEqual(h);
      prev = p;
    }
    expect(Math.max(...speeds)).toBeGreaterThan(Math.min(...speeds) * 3);
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(12);
  });
});
