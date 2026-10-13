import { type TouchEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LegalNotice } from '../components/LegalNotice.tsx';
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
  const { shape, body, tip, labelColor, labelTop, labelBottom } = spinner;
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

export function SpinnerGame({ config, onExit }: { config: SpinnerConfigView; onExit: () => void }) {
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [touches, setTouches] = useState<Record<number, { x: number; y: number; color: string }>>({});
  const compact = useCompact();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reduced = prefersReducedMotion();
  const duration = reduced ? 1200 : 3500;
  useEffect(() => () => clearTimeout(timer.current), []);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    sound.spin();
    vibrate([80, 50, 80]);
    setAngle((a) => a + (5 + Math.floor(Math.random() * 5)) * 360 + Math.floor(Math.random() * 360));
    timer.current = setTimeout(() => {
      setSpinning(false);
      sound.success();
      vibrate(200);
      setPrompt(pick(config.prompts));
    }, duration + 100);
  };

  const COLORS = [config.look.accent, config.look.accent2, '#00A878', '#4361EE', '#F77F00', '#9D4EDD', '#00F0FF'];
  const onTouchStart = (e: TouchEvent) => {
    if (spinning) return;
    const added: Record<number, { x: number; y: number; color: string }> = {};
    for (const t of Array.from(e.changedTouches)) added[t.identifier] = { x: t.clientX, y: t.clientY, color: COLORS[t.identifier % COLORS.length] as string };
    setTouches((cur) => ({ ...cur, ...added }));
    if (Object.keys(touches).length + Object.keys(added).length >= 2) vibrate(40);
  };
  const onTouchEnd = (e: TouchEvent) =>
    setTouches((cur) => {
      const next = { ...cur };
      for (const t of Array.from(e.changedTouches)) delete next[t.identifier];
      return next;
    });

  return (
    <PartyFrame look={config.look} heading={config.heading} badge={config.badge} onExit={onExit} center>
      <div
        className={`relative flex w-full items-center justify-center ${compact ? 'h-[300px]' : 'h-[52vh]'}`}
        style={{ touchAction: 'none' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {/* Tocar el girador también lo hace girar; el botón «Girar» de abajo es la vía accesible. */}
        <button type="button" tabIndex={-1} aria-hidden="true" onClick={spin} className="border-0 bg-transparent p-0">
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
        </button>
        {Object.entries(touches).map(([id, t]) => (
          <div
            key={id}
            aria-hidden="true"
            className="pointer-events-none fixed h-[70px] w-[70px] rounded-full border-[3px]"
            style={{ left: t.x, top: t.y, transform: 'translate(-50%, -50%)', borderColor: t.color, boxShadow: `0 0 20px ${t.color}` }}
          />
        ))}
      </div>
      <div className="z-10 flex w-full max-w-[400px] flex-col gap-3">
        <PartyButton onClick={spin} disabled={spinning}>
          {config.spinLabel}
        </PartyButton>
        {config.hint && <p className="text-center text-[0.8rem] opacity-70">{config.hint}</p>}
        <Legal />
      </div>
      {prompt && <PartyDialog tag={config.modalTag} text={prompt} actionLabel={config.continueLabel} onClose={() => setPrompt(null)} />}
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

export function HeadbandGame({ config, onExit }: { config: HeadbandConfigView; onExit: () => void }) {
  const [phase, setPhase] = useState<'setup' | 'play' | 'over'>('setup');
  const [words, setWords] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(config.seconds);
  const scoreRef = useRef(0);
  scoreRef.current = score;

  const start = () => {
    setWords([...config.words].sort(() => Math.random() - 0.5));
    setIdx(0);
    setScore(0);
    setLeft(config.seconds);
    setPhase('play');
  };

  useEffect(() => {
    if (phase !== 'play') return;
    const t = setInterval(() => {
      setLeft((s) => {
        sound.tick();
        if (s - 1 <= 0) {
          clearInterval(t);
          sound.buzzer();
          setPhase('over');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  const message = config.endMessage.replace('{n}', String(score));
  return (
    <PartyFrame look={config.look} heading={config.heading} onExit={onExit} center>
      {phase !== 'play' ? (
        <div className="z-10 flex w-full max-w-[420px] flex-col items-center gap-5 text-center">
          <p className="text-[#aaa]">{config.intro}</p>
          <PartyButton className="w-full max-w-[320px]" onClick={start}>
            {config.startLabel}
          </PartyButton>
          <Legal />
        </div>
      ) : (
        <div className="z-10 flex w-full max-w-[500px] flex-col items-center">
          <section
            aria-live="polite"
            className="flex min-h-[260px] w-full flex-col items-center justify-center rounded-3xl border-[3px] bg-[#111] p-5 text-center"
            style={{ borderColor: 'var(--p-accent2)' }}
          >
            <p className="text-[2.8rem] font-black uppercase leading-tight" style={{ color: 'var(--p-accent2)' }}>
              {words[idx] ?? 'FIN'}
            </p>
            <p role="timer" aria-label={`Quedan ${left} segundos`} className="mt-5 text-[1.8rem] font-black" style={{ color: 'var(--p-accent)' }}>
              <span aria-hidden="true">{left}s</span>
            </p>
          </section>
          <div className="mt-5 flex w-full gap-3">
            <PartyButton
              tone="gray"
              className="flex-1 !py-5"
              onClick={() => {
                sound.buzzer();
                setIdx((i) => i + 1);
              }}
            >
              {config.passLabel} <span aria-hidden="true">❌</span>
            </PartyButton>
            <PartyButton
              tone="green"
              className="flex-1 !py-5"
              onClick={() => {
                sound.success();
                setScore((s) => s + 1);
                setIdx((i) => i + 1);
              }}
            >
              {config.correctLabel} <span aria-hidden="true">✅</span>
            </PartyButton>
          </div>
        </div>
      )}
      {phase === 'over' && <PartyDialog text={message} actionLabel="Continuar" onClose={() => setPhase('setup')} />}
    </PartyFrame>
  );
}

// ───────────────────────── Pulso firme ─────────────────────────

export function SteadyHandGame({ config, onExit }: { config: SteadyHandConfigView; onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const [lostAt, setLostAt] = useState<string | null>(null);
  const st = useRef({ playing: false, start: 0, px: 0, py: 0, w: 0, h: 0, raf: 0 });
  const radius = config.safeRadius;
  const compact = useCompact();
  const hudText = useMemo(() => 'Tiempo: 0.0s', []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const s = st.current;
    const resize = () => {
      s.w = canvas.width = canvas.parentElement?.clientWidth ?? 300;
      s.h = canvas.height = canvas.parentElement?.clientHeight ?? 400;
      s.px = s.w / 2;
      s.py = s.h / 2;
    };
    resize();
    window.addEventListener('resize', resize);
    const loop = (now: number) => {
      if (!s.playing || !ctx) return;
      const elapsed = ((now - s.start) / 1000).toFixed(1);
      if (hudRef.current) hudRef.current.textContent = `Tiempo: ${elapsed}s`;
      const dotX = s.w / 2 + Math.sin(now * 0.002) * (s.w * 0.35);
      const dotY = s.h / 2 + Math.cos(now * 0.0015) * (s.h * 0.35);
      ctx.clearRect(0, 0, s.w, s.h);
      ctx.beginPath();
      ctx.arc(dotX, dotY, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 168, 120, 0.2)';
      ctx.fill();
      ctx.strokeStyle = '#00A878';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(s.px, s.py, 15, 0, Math.PI * 2);
      ctx.fillStyle = config.look.accent2;
      ctx.fill();
      if (Math.hypot(s.px - dotX, s.py - dotY) > radius) {
        sound.buzzer();
        vibrate(300);
        s.playing = false;
        if (hudRef.current) hudRef.current.textContent = config.restartHint;
        setLostAt(elapsed);
        return;
      }
      s.raf = requestAnimationFrame(loop);
    };
    const point = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      s.px = e.clientX - rect.left;
      s.py = e.clientY - rect.top;
      if (!s.playing) {
        s.playing = true;
        s.start = performance.now();
        sound.success();
        s.raf = requestAnimationFrame(loop);
      }
    };
    const move = (e: PointerEvent) => {
      if (s.playing) point(e);
    };
    canvas.addEventListener('pointerdown', point);
    canvas.addEventListener('pointermove', move);
    return () => {
      s.playing = false;
      cancelAnimationFrame(s.raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', point);
      canvas.removeEventListener('pointermove', move);
    };
  }, [radius, config.look.accent2, config.restartHint]);

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
          aria-label="Área de juego: mantén presionado y sigue el círculo verde"
          className="block h-full w-full"
          style={{ touchAction: 'none' }}
        />
      </div>
      <footer className="z-10 pt-3 text-center text-[0.75rem] text-[#9a9a9a]">
        {config.footer}
        <Legal />
      </footer>
      {lostAt !== null && <PartyDialog text={config.lostMessage.replace('{t}', lostAt)} actionLabel="Continuar" onClose={() => setLostAt(null)} />}
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
