import type { MyRewardClaim, RewardCatalog, RewardClaimResult } from '@ilc/contracts';
import { DEMO } from '../demo/fixtures.ts';
import { apiRequest } from './api.ts';
import { data } from './data.ts';

/** Cliente de recompensas (Guía Técnica §5.8). El canje lo confirma el servidor: stock y puntos de forma atómica. */
const realApi = {
  catalog: () => apiRequest<RewardCatalog>('/rewards'),
  claim: (id: string, zone: string, idempotencyKey: string) =>
    apiRequest<RewardClaimResult>(`/rewards/${encodeURIComponent(id)}/claim`, { method: 'POST', body: { zone }, idempotencyKey }),
  mine: () => apiRequest<MyRewardClaim[]>('/rewards/claims'),
};

// ── Demostración (VITE_DEMO_DATA=true) ──
const demoClaims: MyRewardClaim[] = [];
const demoApi: typeof realApi = {
  async catalog() {
    return {
      balance: DEMO.balance,
      currencyName: DEMO.currencyName,
      rewards: DEMO.rewards.map((r) => ({
        id: r.id,
        name: r.name,
        description: '',
        type: r.id === 'insignia' ? ('DIGITAL' as const) : r.id === 'visita' ? ('EXPERIENCIA' as const) : ('MERCHANDISING' as const),
        icon: r.icon,
        cost: r.cost,
        conditions: [...DEMO.rewardConditions],
        maxPerUser: 1,
        endsAt: '2026-12-31T05:00:00.000Z',
        campaign: null,
        zones: [
          { zone: 'Manizales', available: 14 },
          { zone: 'Pereira', available: 6 },
        ],
        soldOut: false,
        claimedByYou: 0,
        delivery: r.id === 'insignia' ? ('immediate' as const) : ('pickup' as const),
      })),
    };
  },
  async claim(id, zone) {
    const r = DEMO.rewards.find((x) => x.id === id);
    const code = 'DEMO0K7M';
    demoClaims.unshift({
      id: crypto.randomUUID(),
      rewardName: r?.name ?? id,
      icon: r?.icon ?? 'redeem',
      status: 'RESERVADO',
      code,
      cost: r?.cost ?? 0,
      zone,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      deliveredAt: null,
    });
    return {
      claimId: crypto.randomUUID(),
      status: 'RESERVADO',
      rewardName: r?.name ?? id,
      cost: r?.cost ?? 0,
      zone,
      code,
      balance: DEMO.balance - (r?.cost ?? 0),
      currencyName: DEMO.currencyName,
      expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      replayed: false,
    };
  },
  async mine() {
    return [...demoClaims];
  },
};

export const rewardsApi = data.demo ? demoApi : realApi;
