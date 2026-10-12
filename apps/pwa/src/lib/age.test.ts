import { describe, expect, it } from 'vitest';
import { checkBirthDate } from './age.ts';

const today = new Date(Date.UTC(2026, 9, 12)); // 12 oct. 2026

describe('checkBirthDate', () => {
  it('pide completar los campos', () => {
    expect(checkBirthDate({ day: '1', month: '', year: '' }, 18, today).kind).toBe('incomplete');
  });

  it('rechaza fechas imposibles o futuras', () => {
    expect(checkBirthDate({ day: '31', month: '02', year: '1990' }, 18, today).kind).toBe('invalid');
    expect(checkBirthDate({ day: '01', month: '01', year: '2030' }, 18, today).kind).toBe('invalid');
  });

  it('cumple 18 exactamente el día de su cumpleaños', () => {
    expect(checkBirthDate({ day: '12', month: '10', year: '2008' }, 18, today)).toEqual({ kind: 'ok', age: 18 });
    expect(checkBirthDate({ day: '13', month: '10', year: '2008' }, 18, today).kind).toBe('underage');
  });

  it('no excluye adultos mayores (sin límite superior — Guía Técnica §3.3)', () => {
    expect(checkBirthDate({ day: '01', month: '01', year: '1940' }, 18, today).kind).toBe('ok');
  });

  it('respeta una edad mínima de campaña mayor a 18', () => {
    expect(checkBirthDate({ day: '01', month: '01', year: '2006' }, 21, today).kind).toBe('underage');
  });
});
