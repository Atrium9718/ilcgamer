import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LegalNotice } from '../components/LegalNotice.tsx';
import { angleToPoint, screenFacing, spinTarget, steadyTarget, tiltStep } from './motion.ts';
import { PartyButton, PartyCompactContext, PartyDialog, PartyFrame, useCompact } from './PartyFrame.tsx';
import { sound, vibrate } from './sound.ts';
import type {
  CategoriesConfigView,
  HeadbandConfigView,
  NeverNeverConfigView,
  PartyConfigView,
  SpinnerConfigView,
  SteadyHandConfigView,
  TruthDareConfigView,
} from './types.ts';

const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)] as T;
const prefersReducedMotion = (): boolean => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const Legal = () => <LegalNotice className="mt-4 w-full max-w-[420px] !text-[#9a9a9a]" />;

// ───────────────────────── Girador de retos (antes «Pico de Botella») ─────────────────────────

/** Tamaño de letra para que el texto quepa en el ancho de la etiqueta. */
const fitSize = (text: string, max: number, width: number) => Math.min(max, width / Math.max(1, text.length * 0.62));

/** Girador: una flecha o una aguja (nunca una botella) con los colores y el nombre que defina la configuración. */
export function SpinnerArt({ spinner }: { spinner: SpinnerConfigView['spinner'] }) {
  const { shape, body, tip, labelColor, labelTop, labelBottom, image } = spinner;
  if (image) return <image href={image} x={0} y={0} width={100} height={300} preserveAspectRatio="xMidYMid meet" />;
  return (
    <>
      {shape === 'flecha' ? (
        <>
          <polygon points="50,6 92,96 64,96 64,286 36,286 36,96 8,96" fill={body} stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
          <polygon points="50,6 78,66 22,66" fill={tip} />
          <rect x="28" y="150" width="44" height="70" fill="#F4E9CD" />
          {labelTop && (
            <text x="50" y="176" fontFamily="serif" fontSize={fitSize(labelTop, 12, 42)} fontWeight="bold" textAnchor="middle" fill={labelColor}>
              {labelTop}
            </text>
          )}
          {labelBottom && (
            <text x="50" y="192" fontFamily="sans-serif" fontSize={fitSize(labelBottom, 6.5, 42)} textAnchor="middle" fill="#000">
              {labelBottom}
            </text>
          )}
          <path d="M40,100 L40,280" stroke="rgba(255,255,255,0.45)" strokeWidth="3" fill="none" />
        </>
      ) : (
        <>
          <polygon points="50,6 62,150 50,294 38,150" fill={body} stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
          <polygon points="50,6 62,150 38,150" fill={tip} />
          <circle cx="50" cy="150" r="16" fill="#F4E9CD" stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
          {labelTop && (
            <text x="50" y="154" fontFamily="serif" fontSize={fitSize(labelTop, 9, 26)} fontWeight="bold" textAnchor="middle" fill={labelColor}>
              {labelTop}
            </text>
          )}
          {labelBottom && (
            <text x="50" y="248" fontFamily="sans-serif" fontSize={fitSize(labelBottom, 7, 60)} fontWeight="bold" textAnchor="middle" fill={body}>
              {labelBottom}
            </text>
          )}
        </>
      )}
    </>
  );
}

/** Segundos que hay que mantener los dedos quietos para que el girador los detecte. */
const HOLD_MS = 1500;
type Finger = { x: number; y: number; color: string };

/**
 * Girador: cada persona pone un dedo; tras ~1,5 s con los dedos quietos se detectan sus posiciones y la flecha gira
 * hasta señalar a una de ellas. También se puede girar con el botón (al azar).
 */
export function SpinnerGame({ config, onExit }: { config: SpinnerConfigView; onExit: () => void }) {
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [fingers, setFingers] = useState<Record<number, Finger>>({});
  const [chosen, setChosen] = useState<number | null>(null);
  const [holding, setHolding] = useState(false);
  const compact = useCompact();
  const areaRef = useRef<HTMLDivElement>(null);
  const live = useRef({ fingers: {} as Record<number, Finger>, spinning: false, angle: 0 });
  const timers = useRef<{ hold?: ReturnType<typeof setTimeout>; end?: ReturnType<typeof setTimeout> }>({});
  const reduced = prefersReducedMotion();
  const duration = reduced ? 1200 : 3500;
  const COLORS = [config.look.accent, config.look.accent2, '#00A878', '#4361EE', '#F77F00', '#9D4EDD', '#00F0FF'];
  useEffect(
    () => () => {
      clearTimeout(timers.current.hold);
      clearTimeout(timers.current.end);
    },
    [],
  );

  const spin = (toFinger?: number) => {
    const l = live.current;
    if (l.spinning) return;
    l.spinning = true;
    clearTimeout(timers.current.hold);
    setHolding(false);
    setSpinning(true);
    setChosen(null);
    sound.spin();
    vibrate([80, 50, 80]);
    let next: number;
    const f = toFinger === undefined ? undefined : l.fingers[toFinger];
    const rect = areaRef.current?.getBoundingClientRect();
    if (f && rect)
      next = spinTarget(l.angle, angleToPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, f.x, f.y), 5 + Math.floor(Math.random() * 3));
    else next = l.angle + (5 + Math.floor(Math.random() * 5)) * 360 + Math.floor(Math.random() * 360);
    l.angle = next;
    setAngle(next);
    timers.current.end = setTimeout(() => {
      l.spinning = false;
      setSpinning(false);
      if (toFinger !== undefined) setChosen(toFinger);
      sound.success();
      vibrate(200);
      setPrompt(pick(config.prompts));
    }, duration + 100);
  };

  // Tras HOLD_MS con 2 o más dedos y sin que cambie su número, se toma la posición de los dedos y gira hacia uno de ellos.
  const armHold = () => {
    const l = live.current;
    clearTimeout(timers.current.hold);
    const ids = Object.keys(l.fingers).map(Number);
    setHolding(ids.length >= 2 && !l.spinning);
    if (ids.length < 2 || l.spinning) return;
    timers.current.hold = setTimeout(() => {
      const now = Object.keys(live.current.fingers).map(Number);
      if (now.length >= 2) spin(pick(now));
    }, HOLD_MS);
  };
  const update = (fn: (f: Record<number, Finger>) => Record<number, Finger>, rearm: boolean) => {
    const l = live.current;
    l.fingers = fn(l.fingers);
    setFingers(l.fingers);
    if (rearm) armHold();
  };
  const onDown = (e: PointerEvent) => {
    if (live.current.spinning || e.pointerType === 'mouse') return;
    update((f) => ({ ...f, [e.pointerId]: { x: e.clientX, y: e.clientY, color: COLORS[Object.keys(f).length % COLORS.length] as string } }), true);
    if (Object.keys(live.current.fingers).length >= 2) vibrate(40);
  };
  const onMove = (e: PointerEvent) => {
    const cur = live.current.fingers[e.pointerId];
    if (!cur || live.current.spinning) return;
    live.current.fingers = { ...live.current.fingers, [e.pointerId]: { ...cur, x: e.clientX, y: e.clientY } };
    setFingers(live.current.fingers);
  };
  const onUp = (e: PointerEvent) => {
    if (live.current.spinning) return;
    if (!(e.pointerId in live.current.fingers)) return;
    update((f) => {
      const { [e.pointerId]: _gone, ...rest } = f;
      return rest;
    }, true);
  };

  const closePrompt = () => {
    setPrompt(null);
    setChosen(null);
    update(() => ({}), false);
  };

  return (
    <PartyFrame look={config.look} heading={config.heading} badge={config.badge} onExit={onExit} center>
      <div
        ref={areaRef}
        className={`relative flex w-full items-center justify-center ${compact ? 'h-[300px]' : 'h-[52vh]'}`}
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => onDown(e.nativeEvent)}
        onPointerMove={(e) => onMove(e.nativeEvent)}
        onPointerUp={(e) => onUp(e.nativeEvent)}
        onPointerCancel={(e) => onUp(e.nativeEvent)}
      >
        <svg
          viewBox="0 0 100 300"
          aria-hidden="true"
          width={90}
          height={270}
          style={{
            transform: `rotate(${angle}deg)`,
            transition: `transform ${duration}ms cubic-bezier(0.15, 0.9, 0.2, 1)`,
            filter: 'drop-shadow(0 15px 25px color-mix(in srgb, var(--p-accent) 40%, transparent))',
          }}
        >
          <SpinnerArt spinner={config.spinner} />
        </svg>
        {Object.entries(fingers).map(([id, t]) => {
          const win = chosen === Number(id);
          return (
            <div
              key={id}
              aria-hidden="true"
              className={`pointer-events-none fixed rounded-full border-[4px] ${holding && !spinning ? 'motion-safe:animate-pulse' : ''}`}
              style={{
                left: t.x,
                top: t.y,
                width: win ? 96 : 70,
                height: win ? 96 : 70,
                transform: 'translate(-50%, -50%)',
                borderColor: win ? '#fff' : t.color,
                background: win ? t.color : 'transparent',
                boxShadow: `0 0 ${win ? 40 : 20}px ${t.color}`,
                opacity: chosen !== null && !win ? 0.35 : 1,
              }}
            />
          );
        })}
      </div>
      <div className="z-10 flex w-full max-w-[400px] flex-col gap-3">
        <p role="status" className="text-center text-[0.95rem] font-bold" style={{ color: 'var(--p-accent2)' }}>
          {spinning
            ? 'Girando…'
            : holding
              ? 'Quietos… detectando dedos'
              : Object.keys(fingers).length === 1
                ? 'Falta al menos otro dedo'
                : 'Pongan 2 o más dedos y esperen 1–2 segundos'}
        </p>
        <PartyButton onClick={() => spin()} disabled={spinning}>
          {config.spinLabel}
        </PartyButton>
        {config.hint && <p className="text-center text-[0.8rem] opacity-70">{config.hint}</p>}
        <Legal />
      </div>
      {prompt && <PartyDialog tag={config.modalTag} text={prompt} actionLabel={config.continueLabel} onClose={closePrompt} />}
    </PartyFrame>
  );
}

// ───────────────────────── Verdad o reto ─────────────────────────

export function TruthDareGame({ config, onExit }: { config: TruthDareConfigView; onExit: () => void }) {
  const [tag, setTag] = useState<{ label: string; kind: 'truth' | 'dare' }>({ label: config.chooseTag, kind: 'dare' });
  const [text, setText] = useState(config.intro);
  const show = (kind: 'truth' | 'dare') => {
    sound.success();
    setTag({ label: kind === 'truth' ? config.truthLabel : config.dareLabel, kind });
    setText(pick(kind === 'truth' ? config.truths : config.dares));
  };
  const skip = () => {
    sound.buzzer();
    setTag({ label: config.skipTitle, kind: 'dare' });
    setText(config.skipText);
  };
  return (
    <PartyFrame look={config.look} heading={config.heading} badge={config.badge} onExit={onExit} center>
      <section
        aria-live="polite"
        className="flex min-h-[320px] w-full max-w-[420px] flex-col items-center justify-center rounded-3xl px-6 py-8 text-center"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '2px solid color-mix(in srgb, var(--p-accent) 40%, transparent)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
        }}
      >
        <p
          className="mb-5 rounded-full px-4 py-[6px] text-[0.85rem] font-extrabold uppercase tracking-[2px] text-white"
          style={{ background: tag.kind === 'truth' ? '#00A878' : 'var(--p-accent)' }}
        >
          {tag.label}
        </p>
        <p className="text-[1.4rem] font-bold leading-[1.45] text-[#f3f4f6]">{text}</p>
      </section>
      <div className="z-10 w-full max-w-[420px] space-y-2 pt-4">
        <div className="flex gap-[14px]">
          <PartyButton tone="green" className="flex-1" onClick={() => show('truth')}>
            {config.truthLabel}
          </PartyButton>
          <PartyButton className="flex-1" onClick={() => show('dare')}>
            {config.dareLabel}
          </PartyButton>
        </div>
        <PartyButton tone="gold" className="w-full !min-h-12 !py-3 !text-[1rem]" onClick={skip}>
          {config.skipButton}
        </PartyButton>
        <Legal />
      </div>
    </PartyFrame>
  );
}

// ───────────────────────── Categorías con cronómetro ─────────────────────────

export function CategoriesGame({ config, onExit }: { config: CategoriesConfigView; onExit: () => void }) {
  const [topic, setTopic] = useState(() => pick(config.topics));
  const [left, setLeft] = useState(config.seconds);
  const [lost, setLost] = useState(false);
  const [round, setRound] = useState(0);

  const restart = useCallback(() => {
    setLeft(config.seconds);
    setRound((r) => r + 1);
  }, [config.seconds]);

  // Cuenta regresiva de un segundo; al llegar a 0 pierde. Detenida mientras se muestra el aviso.
  // `round` reinicia la cuenta (nuevo tema o respuesta correcta) aunque `lost` no cambie.
  // biome-ignore lint/correctness/useExhaustiveDependencies: round es el disparador del reinicio
  useEffect(() => {
    if (lost) return;
    const t = setInterval(() => {
      setLeft((s) => {
        const next = s - 1;
        sound.tick();
        if (next <= 0) {
          clearInterval(t);
          sound.buzzer();
          setLost(true);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [lost, round]);

  const warn = left <= 2;
  return (
    <PartyFrame look={config.look} heading={config.heading} subtitle={config.subtitle} onExit={onExit} center>
      <section
        className="w-full max-w-[420px] rounded-3xl px-5 py-8 text-center"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '2px solid var(--p-accent)',
          boxShadow: '0 10px 40px color-mix(in srgb, var(--p-accent) 30%, transparent)',
        }}
      >
        <p className="text-[0.9rem] font-bold uppercase tracking-[2px]" style={{ color: 'var(--p-accent2)' }}>
          {config.topicLabel}
        </p>
        <p className="mt-4 mb-2 text-[1.6rem] font-black leading-tight">{topic.topic}</p>
        <p className="mb-6 italic text-[#c4c4c4]">
          {config.exampleLabel} {topic.example}
        </p>
        <div
          role="timer"
          aria-label={`Quedan ${left} segundos`}
          className={`mx-auto flex h-[110px] w-[110px] items-center justify-center rounded-full border-[6px] text-[2.8rem] font-black ${warn ? 'motion-safe:animate-pulse' : ''}`}
          style={{ borderColor: warn ? 'var(--p-accent)' : 'var(--p-accent2)', color: warn ? 'var(--p-accent)' : '#fff' }}
        >
          <span aria-hidden="true">{left}</span>
        </div>
      </section>
      <div className="z-10 w-full max-w-[420px] space-y-[10px] pt-4">
        <PartyButton
          tone="green"
          className="w-full"
          onClick={() => {
            sound.success();
            restart();
          }}
        >
          {config.goodLabel}
        </PartyButton>
        <PartyButton
          className="w-full"
          onClick={() => {
            sound.buzzer();
            setLost(true);
          }}
        >
          {config.lostLabel}
        </PartyButton>
        <PartyButton
          tone="gray"
          className="w-full"
          onClick={() => {
            setTopic(pick(config.topics));
            restart();
          }}
        >
          {config.changeLabel}
        </PartyButton>
        <Legal />
      </div>
      {lost && (
        <PartyDialog
          text={config.lostMessage}
          actionLabel="Continuar"
          onClose={() => {
            setLost(false);
            restart();
          }}
        />
      )}
    </PartyFrame>
  );
}

// ───────────────────────── Yo nunca nunca ─────────────────────────

export function NeverNeverGame({ config, onExit }: { config: NeverNeverConfigView; onExit: () => void }) {
  const [index, setIndex] = useState(0);
  return (
    <PartyFrame look={config.look} heading={config.heading} subtitle={config.subtitle} onExit={onExit} center>
      <section
        aria-live="polite"
        className="flex min-h-[280px] w-full max-w-[420px] flex-col items-center justify-center rounded-3xl px-6 py-8 text-center"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '2px solid color-mix(in srgb, var(--p-accent) 50%, transparent)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
        }}
      >
        <span className="mb-5 rounded-full px-[14px] py-1 text-[0.8rem] font-bold" style={{ background: 'var(--p-accent)' }}>
          {config.tag}
        </span>
        <p className="text-[1.5rem] font-bold leading-[1.4]">{config.phrases[index]}</p>
        <p className="mt-4 text-[0.85rem] font-bold" style={{ color: 'var(--p-accent2)' }}>
          {config.rule}
        </p>
      </section>
      <div className="z-10 w-full max-w-[420px] space-y-2 pt-4">
        <PartyButton
          className="w-full"
          onClick={() => {
            sound.success();
            setIndex((i) => (i + 1) % config.phrases.length);
          }}
        >
          {config.nextLabel} <span aria-hidden="true">➡️</span>
        </PartyButton>
        <Legal />
      </div>
    </PartyFrame>
  );
}

// ───────────────────────── Adivina en la frente ─────────────────────────

type DeviceOrientationCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

/**
 * El Frentazo: el celular va en la frente con la pantalla hacia los demás. Inclinar hacia el piso = acertó;
 * hacia el techo = pasar (con el sensor de movimiento). Los botones siguen disponibles como alternativa accesible.
 */
export function HeadbandGame({ config, onExit }: { config: HeadbandConfigView; onExit: () => void }) {
  const [phase, setPhase] = useState<'setup' | 'ready' | 'play' | 'over'>('setup');
  const [words, setWords] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(config.seconds);
  const [count, setCount] = useState(3);
  const [sensor, setSensor] = useState<'off' | 'on' | 'denied'>('off');
  const [flash, setFlash] = useState<'correct' | 'pass' | null>(null);
  const live = useRef({ facing: null as number | null, base: 0, armed: true, playing: false });
  const flashTimer = useRef(0);

  const answer = useCallback((kind: 'correct' | 'pass') => {
    if (kind === 'correct') {
      sound.success();
      vibrate(120);
      setScore((s) => s + 1);
    } else {
      sound.buzzer();
      vibrate([60, 40, 60]);
    }
    setIdx((i) => i + 1);
    setFlash(kind);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 650);
  }, []);

  const start = async () => {
    // iOS exige pedir permiso al sensor de movimiento dentro de un toque.
    const Ctor = typeof DeviceOrientationEvent === 'undefined' ? undefined : (DeviceOrientationEvent as DeviceOrientationCtor);
    if (Ctor?.requestPermission) {
      try {
        setSensor((await Ctor.requestPermission()) === 'granted' ? 'on' : 'denied');
      } catch {
        setSensor('denied');
      }
    } else setSensor(Ctor ? 'on' : 'off');
    setWords([...config.words].sort(() => Math.random() - 0.5));
    setIdx(0);
    setScore(0);
    setLeft(config.seconds);
    setCount(3);
    setPhase('ready');
  };

  // Sensor de orientación: se mantiene la última lectura; al empezar la ronda se calibra con el celular recto en la frente.
  useEffect(() => {
    if (sensor !== 'on') return;
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      const l = live.current;
      l.facing = screenFacing(e.beta, e.gamma);
      if (!l.playing) return;
      const step = tiltStep(l.facing, l.base, l.armed);
      l.armed = step.armed;
      if (step.action) answer(step.action);
    };
    window.addEventListener('deviceorientation', onOrientation);
    return () => window.removeEventListener('deviceorientation', onOrientation);
  }, [sensor, answer]);

  // Cuenta regresiva para ponerse el celular en la frente.
  useEffect(() => {
    if (phase !== 'ready') return;
    const t = setInterval(() => {
      setCount((c) => {
        sound.tick();
        if (c <= 1) {
          clearInterval(t);
          live.current.base = live.current.facing ?? 0;
          live.current.armed = true;
          live.current.playing = true;
          sound.success();
          setPhase('play');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'play') return;
    const t = setInterval(() => {
      setLeft((s) => {
        sound.tick();
        if (s - 1 <= 0) {
          clearInterval(t);
          sound.buzzer();
          live.current.playing = false;
          setPhase('over');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      clearInterval(t);
      live.current.playing = false;
    };
  }, [phase]);

  // Mantener la pantalla encendida durante la ronda (si el navegador lo permite).
  useEffect(() => {
    if (phase !== 'play' && phase !== 'ready') return;
    let lock: { release: () => Promise<void> } | undefined;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then(
      (l) => {
        lock = l;
      },
      () => undefined,
    );
    return () => void lock?.release().catch(() => undefined);
  }, [phase]);

  const message = config.endMessage.replace('{n}', String(score));
  const flashBg = flash === 'correct' ? '#0a7a4f' : flash === 'pass' ? '#7a1a1a' : '#111';
  return (
    <PartyFrame look={config.look} heading={config.heading} onExit={onExit} center>
      {phase === 'setup' || phase === 'over' ? (
        <div className="z-10 flex w-full max-w-[420px] flex-col items-center gap-5 text-center">
          <p className="text-[#aaa]">{config.intro}</p>
          <p className="text-[0.9rem] text-[#cfcfcf]">
            Con el celular en la frente: <strong>inclínalo hacia el piso si aciertan</strong> y <strong>hacia el techo para pasar</strong>.
          </p>
          <PartyButton className="w-full max-w-[320px]" onClick={() => void start()}>
            {config.startLabel}
          </PartyButton>
          <Legal />
        </div>
      ) : phase === 'ready' ? (
        <div role="status" className="z-10 flex w-full max-w-[420px] flex-col items-center gap-3 text-center">
          <p className="text-[1.2rem] font-bold">Ponte el celular en la frente, con la pantalla hacia los demás</p>
          <p className="text-[6rem] font-black leading-none" style={{ color: 'var(--p-accent2)' }}>
            {count}
          </p>
          {sensor !== 'on' && <p className="text-[0.85rem] text-[#cfcfcf]">Sin sensor de movimiento: otra persona usa los botones.</p>}
        </div>
      ) : (
        <div className="z-10 flex w-full max-w-[500px] flex-col items-center">
          <section
            aria-live="polite"
            className="flex min-h-[260px] w-full flex-col items-center justify-center rounded-3xl border-[3px] p-5 text-center motion-safe:transition-colors"
            style={{ borderColor: 'var(--p-accent2)', background: flashBg }}
          >
            <p className="text-[2.8rem] font-black uppercase leading-tight" style={{ color: flash ? '#fff' : 'var(--p-accent2)' }}>
              {flash === 'correct' ? '¡ACERTÓ!' : flash === 'pass' ? 'PASÓ' : (words[idx] ?? 'FIN')}
            </p>
            <p
              role="timer"
              aria-label={`Quedan ${left} segundos`}
              className="mt-5 text-[1.8rem] font-black"
              style={{ color: flash ? '#fff' : 'var(--p-accent)' }}
            >
              <span aria-hidden="true">{left}s</span>
            </p>
          </section>
          <div className="mt-5 flex w-full gap-3">
            <PartyButton tone="gray" className="flex-1 !py-5" onClick={() => answer('pass')}>
              {config.passLabel} <span aria-hidden="true">❌</span>
            </PartyButton>
            <PartyButton tone="green" className="flex-1 !py-5" onClick={() => answer('correct')}>
              {config.correctLabel} <span aria-hidden="true">✅</span>
            </PartyButton>
          </div>
          <p className="mt-3 text-center text-[0.8rem] text-[#9a9a9a]">
            {sensor === 'on' ? 'Sensor activo: abajo = acertó · arriba = pasar' : 'Usa los botones para marcar acierto o pase'}
          </p>
        </div>
      )}
      {phase === 'over' && <PartyDialog text={message} actionLabel="Continuar" onClose={() => setPhase('setup')} />}
    </PartyFrame>
  );
}

// ───────────────────────── Pulso firme ─────────────────────────

/**
 * Mano de Cirujano: hay que mantener el dedo dentro del círculo, que acelera, frena, crece y se encoge.
 * Se pierde al salirse del círculo o al levantar el dedo.
 */
export function SteadyHandGame({ config, onExit }: { config: SteadyHandConfigView; onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const [lostAt, setLostAt] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const radius = config.safeRadius;
  const compact = useCompact();
  const hudText = useMemo(() => 'Toca el círculo para empezar', []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: round reinicia el juego tras perder
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const s = { playing: false, start: 0, px: 0, py: 0, w: 0, h: 0, raf: 0, pointerId: -1, outSince: 0 };
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      s.w = canvas.parentElement?.clientWidth ?? 300;
      s.h = canvas.parentElement?.clientHeight ?? 400;
      canvas.width = s.w * dpr;
      canvas.height = s.h * dpr;
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    if (hudRef.current) hudRef.current.textContent = hudText;
    const draw = (t: number, showPlayer: boolean) => {
      if (!ctx) return { x: 0, y: 0, r: radius };
      const c = steadyTarget(t, s.w, s.h, radius);
      // Se pone naranja cuando el dedo se acerca al borde (aviso antes de perder).
      const edge = showPlayer && Math.hypot(s.px - c.x, s.py - c.y) > c.r * 0.75;
      const tone = edge ? '#F77F00' : '#00A878';
      ctx.clearRect(0, 0, s.w, s.h);
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fillStyle = edge ? 'rgba(247, 127, 0, 0.25)' : 'rgba(0, 168, 120, 0.22)';
      ctx.fill();
      ctx.strokeStyle = tone;
      ctx.lineWidth = 4;
      ctx.stroke();
      if (showPlayer) {
        ctx.beginPath();
        ctx.arc(s.px, s.py, 12, 0, Math.PI * 2);
        ctx.fillStyle = config.look.accent2;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      return c;
    };
    const lose = (elapsed: string) => {
      if (!s.playing) return;
      s.playing = false;
      cancelAnimationFrame(s.raf);
      sound.buzzer();
      vibrate(300);
      if (hudRef.current) hudRef.current.textContent = config.restartHint;
      setLostAt(elapsed);
    };
    const loop = (now: number) => {
      if (!s.playing) return;
      const t = (now - s.start) / 1000;
      const c = draw(t, true);
      if (hudRef.current) hudRef.current.textContent = `Tiempo: ${t.toFixed(1)}s`;
      // Margen de tolerancia: el dedo puede rozar el borde un instante (~0,2 s) sin perder.
      if (Math.hypot(s.px - c.x, s.py - c.y) > c.r + 10) {
        if (!s.outSince) s.outSince = now;
        if (now - s.outSince > 200) return lose(t.toFixed(1));
      } else s.outSince = 0;
      s.raf = requestAnimationFrame(loop);
    };
    const place = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      s.px = e.clientX - rect.left;
      s.py = e.clientY - rect.top;
    };
    const down = (e: PointerEvent) => {
      if (s.playing) return;
      place(e);
      const c = steadyTarget(0, s.w, s.h, radius);
      // Solo arranca si el dedo empieza dentro del círculo.
      if (Math.hypot(s.px - c.x, s.py - c.y) > c.r + 10) return;
      s.outSince = 0;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* sin captura: se sigue con los eventos normales */
      }
      s.pointerId = e.pointerId;
      s.playing = true;
      s.start = performance.now();
      sound.success();
      s.raf = requestAnimationFrame(loop);
    };
    const move = (e: PointerEvent) => {
      if (s.playing && e.pointerId === s.pointerId) place(e);
    };
    const up = (e: PointerEvent) => {
      if (s.playing && e.pointerId === s.pointerId) lose(((performance.now() - s.start) / 1000).toFixed(1));
    };
    draw(0, false);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    return () => {
      s.playing = false;
      cancelAnimationFrame(s.raf);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
    };
  }, [radius, config.look.accent2, config.restartHint, hudText, round]);

  return (
    <PartyFrame look={config.look} heading={config.heading} subtitle={config.instructions} onExit={onExit}>
      <div ref={hudRef} role="status" className="z-10 p-[10px] text-[1.2rem] font-bold" style={{ color: 'var(--p-accent2)' }}>
        {hudText}
      </div>
      <div
        className={`relative z-10 w-full max-w-[400px] overflow-hidden rounded-[20px] bg-[#0c0c0e] ${compact ? 'h-[300px]' : 'h-[52vh]'}`}
        style={{ border: '2px solid color-mix(in srgb, var(--p-accent2) 30%, transparent)', touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          aria-label="Área de juego: pon el dedo dentro del círculo verde, mantenlo presionado y síguelo sin salirte"
          className="block h-full w-full"
          style={{ touchAction: 'none' }}
        />
      </div>
      <footer className="z-10 pt-3 text-center text-[0.75rem] text-[#9a9a9a]">
        {config.footer}
        <Legal />
      </footer>
      {lostAt !== null && (
        <PartyDialog
          text={config.lostMessage.replace('{t}', lostAt)}
          actionLabel="Continuar"
          onClose={() => {
            setLostAt(null);
            setRound((r) => r + 1);
          }}
        />
      )}
    </PartyFrame>
  );
}

// ───────────────────────── Selector ─────────────────────────

/** Muestra el juego de fiesta que corresponde a la configuración. */
export function PartyGameView({ config, onExit, compact = false }: { config: PartyConfigView; onExit: () => void; compact?: boolean }) {
  return (
    <PartyCompactContext.Provider value={compact}>
      <PartyGameBody config={config} onExit={onExit} />
    </PartyCompactContext.Provider>
  );
}

function PartyGameBody({ config, onExit }: { config: PartyConfigView; onExit: () => void }) {
  switch (config.game) {
    case 'spinner':
      return <SpinnerGame config={config} onExit={onExit} />;
    case 'truth-dare':
      return <TruthDareGame config={config} onExit={onExit} />;
    case 'categories':
      return <CategoriesGame config={config} onExit={onExit} />;
    case 'never-never':
      return <NeverNeverGame config={config} onExit={onExit} />;
    case 'headband':
      return <HeadbandGame config={config} onExit={onExit} />;
    case 'steady-hand':
      return <SteadyHandGame config={config} onExit={onExit} />;
  }
}
