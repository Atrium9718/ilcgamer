import { describe, expect, it, vi } from 'vitest';
import { assertEmbeddable, createGameClient, createHost, iframeAllow, parseHostMessage, parseModuleMessage } from '../src/index.ts';

const ORIGIN = 'https://juegos.proveedor.co';
const MISSION = '0192f0c1-2b6e-7c41-9a3f-1c2d3e4f3f9a';

describe('protocolo (solo lo que está en el contrato)', () => {
  it('acepta los cuatro mensajes del módulo y normaliza el progreso', () => {
    expect(parseModuleMessage({ ilc: 1, type: 'ready' })).toEqual({ ilc: 1, type: 'ready' });
    expect(parseModuleMessage({ ilc: 1, type: 'finish' })).toEqual({ ilc: 1, type: 'finish' });
    expect(parseModuleMessage({ ilc: 1, type: 'progress', percent: 140.4 })).toEqual({ ilc: 1, type: 'progress', percent: 100 });
    expect(parseModuleMessage({ ilc: 1, type: 'error', code: 'no_carga', message: 'Falló' })).toEqual({
      ilc: 1,
      type: 'error',
      code: 'no_carga',
      message: 'Falló',
    });
  });

  it('rechaza versiones, tipos, campos de más y un "finish" que intente traer puntaje', () => {
    expect(parseModuleMessage({ ilc: 2, type: 'ready' })).toBeNull();
    expect(parseModuleMessage({ ilc: 1, type: 'win' })).toBeNull();
    expect(parseModuleMessage({ ilc: 1, type: 'finish', score: 9999 })).toBeNull();
    expect(parseModuleMessage({ ilc: 1, type: 'progress', percent: 'mucho' })).toBeNull();
    expect(parseModuleMessage({ ilc: 1, type: 'progress', percent: Number.NaN })).toBeNull();
    expect(parseModuleMessage({ ilc: 1, type: 'error', code: 'CÓDIGO MALO' })).toBeNull();
    expect(parseModuleMessage({ ilc: 1, type: 'error', code: 'x', message: 'a'.repeat(201) })).toBeNull();
    expect(parseModuleMessage('texto')).toBeNull();
    expect(parseModuleMessage(null)).toBeNull();
    expect(parseModuleMessage([{ ilc: 1, type: 'ready' }])).toBeNull();
  });

  it('valida el init que recibe el módulo', () => {
    expect(parseHostMessage({ ilc: 1, type: 'init', missionId: MISSION, locale: 'es-CO', reducedMotion: false })).toMatchObject({ missionId: MISSION });
    expect(parseHostMessage({ ilc: 1, type: 'init', missionId: 'x', locale: 'es-CO', reducedMotion: false })).toBeNull();
    expect(parseHostMessage({ ilc: 1, type: 'init', missionId: MISSION, locale: 'es-CO', reducedMotion: false, extra: 1 })).toBeNull();
  });
});

describe('anfitrión (PWA)', () => {
  function setup(over: { now?: () => number; max?: number } = {}) {
    const frame = { postMessage: vi.fn() } as unknown as Window;
    const target = new EventTarget() as unknown as Window;
    const calls = { ready: vi.fn(), progress: vi.fn(), finish: vi.fn(), error: vi.fn() };
    const host = createHost({
      frame,
      allowedOrigin: ORIGIN,
      missionId: MISSION,
      locale: 'es-CO',
      reducedMotion: true,
      onReady: calls.ready,
      onProgress: calls.progress,
      onFinish: calls.finish,
      onError: calls.error,
      target,
      now: over.now,
      maxMessagesPerSecond: over.max,
    });
    const emit = (data: unknown, origin = ORIGIN, source: unknown = frame) => {
      const e = new Event('message') as Event & { data: unknown; origin: string; source: unknown };
      Object.assign(e, { data, origin, source });
      (target as unknown as EventTarget).dispatchEvent(e);
    };
    return { frame, calls, host, emit };
  }

  it('responde al ready con init solo al origen permitido y avisa el progreso', () => {
    const { frame, calls, emit } = setup();
    emit({ ilc: 1, type: 'ready' });
    expect(frame.postMessage).toHaveBeenCalledWith({ ilc: 1, type: 'init', missionId: MISSION, locale: 'es-CO', reducedMotion: true }, ORIGIN);
    expect(calls.ready).toHaveBeenCalledOnce();
    emit({ ilc: 1, type: 'progress', percent: 40 });
    expect(calls.progress).toHaveBeenCalledWith(40);
  });

  it('ignora mensajes de otro origen, de otra ventana o mal formados', () => {
    const { calls, emit } = setup();
    emit({ ilc: 1, type: 'finish' }, 'https://atacante.co');
    emit({ ilc: 1, type: 'finish' }, ORIGIN, {});
    emit({ ilc: 1, type: 'finish', score: 1000 });
    emit({ tipo: 'finish' });
    expect(calls.finish).not.toHaveBeenCalled();
  });

  it('finish se acepta una sola vez y después se ignora todo', () => {
    const { calls, emit } = setup();
    emit({ ilc: 1, type: 'finish' });
    emit({ ilc: 1, type: 'finish' });
    emit({ ilc: 1, type: 'progress', percent: 10 });
    expect(calls.finish).toHaveBeenCalledOnce();
    expect(calls.progress).not.toHaveBeenCalled();
  });

  it('limita el ritmo de mensajes y retoma al pasar un segundo', () => {
    let t = 0;
    const { calls, emit } = setup({ now: () => t, max: 3 });
    for (let i = 0; i < 10; i++) emit({ ilc: 1, type: 'progress', percent: i });
    expect(calls.progress).toHaveBeenCalledTimes(3);
    t = 1500;
    emit({ ilc: 1, type: 'progress', percent: 50 });
    expect(calls.progress).toHaveBeenCalledTimes(4);
  });

  it('dispose deja de escuchar', () => {
    const { calls, emit, host } = setup();
    host.dispose();
    emit({ ilc: 1, type: 'finish' });
    expect(calls.finish).not.toHaveBeenCalled();
  });

  it('propaga los errores del módulo con su código', () => {
    const { calls, emit } = setup();
    emit({ ilc: 1, type: 'error', code: 'no_carga', message: 'Falló' });
    expect(calls.error).toHaveBeenCalledWith('no_carga', 'Falló');
  });
});

describe('incrustación segura', () => {
  it('solo HTTPS, sin credenciales, del origen permitido y distinto al de la aplicación', () => {
    const ok = assertEmbeddable(`${ORIGIN}/trivia/index.html`, ORIGIN, 'https://app.ilc.com.co');
    expect(ok.href).toBe(`${ORIGIN}/trivia/index.html`);
    expect(() => assertEmbeddable('http://juegos.proveedor.co/x', ORIGIN, 'https://app.ilc.com.co')).toThrow(/HTTPS/);
    expect(() => assertEmbeddable('https://user:pass@juegos.proveedor.co/x', ORIGIN, 'https://app.ilc.com.co')).toThrow(/credenciales/);
    expect(() => assertEmbeddable('https://otro.co/x', ORIGIN, 'https://app.ilc.com.co')).toThrow(/origen permitido/);
    expect(() => assertEmbeddable(`${ORIGIN}/x`, ORIGIN, ORIGIN)).toThrow(/mismo origen/);
    expect(() => assertEmbeddable('no es una url', ORIGIN, 'https://app.ilc.com.co')).toThrow(/no es válida/);
  });

  it('el atributo allow solo incluye lo que el manifiesto pidió', () => {
    expect(iframeAllow([])).toBe('');
    expect(iframeAllow(['camera', 'geolocation'])).toBe('camera; geolocation');
  });
});

describe('cliente (módulo del proveedor)', () => {
  it('envía mensajes al origen de la aplicación, nunca a "*", y resuelve con el init', async () => {
    const post = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => undefined);
    const client = createGameClient({ hostOrigin: 'https://app.ilc.com.co' });
    const ready = client.ready();
    expect(post).toHaveBeenCalledWith({ ilc: 1, type: 'ready' }, 'https://app.ilc.com.co');
    const e = new Event('message') as Event & { data: unknown; origin: string; source: unknown };
    Object.assign(e, {
      data: { ilc: 1, type: 'init', missionId: MISSION, locale: 'es-CO', reducedMotion: false },
      origin: 'https://app.ilc.com.co',
      source: window.parent,
    });
    window.dispatchEvent(e);
    expect(await ready).toMatchObject({ missionId: MISSION });
    client.progress(30);
    client.finish();
    expect(post).toHaveBeenLastCalledWith({ ilc: 1, type: 'finish' }, 'https://app.ilc.com.co');
    expect(post.mock.calls.every((c) => (c[1] as unknown) !== '*')).toBe(true);
    post.mockRestore();
  });

  it('sin origen conocido no envía nada', () => {
    const post = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => undefined);
    const client = createGameClient();
    expect(() => client.finish()).toThrow(/hostOrigin/);
    expect(post).not.toHaveBeenCalled();
    post.mockRestore();
  });
});
