/**
 * Sonidos de los juegos de fiesta con Web Audio (sin archivos ni recursos de terceros). El contexto de audio se crea al primer
 * toque de la persona, como exigen los navegadores móviles; si no hay audio, todo falla en silencio.
 */
let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, type: OscillatorType, duration: number, delay = 0): void {
  setTimeout(() => {
    try {
      const c = context();
      if (!c) return;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, c.currentTime);
      gain.gain.setValueAtTime(0.2, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + duration);
    } catch {
      /* sin audio */
    }
  }, delay);
}

export const sound = {
  spin: () => {
    for (let i = 0; i < 15; i++) tone(150 + i * 20, 'sine', 0.08, i * (40 + i * 15));
  },
  success: () => {
    tone(523.25, 'triangle', 0.15, 0);
    tone(659.25, 'triangle', 0.15, 120);
    tone(783.99, 'triangle', 0.25, 240);
  },
  buzzer: () => {
    tone(130, 'sawtooth', 0.4, 0);
    tone(110, 'sawtooth', 0.4, 150);
  },
  tick: () => tone(800, 'square', 0.04, 0),
};

export const vibrate = (pattern: number | number[]): void => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* sin vibración */
  }
};
