import { PrismaClient } from '@prisma/client';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export type SlotForAvailability = {
  id: string;
  capacity: number;
  workshopId: string;
  date: string;
  time: string;
  status: string;
  offlineOccupiedSeats?: number | null;
  manualOccupiedSeats?: number | null;
};

function offlineSeats(slot: { offlineOccupiedSeats?: number | null }): number {
  const n = Number(slot.offlineOccupiedSeats ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function manualSeats(slot: { manualOccupiedSeats?: number | null }): number | null {
  const m = slot.manualOccupiedSeats;
  if (m === null || m === undefined) return null;
  const n = Number(m);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

/**
 * bookedSeats — сумма участников по подтверждённым броням (факт из БД).
 * Если задан manualOccupiedSeats — для freeSeats вместо (bookedSeats + offline) используется только manualOccupiedSeats (офлайн не суммируется).
 * Иначе: bookedSeats + offlineOccupiedSeats.
 * heldSeats — активные холды, всегда вычитаются.
 * freeSeats = capacity - nonHoldOccupied - heldSeats.
 */
export async function getSlotAvailability(tx: Tx, slot: SlotForAvailability) {
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
  const offline = offlineSeats(slot);
  const manual = manualSeats(slot);
  const nonHoldOccupied = manual != null ? manual : bookedSeats + offline;
  const freeSeats = Math.max(0, slot.capacity - nonHoldOccupied - heldSeats);
  return {
    bookedSeats,
    heldSeats,
    offlineOccupiedSeats: offline,
    manualOccupiedSeats: manual,
    /** Занято мест без учёта вместимости (для подписей в админке): то, что вычитаем вместе с холдами */
    nonHoldOccupiedSeats: nonHoldOccupied,
    freeSeats,
  };
}

export async function getSlotsWithAvailability(tx: Tx, slots: SlotForAvailability[]) {
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
    const offline = offlineSeats(s);
    const manual = manualSeats(s);
    const nonHoldOccupied = manual != null ? manual : bookedSeats + offline;
    const freeSeats = Math.max(0, s.capacity - nonHoldOccupied - heldSeats);
    return {
      ...s,
      bookedSeats,
      heldSeats,
      offlineOccupiedSeats: offline,
      manualOccupiedSeats: manual,
      nonHoldOccupiedSeats: nonHoldOccupied,
      freeSeats,
    };
  });
}
