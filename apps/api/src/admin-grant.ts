import { RoleSchema } from '@ilc/contracts';
import { PrismaPg } from '@prisma/adapter-pg';
import { hmac } from './common/crypto.ts';
import { loadEnv } from './config/env.ts';
import { PrismaClient } from './generated/prisma/client.ts';
import { normalizeDestination } from './identity/destination.ts';

/**
 * Asigna o retira un rol operativo a una persona identificada por correo (alta de personal de consola).
 *   pnpm --filter @ilc/api admin:grant -- --email laura@ilc.com.co --role ADMIN_MARCA
 *   pnpm --filter @ilc/api admin:grant -- --email laura@ilc.com.co --role ADMIN_MARCA --revoke
 * La persona inicia sesión en la consola con un código enviado a ese correo. Queda en auditoría.
 */
const args = new Map<string, string>();
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i] as string;
  if (a.startsWith('--')) args.set(a.slice(2), argv[i + 1]?.startsWith('--') || argv[i + 1] === undefined ? 'true' : (argv[++i] as string));
}
const email = normalizeDestination('email', args.get('email') ?? '');
const role = RoleSchema.parse(args.get('role'));
if (role === 'JUGADOR') throw new Error('JUGADOR no es un rol operativo.');
const revoke = args.get('revoke') === 'true';
const alias = args.get('alias') ?? email.split('@')[0]?.slice(0, 20) ?? 'Equipo ILC';

const env = loadEnv();
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
const subject = hmac(env.APP_SECRET, `email:${email}`);

let user = await db.user.findFirst({ where: { credentials: { some: { provider: 'otp:email', subject } } } });
if (!user && revoke) throw new Error('No existe una cuenta con ese correo.');
if (!user) {
  user = await db.user.create({
    data: {
      alias,
      status: 'ACTIVA',
      ageVerifiedAt: new Date(),
      ageGateMethod: 'alta_personal',
      pii: { create: { email } },
      credentials: { create: { provider: 'otp:email', subject, verifiedAt: null } },
    },
  });
}
if (revoke) await db.userRole.deleteMany({ where: { userId: user.id, role } });
else await db.userRole.upsert({ where: { userId_role_scopeId: { userId: user.id, role, scopeId: '' } }, update: {}, create: { userId: user.id, role } });
await db.auditEvent.create({
  data: {
    actorId: null,
    action: revoke ? 'role.revoked' : 'role.granted',
    resource: 'user',
    resourceId: user.id,
    outcome: 'ok',
    metadata: { role, via: 'cli' },
  },
});
await db.$disconnect();
console.log(`✓ ${revoke ? 'Retirado' : 'Asignado'} ${role} a ${alias} (${email.replace(/^(.{2}).*@/, '$1•••@')})`);
