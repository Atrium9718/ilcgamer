import type { CodeStatus, LedgerEntryView } from '@ilc/ui';
import { DEMO } from '../demo/fixtures.ts';
import { apiRequest } from './api.ts';

/**
 * Fuente de datos de la PWA. Los contenedores dependen de esta interfaz, no de la implementación:
 * - demo: datos locales visibles como "demostración" (VITE_DEMO_DATA=true) mientras se construyen los módulos.
 * - api: endpoints de la Guía Técnica §7; cada uno se habilita en el paso del plan que lo implementa.
 */
export interface CodeLookup {
  status: CodeStatus;
  brandLabel: string;
  themeId: string;
  productLabel?: string;
  routeABadge?: string;
  canActivate: boolean;
}

export interface WalletData {
  balance: number;
  currencyName: string;
  expiringNotice?: string;
  entries: LedgerEntryView[];
}

export interface DataSource {
  readonly demo: boolean;
  lookupCode(token: string): Promise<CodeLookup>;
  joinParche(pin: string, alias: string): Promise<{ sessionId: string } | { error: 'invalid'; attemptsLeft: number }>;
  wallet(): Promise<WalletData>;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const demoSource: DataSource = {
  demo: true,
  async lookupCode(token) {
    await wait(250);
    const c = DEMO.codes[token];
    if (!c) return { status: 'unrecognized', brandLabel: 'Industria Licorera de Caldas', themeId: 'ilc', canActivate: false };
    return {
      status: c.status,
      brandLabel: c.brand,
      themeId: c.theme,
      productLabel: c.product,
      routeABadge: c.points ? `+${c.points} ${DEMO.currencyName}` : undefined,
      canActivate: c.canActivate,
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
  lookupCode: (token) => apiRequest<CodeLookup>(`/product-codes/${encodeURIComponent(token)}/status`), // Paso 6
  joinParche: (pin, alias) => apiRequest(`/sessions/join`, { method: 'POST', body: { pin, alias } }), // Paso 8
  wallet: () => apiRequest<WalletData>('/wallet'), // Paso 7
};

export const data: DataSource = import.meta.env.VITE_DEMO_DATA === 'true' ? demoSource : apiSource;
