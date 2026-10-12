import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.ts';
import { PrismaService } from '../prisma/prisma.service.ts';

export interface AuditInput {
  actorId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  outcome?: 'ok' | 'denied' | 'error';
  reason?: string;
  requestId?: string;
  metadata?: Prisma.InputJsonValue;
}

/** Bitácora de acciones sensibles (Guía Técnica §9.1). Nunca registrar PII ni tokens en metadata. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput, tx: Prisma.TransactionClient = this.prisma): Promise<void> {
    await tx.auditEvent.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        outcome: input.outcome ?? 'ok',
        reason: input.reason,
        requestId: input.requestId,
        metadata: input.metadata,
      },
    });
  }
}
