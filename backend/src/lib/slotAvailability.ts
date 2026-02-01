import { PrismaClient, Prisma } from '@prisma/client';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * For a slot: bookedSeats = sum(participants) of CONFIRMED bookings.
 * heldSeats = sum(participantsHeld) of ACTIVE SeatHolds (expiresAt null or > now).
 * freeSeats = capacityTotal - bookedSeats - heldSeats.
 */
export async function getSlotAvailability(
  tx: Tx,
  slot: { id: string; capacity: number; workshopId: string; date: string; time: string; status: string }
) {
  const now = new Date();
  const [bookedResult, holdResult] = await Promise.all([
    tx.booking.aggregate({
      where: { slotId: slot.id, status: 'CONFIRMED' },
      _sum: { participants: true },
    }),
    tx.seatHold.aggregate({
      where: {
        slotId: slot.id,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      _sum: { participantsHeld: true },
    }),
  ]);
  const bookedSeats = bookedResult._sum.participants ?? 0;
  const heldSeats = holdResult._sum.participantsHeld ?? 0;
  const freeSeats = Math.max(0, slot.capacity - bookedSeats - heldSeats);
  return { bookedSeats, heldSeats, freeSeats };
}

export async function getSlotsWithAvailability(
  tx: Tx,
  slots: { id: string; capacity: number; workshopId: string; date: string; time: string; status: string }[]
) {
  const now = new Date();
  const slotIds = slots.map((s) => s.id);
  const [bookingsBySlot, holdsBySlot] = await Promise.all([
    tx.booking.groupBy({
      by: ['slotId'],
      where: { slotId: { in: slotIds }, status: 'CONFIRMED' },
      _sum: { participants: true },
    }),
    tx.seatHold.groupBy({
      by: ['slotId'],
      where: {
        slotId: { in: slotIds },
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      _sum: { participantsHeld: true },
    }),
  ]);
  const bookedMap = new Map(bookingsBySlot.map((b) => [b.slotId, b._sum.participants ?? 0]));
  const heldMap = new Map(holdsBySlot.map((h) => [h.slotId, h._sum.participantsHeld ?? 0]));
  return slots.map((s) => {
    const bookedSeats = bookedMap.get(s.id) ?? 0;
    const heldSeats = heldMap.get(s.id) ?? 0;
    const freeSeats = Math.max(0, s.capacity - bookedSeats - heldSeats);
    return { ...s, bookedSeats, heldSeats, freeSeats };
  });
}
