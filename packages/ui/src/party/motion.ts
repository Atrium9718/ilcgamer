/* Lógica pura de movimiento de los juegos de fiesta (probada sin navegador). */

/**
 * Componente vertical de la «normal» de la pantalla a partir de la orientación del equipo (grados):
 * 1 = pantalla hacia el techo, 0 = pantalla vertical (como en la frente), -1 = pantalla hacia el piso.
 * No depende de si el celular está en vertical u horizontal.
 */
export function screenFacing(beta: number, gamma: number): number {
  const rad = Math.PI / 180;
  return Math.cos(beta * rad) * Math.cos(gamma * rad);
}

export type TiltAction = 'correct' | 'pass' | null;

export const TILT_TRIGGER = 0.5;
export const TILT_REARM = 0.22;

/**
 * Gesto de «El Frentazo»: inclinar la pantalla hacia el piso = acertó; hacia el techo = pasar.
 * `base` es la lectura con el celular recto en la frente. Hay que volver cerca de `base` para que cuente otro gesto.
 */
export function tiltStep(value: number, base: number, armed: boolean): { action: TiltAction; armed: boolean } {
  const d = value - base;
  if (!armed) return { action: null, armed: Math.abs(d) < TILT_REARM };
  if (d <= -TILT_TRIGGER) return { action: 'correct', armed: false };
  if (d >= TILT_TRIGGER) return { action: 'pass', armed: false };
  return { action: null, armed: true };
}

/** Ángulo (grados, en sentido horario desde «arriba») desde el centro del girador hacia un dedo. */
export function angleToPoint(cx: number, cy: number, x: number, y: number): number {
  const deg = (Math.atan2(x - cx, -(y - cy)) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

/** Ángulo final del girador: da `turns` vueltas completas desde `current` y termina apuntando exactamente a `target` (0–360). */
export function spinTarget(current: number, target: number, turns: number): number {
  const base = Math.floor(current / 360) * 360;
  let next = base + turns * 360 + target;
  while (next <= current + turns * 360 - 180) next += 360;
  return next;
}

/**
 * Círculo de «Mano de Cirujano»: se mueve acelerando y frenando (el tiempo se «deforma»), y crece y se encoge.
 * Con los segundos va un poco más rápido y más pequeño, siempre a un ritmo que un dedo puede seguir. Queda dentro del área.
 */
export function steadyTarget(t: number, w: number, h: number, baseRadius: number): { x: number; y: number; r: number } {
  const ramp = Math.min(t, 60) / 60;
  const tau = t * (1 + 0.25 * ramp) + 0.8 * Math.sin(0.7 * t);
  const wave = 1 + 0.25 * Math.sin(t * 0.9 + 0.6);
  const shrink = 1 - (0.15 * Math.min(t, 90)) / 90;
  const r = Math.max(30, baseRadius * wave * shrink);
  const rMax = Math.max(30, baseRadius * 1.25);
  const ax = Math.max(0, w / 2 - rMax - 4);
  const ay = Math.max(0, h / 2 - rMax - 4);
  const x = w / 2 + ax * (0.85 * Math.sin(tau * 0.8) + 0.15 * Math.sin(tau * 2.1 + 1));
  const y = h / 2 + ay * (0.85 * Math.cos(tau * 0.55) + 0.15 * Math.cos(tau * 1.7 + 2));
  return { x, y, r };
}
