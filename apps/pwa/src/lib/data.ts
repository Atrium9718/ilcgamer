import type { ClaimResult, ProductCodeLookup, Progress, Wallet } from '@ilc/contracts';
import type { LedgerEntryView } from '@ilc/ui';
import { DEMO } from '../demo/fixtures.ts';
import { apiRequest } from './api.ts';

/**
 * Fuente de datos de la PWA. Los contenedores dependen de esta interfaz, no de la implementación:
 * - demo: datos locales visibles como "demostración" (VITE_DEMO_DATA=true) mientras se construyen los módulos.
 * - api: endpoints de la Guía Técnica §7; cada uno se habilita en el paso del plan que lo implementa.
 */
export interface WalletData {
  balance: number;
  currencyName: string;
  expiringNotice?: string;
  entries: LedgerEntryView[];
  /** Cursor de la siguiente página de movimientos (más antiguos). */
  nextCursor: string | null;
}

const shortDate = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });
const longDate = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' });

/** Contrato de la API → modelo de la vista (fechas en hora de Colombia). */
export function toWalletData(w: Wallet): WalletData {
  return {
    balance: w.balance,
    currencyName: w.currencyName,
    expiringNotice: w.expiring
      ? `${w.expiring.amount.toLocaleString('es-CO')} ${w.currencyName} vencen el ${longDate.format(new Date(w.expiring.at))}`
      : undefined,
    entries: w.entries.map((e) => ({
      id: e.id,
      kind: e.kind,
      amount: e.amount,
      description: e.description,
      detail: e.detail,
      dateLabel: shortDate.format(new Date(e.at)),
    })),
    nextCursor: w.nextCursor,
  };
}

export interface DataSource {
  readonly demo: boolean;
  /** Consulta del código de producto (no consume ninguna promoción — Guía Técnica §5.6). */
  lookupCode(token: string): Promise<ProductCodeLookup>;
  /** Reclamación de la promoción de la botella. Reutilice la MISMA clave al reintentar (§5.7 regla 8). */
  claimCode(token: string, idempotencyKey: string, sessionId?: string, staffCode?: string): Promise<ClaimResult>;
  wallet(cursor?: string): Promise<WalletData>;
  /** XP, nivel e insignias (Ruta B). */
  progress(): Promise<Progress>;
}

/** Reclamaciones de la demostración (solo en memoria de la pestaña). */
const demoClaimed = new Set<string>();

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const demoSource: DataSource = {
  demo: true,
  async lookupCode(token) {
    await wait(250);
    const c = DEMO.codes[token];
    if (!c) return { status: 'unrecognized', brandLabel: 'Industria Licorera de Caldas', themeId: 'ilc', campaign: null };
    const claimed = demoClaimed.has(token);
    return {
      status: c.status,
      brandLabel: c.brand,
      themeId: c.theme,
      productLabel: c.product,
      campaign: c.points
        ? {
            slug: 'feria',
            title: DEMO.campaignLabel,
            availability: claimed ? 'claimed_by_you' : c.canActivate ? 'available' : 'not_available',
            points: c.points,
            currencyName: DEMO.currencyName,
            pointsExpiryDays: 180,
            minAge: 18,
            endsAt: '2027-01-31T05:00:00.000Z',
            activationsPerUserPerDay: 3,
          }
        : null,
    };
  },
  async claimCode(token) {
    await wait(400);
    const c = DEMO.codes[token];
    demoClaimed.add(token);
    return {
      claimId: '00000000-0000-7000-8000-00000000c1a1',
      replayed: false,
      points: c?.points ?? 0,
      currencyName: DEMO.currencyName,
      xp: 0,
      pointsExpireAt: null,
      balance: DEMO.balance + (c?.points ?? 0),
      campaign: { slug: 'feria', title: DEMO.campaignLabel },
      claimedAt: new Date().toISOString(),
      parcheRecharged: false,
    };
  },
  async wallet() {
    await wait(200);
    return {
      balance: DEMO.balance,
      currencyName: DEMO.currencyName,
      expiringNotice: `300 ${DEMO.currencyName} vencen el 30 nov. 2026`,
      entries: [...DEMO.ledger],
      nextCursor: null,
    };
  },
  async progress() {
    await wait(150);
    return { ...DEMO.progress, level: { ...DEMO.progress.level }, badges: DEMO.progress.badges.map((b) => ({ ...b })) };
  },
};

const apiSource: DataSource = {
  demo: false,
  lookupCode: (token) => apiRequest<ProductCodeLookup>(`/product-codes/${encodeURIComponent(token)}/status`),
  claimCode: (token, idempotencyKey, sessionId, staffCode) =>
    apiRequest<ClaimResult>(`/campaign-codes/${encodeURIComponent(token)}/claim`, {
      method: 'POST',
      idempotencyKey,
      body: { ...(sessionId ? { sessionId } : {}), ...(staffCode ? { staffCode } : {}) },
    }),
  wallet: async (cursor) => toWalletData(await apiRequest<Wallet>(`/wallet${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`)),
  progress: () => apiRequest<Progress>('/profile/progress'),
};

export const data: DataSource = import.meta.env.VITE_DEMO_DATA === 'true' ? demoSource : apiSource;
