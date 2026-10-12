import type { PrismaService } from '../prisma/prisma.service.ts';

const OPEN = (v: { approvedAt: Date | null; suspendedAt: Date | null }) => v.approvedAt !== null && v.suspendedAt === null;

/** Establecimiento donde trabaja un Staff (cuenta activa). */
export async function venueOfStaff(prisma: Pick<PrismaService, 'staffAccount'>, userId: string) {
  const s = await prisma.staffAccount.findUnique({ where: { userId }, include: { venue: true } });
  return s?.active ? { account: s, venue: s.venue } : null;
}

/** Establecimiento de un Dealer (el rol lleva el id del establecimiento como ámbito). */
export async function venueOfDealer(prisma: Pick<PrismaService, 'userRole' | 'venue'>, userId: string) {
  const role = await prisma.userRole.findFirst({ where: { userId, role: 'DEALER', scopeId: { not: '' } } });
  return role ? prisma.venue.findUnique({ where: { id: role.scopeId } }) : null;
}

/** Venue desde el que opera una persona de punto de venta (Staff o Dealer), solo si está aprobado y activo. */
export async function operatingVenue(prisma: Pick<PrismaService, 'staffAccount' | 'userRole' | 'venue'>, userId: string) {
  const staff = await venueOfStaff(prisma, userId);
  const venue = staff?.venue ?? (await venueOfDealer(prisma, userId));
  return venue && OPEN(venue) ? venue : null;
}
