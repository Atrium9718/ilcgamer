import { PrismaPg } from '@prisma/adapter-pg';
import { loadEnv } from './config/env.ts';
import { PrismaClient } from './generated/prisma/client.ts';

/**
 * Datos base: marcas y ajustes por defecto. Es idempotente (no pisa ajustes ya editados) y por eso también se usa en
 * producción tras la primera migración. NO inventa SKUs, lotes ni valores de puntos: esos los define ILC
 * (Guía Técnica §15) y se cargan por campaña desde la consola.
 */
const env = loadEnv();
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });

const BRANDS = [
  { slug: 'ilc', name: 'Industria Licorera de Caldas', themeId: 'ilc' },
  { slug: 'ron-viejo-de-caldas', name: 'Ron Viejo de Caldas', themeId: 'ron-viejo-de-caldas' },
  { slug: 'aguardiente-amarillo', name: 'Aguardiente Amarillo de Manzanares', themeId: 'aguardiente-amarillo' },
  { slug: 'aguardiente-cristal', name: 'Aguardiente Cristal', themeId: 'aguardiente-cristal' },
];

/** Parámetros editables por administradores (Instrucciones §4.1, §4.2, §6). */
const SETTINGS: Record<string, unknown> = {
  'economy.currencyName': 'Puntos ILC',
  'smartTag.urlTemplate': 'https://ilc.app/v/{token}',
  'antifraud.geofencingEnabled': false,
  'session.pinLength': 4,
};

for (const b of BRANDS) await db.brand.upsert({ where: { slug: b.slug }, update: { name: b.name, themeId: b.themeId }, create: b });
for (const [key, value] of Object.entries(SETTINGS)) {
  await db.platformSetting.upsert({ where: { key }, update: {}, create: { key, value: value as never } });
}
await db.$disconnect();
console.log(`✓ Seed: ${BRANDS.length} marcas, ${Object.keys(SETTINGS).length} ajustes de plataforma`);
