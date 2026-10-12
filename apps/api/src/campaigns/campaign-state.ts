import type { CampaignStatus } from '../generated/prisma/enums.ts';

/**
 * Transiciones manuales permitidas del ciclo de vida de la campaña (Guía Técnica §5.3).
 * Las automáticas (revisión → aprobada, programada → activa, vencida → cerrada) las hace el servicio/programador.
 */
export const MANUAL_TRANSITIONS = {
  pause: { from: ['ACTIVA'], to: 'PAUSADA' },
  resume: { from: ['PAUSADA'], to: 'ACTIVA' },
  close: { from: ['PROGRAMADA', 'ACTIVA', 'PAUSADA'], to: 'CERRADA' },
  archive: { from: ['BORRADOR', 'CERRADA'], to: 'ARCHIVADA' },
} as const satisfies Record<string, { from: readonly CampaignStatus[]; to: CampaignStatus }>;

export type ManualAction = keyof typeof MANUAL_TRANSITIONS;

/** ¿La campaña puede emitir beneficios nuevos en este instante? (Guía Técnica §5.3, §12.2). */
export function isCampaignOpen(
  campaign: { status: CampaignStatus },
  version: { startsAt: Date; endsAt: Date; state: string } | null,
  now = new Date(),
): boolean {
  return (
    campaign.status === 'ACTIVA' && version?.state === 'PUBLICADA' && version.startsAt.getTime() <= now.getTime() && now.getTime() < version.endsAt.getTime()
  );
}
