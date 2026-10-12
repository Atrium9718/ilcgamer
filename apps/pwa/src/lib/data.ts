import type { ClaimResult, ProductCodeLookup } from '@ilc/contracts';
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
}

export interface DataSource {
  readonly demo: boolean;
  /** Consulta del código de producto (no consume ninguna promoción — Guía Técnica §5.6). */
  lookupCode(token: string): Promise<ProductCodeLookup>;
  /** Reclamación de la promoción de la botella. Reutilice la MISMA clave al reintentar (§5.7 regla 8). */
  claimCode(token: string, idempotencyKey: string): Promise<ClaimResult>;
  joinParche(pin: string, alias: string): Promise<{ sessionId: string } | { error: 'invalid'; attemptsLeft: number }>;
  wallet(): Promise<WalletData>;
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
      pointsExpireAt: null,
      balance: DEMO.balance + (c?.points ?? 0),
      campaign: { slug: 'feria', title: DEMO.campaignLabel },
      claimedAt: new Date().toISOString(),
    };
  },
  async joinParche(pin) {
    await wait(300);
    return pin === DEMO.parche.pin ? { sessionId: DEMO.parche.id } : { error: 'invalid', attemptsLeft: 3 };
  },
  async wallet() {
    await wait(200);
    return {
      balance: DEMO.balance,
      currencyName: DEMO.currencyName,
      expiringNotice: `300 ${DEMO.currencyName} vencen el 30 nov. 2026`,
      entries: [...DEMO.ledger],
    };
  },
};

const apiSource: DataSource = {
  demo: false,
  lookupCode: (token) => apiRequest<ProductCodeLookup>(`/product-codes/${encodeURIComponent(token)}/status`),
  claimCode: (token, idempotencyKey) => apiRequest<ClaimResult>(`/campaign-codes/${encodeURIComponent(token)}/claim`, { method: 'POST', idempotencyKey }),
  joinParche: (pin, alias) => apiRequest(`/sessions/join`, { method: 'POST', body: { pin, alias } }), // Paso 8
  wallet: () => apiRequest<WalletData>('/wallet'), // Paso 7
};

export const data: DataSource = import.meta.env.VITE_DEMO_DATA === 'true' ? demoSource : apiSource;
