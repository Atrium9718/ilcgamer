import {
  CAMPAIGN_CODE_STATUSES,
  CAMPAIGN_STATUSES,
  CONSENT_PURPOSES,
  LEDGER_ENTRY_TYPES,
  PRODUCT_CODE_STATUSES,
  REWARD_CLAIM_STATUSES,
  ROUTES,
  SESSION_STATUSES,
} from '@ilc/contracts';
import { describe, expect, it } from 'vitest';
import * as db from '../src/generated/prisma/enums.ts';

/** El esquema de BD y los contratos compartidos con la PWA no pueden divergir. */
describe('enums de dominio: Prisma ⇄ @ilc/contracts', () => {
  const pairs: Array<[string, object, readonly string[]]> = [
    ['Route', db.Route, ROUTES],
    ['CampaignStatus', db.CampaignStatus, CAMPAIGN_STATUSES],
    ['ProductCodeStatus', db.ProductCodeStatus, PRODUCT_CODE_STATUSES],
    ['CampaignCodeStatus', db.CampaignCodeStatus, CAMPAIGN_CODE_STATUSES],
    ['SessionStatus', db.SessionStatus, SESSION_STATUSES],
    ['LedgerEntryType', db.LedgerEntryType, LEDGER_ENTRY_TYPES],
    ['RewardClaimStatus', db.RewardClaimStatus, REWARD_CLAIM_STATUSES],
    ['ConsentPurpose', db.ConsentPurpose, CONSENT_PURPOSES],
  ];
  it.each(pairs)('%s coincide', (_name, prismaEnum, contract) => {
    expect(Object.values(prismaEnum).sort()).toEqual([...contract].sort());
  });
});
