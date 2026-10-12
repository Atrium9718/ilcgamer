import { ApiErrorSchema, MeSchema } from '@ilc/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../src/generated/prisma/client.ts';
import { ConsoleOtpSender, OtpSender } from '../src/identity/otp-sender.ts';
import { RedisService } from '../src/redis/redis.service.ts';
import { browser, createTestApp, resetDatabase, testPrisma } from './helpers.ts';

let app: NestFastifyApplication;
let db: PrismaClient;
const ADULT = { birthDate: '1990-08-14', declaration: true };
const PHONE = '300 123 4567';

beforeAll(async () => {
  app = await createTestApp();
  db = testPrisma();
});
afterAll(async () => {
  await app?.close();
  await db?.$disconnect();
});
beforeEach(async () => {
  await resetDatabase(db);
  const redis = app.get(RedisService);
  await redis.isHealthy(); // conecta (conexión perezosa)
  await redis.client.flushdb();
});

const outbox = () => (app.get(OtpSender) as ConsoleOtpSender).outbox;
const error = (res: { json: () => unknown }) => ApiErrorSchema.parse(res.json()).error;

async function adultWithTerms() {
  const b = browser(app);
  await b.request('POST', '/age-gate', ADULT);
  await b.request('POST', '/consents', { purpose: 'TERMINOS_Y_PRIVACIDAD', granted: true, noticeVersion: '1.0', source: 'registro' });
  return b;
}

describe('control de edad (Instrucciones §5 paso 3; Guía Técnica §5.2, §9.4)', () => {
  it('un adulto obtiene una cuenta temporal y una cookie de sesión segura', async () => {
    const b = browser(app);
    const res = await b.request('POST', '/age-gate', ADULT);
    expect(res.statusCode).toBe(200);
    const me = MeSchema.parse(res.json());
    expect(me).toMatchObject({ status: 'TEMPORAL', ageVerified: true, alias: 'Jugador' });
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('NO guarda la fecha de nacimiento: solo el resultado y el método', async () => {
    await browser(app).request('POST', '/age-gate', ADULT);
    const user = await db.user.findFirstOrThrow();
    expect(user.ageVerifiedAt).toBeInstanceOf(Date);
    expect(user.ageGateMethod).toBe('fecha_y_declaracion');
    expect(JSON.stringify(user)).not.toContain('1990');
    const audit = await db.auditEvent.findMany();
    expect(JSON.stringify(audit)).not.toContain('1990');
  });

  it('un menor no recibe cuenta ni sesión y no queda ningún registro', async () => {
    const b = browser(app);
    const young = new Date();
    young.setFullYear(young.getFullYear() - 16);
    const res = await b.request('POST', '/age-gate', { birthDate: young.toISOString().slice(0, 10), declaration: true });
    expect(res.statusCode).toBe(403);
    expect(error(res).code).toBe('AGE_REQUIREMENT_NOT_MET');
    expect(b.jar.size).toBe(0);
    expect(await db.user.count()).toBe(0);
    expect(await db.auditEvent.count()).toBe(0);
  });

  it('exige la declaración explícita y una fecha válida', async () => {
    const b = browser(app);
    expect((await b.request('POST', '/age-gate', { birthDate: '1990-08-14', declaration: false })).statusCode).toBe(400);
    expect((await b.request('POST', '/age-gate', { birthDate: '1990-02-30', declaration: true })).statusCode).toBe(400);
    expect((await b.request('POST', '/age-gate', { birthDate: '2999-01-01', declaration: true })).statusCode).toBe(403);
  });

  it('no excluye adultos mayores (sin límite superior — §3.3)', async () => {
    expect((await browser(app).request('POST', '/age-gate', { birthDate: '1935-01-01', declaration: true })).statusCode).toBe(200);
  });

  it('respeta una edad mínima de campaña mayor a 18', async () => {
    const campaign = await db.campaign.create({ data: { slug: 'solo-21', internalName: 'x', route: 'A_COMERCIAL', status: 'ACTIVA' } });
    const version = await db.campaignVersion.create({
      data: {
        campaignId: campaign.id,
        version: 1,
        objective: 'o',
        channels: [],
        territories: [],
        rules: {},
        content: {},
        contentHash: '0'.repeat(64),
        minAge: 21,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 86_400_000),
      },
    });
    await db.campaign.update({ where: { id: campaign.id }, data: { activeVersionId: version.id } });
    const nineteen = `${new Date().getFullYear() - 19}-01-01`;
    const res = await browser(app).request('POST', '/age-gate', { birthDate: nineteen, declaration: true, campaignSlug: 'solo-21' });
    expect(error(res).code).toBe('AGE_REQUIREMENT_NOT_MET');
  });
});

describe('sesión y perfil', () => {
  it('/me exige sesión', async () => {
    const res = await browser(app).request('GET', '/me');
    expect(res.statusCode).toBe(401);
    expect(error(res).code).toBe('UNAUTHENTICATED');
  });

  it('cambia el alias con validación (sin datos personales en pantallas compartidas)', async () => {
    const b = browser(app);
    await b.request('POST', '/age-gate', ADULT);
    expect((await b.request('PATCH', '/me', { alias: 'Andrés' })).json()).toMatchObject({ alias: 'Andrés' });
    expect((await b.request('PATCH', '/me', { alias: '<script>' })).statusCode).toBe(400);
  });

  it('cerrar sesión revoca el token en el servidor', async () => {
    const b = browser(app);
    await b.request('POST', '/age-gate', ADULT);
    const stolen = new Map(b.jar);
    expect((await b.request('POST', '/auth/logout')).statusCode).toBe(204);
    b.jar.clear();
    for (const [k, v] of stolen) b.jar.set(k, v);
    expect((await b.request('GET', '/me')).statusCode).toBe(401);
  });
});

describe('consentimientos (§5.2, §9.3, §12.2)', () => {
  it('marketing empieza no otorgado y se registra por separado, con historial append-only', async () => {
    const b = browser(app);
    await b.request('POST', '/age-gate', ADULT);
    const initial = (await b.request('GET', '/consents')).json() as Array<{ purpose: string; granted: boolean }>;
    expect(initial.every((c) => c.granted === false)).toBe(true);

    await b.request('POST', '/consents', { purpose: 'MARKETING', granted: true, noticeVersion: '1.0', source: 'perfil' });
    const after = (await b.request('POST', '/consents', { purpose: 'MARKETING', granted: false, noticeVersion: '1.0', source: 'perfil' })).json() as Array<{
      purpose: string;
      granted: boolean;
    }>;
    expect(after.find((c) => c.purpose === 'MARKETING')?.granted).toBe(false);
    expect(after.find((c) => c.purpose === 'TERMINOS_Y_PRIVACIDAD')?.granted).toBe(false);
    expect(await db.consentRecord.count()).toBe(2);
  });

  it('aceptar términos exige la versión vigente del aviso', async () => {
    const b = browser(app);
    await b.request('POST', '/age-gate', ADULT);
    const res = await b.request('POST', '/consents', { purpose: 'TERMINOS_Y_PRIVACIDAD', granted: true, noticeVersion: '0.9', source: 'registro' });
    expect(error(res).code).toBe('CONFLICT');
  });
});

describe('acceso por código OTP (Instrucciones §3.1; Guía Técnica §5.2, §9.1)', () => {
  it('flujo completo: pedir código, verificar y pasar a cuenta ACTIVA sin exponer el número', async () => {
    const b = await adultWithTerms();
    const req = await b.request('POST', '/auth/otp/request', { channel: 'whatsapp', destination: PHONE });
    expect(req.json()).toMatchObject({ maskedDestination: '+57 300 •••• 567', expiresInSeconds: 300 });
    const code = outbox().get('+573001234567') as string;
    const res = await b.request('POST', '/auth/otp/verify', { channel: 'whatsapp', destination: PHONE, code });
    const me = MeSchema.parse(res.json());
    expect(me.status).toBe('ACTIVA');
    expect(me.credentials).toEqual([{ provider: 'otp:whatsapp', hint: '+57 300 •••• 567' }]);
    const cred = await db.identityCredential.findFirstOrThrow();
    expect(cred.subject).not.toContain('3001234567');
  });

  it('sin aceptar términos no se crea la cuenta persistente', async () => {
    const b = browser(app);
    await b.request('POST', '/age-gate', ADULT);
    await b.request('POST', '/auth/otp/request', { channel: 'whatsapp', destination: PHONE });
    const res = await b.request('POST', '/auth/otp/verify', { channel: 'whatsapp', destination: PHONE, code: outbox().get('+573001234567') });
    expect(error(res).code).toBe('CONSENT_REQUIRED');
  });

  it('limita reenvíos y bloquea tras 5 códigos incorrectos', async () => {
    const b = await adultWithTerms();
    await b.request('POST', '/auth/otp/request', { channel: 'whatsapp', destination: PHONE });
    expect(error(await b.request('POST', '/auth/otp/request', { channel: 'whatsapp', destination: PHONE })).code).toBe('RATE_LIMITED');
    const real = outbox().get('+573001234567');
    const wrong = real === '000000' ? '111111' : '000000';
    const codes: string[] = [];
    for (let i = 0; i < 5; i++) codes.push(error(await b.request('POST', '/auth/otp/verify', { channel: 'whatsapp', destination: PHONE, code: wrong })).code);
    expect(codes).toEqual(['OTP_INVALID', 'OTP_INVALID', 'OTP_INVALID', 'OTP_INVALID', 'OTP_LOCKED']);
    // Ni siquiera el código correcto sirve tras el bloqueo.
    expect(error(await b.request('POST', '/auth/otp/verify', { channel: 'whatsapp', destination: PHONE, code: real })).code).toBe('OTP_EXPIRED');
  });

  it('rechaza números que no son celulares colombianos', async () => {
    const b = await adultWithTerms();
    expect(error(await b.request('POST', '/auth/otp/request', { channel: 'whatsapp', destination: '601 555 1234' })).code).toBe('VALIDATION_FAILED');
  });

  it('en otro dispositivo, el mismo número inicia sesión en la cuenta existente', async () => {
    const first = await adultWithTerms();
    await first.request('POST', '/auth/otp/request', { channel: 'whatsapp', destination: PHONE });
    const original = MeSchema.parse(
      (await first.request('POST', '/auth/otp/verify', { channel: 'whatsapp', destination: PHONE, code: outbox().get('+573001234567') })).json(),
    );
    await app.get(RedisService).client.flushdb();

    const second = browser(app);
    await second.request('POST', '/age-gate', ADULT);
    await second.request('POST', '/auth/otp/request', { channel: 'whatsapp', destination: PHONE });
    const me = MeSchema.parse(
      (await second.request('POST', '/auth/otp/verify', { channel: 'whatsapp', destination: PHONE, code: outbox().get('+573001234567') })).json(),
    );
    expect(me.id).toBe(original.id);
    expect(MeSchema.parse((await second.request('GET', '/me')).json()).id).toBe(original.id);
  });

  it('Google/Apple responden "no configurado" hasta tener credenciales de ILC', async () => {
    expect(error(await browser(app).request('POST', '/auth/oauth/google', {})).code).toBe('AUTH_PROVIDER_NOT_CONFIGURED');
  });
});

describe('eliminar cuenta (derecho de supresión)', () => {
  it('borra datos personales y credenciales, revoca sesiones y conserva solo evidencia mínima', async () => {
    const b = await adultWithTerms();
    await b.request('POST', '/auth/otp/request', { channel: 'whatsapp', destination: PHONE });
    const me = MeSchema.parse(
      (await b.request('POST', '/auth/otp/verify', { channel: 'whatsapp', destination: PHONE, code: outbox().get('+573001234567') })).json(),
    );
    const stolen = new Map(b.jar);

    expect((await b.request('DELETE', '/me')).statusCode).toBe(204);
    expect(await db.userPii.count()).toBe(0);
    expect(await db.identityCredential.count()).toBe(0);
    const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
    expect(user).toMatchObject({ status: 'ELIMINADA', alias: 'Cuenta eliminada' });
    expect(await db.consentRecord.count()).toBe(1);
    expect(await db.auditEvent.count({ where: { action: 'account.deleted' } })).toBe(1);

    for (const [k, v] of stolen) b.jar.set(k, v);
    expect((await b.request('GET', '/me')).statusCode).toBe(401);
  });
});

describe('CSRF por origen (§9.1)', () => {
  it('rechaza operaciones desde un origen no permitido', async () => {
    const b = browser(app);
    await b.request('POST', '/age-gate', ADULT);
    const evil = browser(app, 'https://sitio-malicioso.example');
    for (const [k, v] of b.jar) evil.jar.set(k, v);
    const res = await evil.request('DELETE', '/me');
    expect(res.statusCode).toBe(403);
    expect((await b.request('GET', '/me')).statusCode).toBe(200);
  });
});

describe('configuración pública', () => {
  it('expone moneda, versión del aviso y canales disponibles sin secretos', async () => {
    const res = await browser(app).request('GET', '/config');
    expect(res.json()).toEqual({
      currencyName: 'Puntos ILC',
      legalNoticeVersion: '1.0',
      minAge: 18,
      otpChannels: ['whatsapp', 'sms', 'email'],
      oauthProviders: [],
    });
  });
});

describe('límite antiabuso por IP en el control de edad', () => {
  it('responde RATE_LIMITED al superar AUTH_RATE_LIMIT_PER_MINUTE', async () => {
    process.env.AUTH_RATE_LIMIT_PER_MINUTE = '3';
    try {
      const responses = [];
      for (let i = 0; i < 4; i++) responses.push(await browser(app).request('POST', '/age-gate', ADULT, { 'x-forwarded-for': '203.0.113.7' }));
      expect(responses.map((r) => r.statusCode)).toEqual([200, 200, 200, 429]);
      expect(error(responses[3] as { json: () => unknown }).code).toBe('RATE_LIMITED');
    } finally {
      process.env.AUTH_RATE_LIMIT_PER_MINUTE = '1000';
    }
  });
});
