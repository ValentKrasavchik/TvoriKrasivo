import { prisma } from './prisma';
import { sendBookingReminderEmail } from './bookingReminderMail';

const DEFAULT_OFFSET = '+03:00'; // Донецк / MSK

function slotStartAtIso(date: string, time: string, offset: string) {
  const hm = (time || '12:00').slice(0, 5);
  return `${date}T${hm}:00${offset}`;
}

function getSlotOffset(): string {
  const raw = (process.env.SLOT_TIMEZONE_OFFSET || DEFAULT_OFFSET).trim();
  // minimal validation: +HH:MM or -HH:MM
  if (!/^[+-]\d{2}:\d{2}$/.test(raw)) return DEFAULT_OFFSET;
  return raw;
}

/**
 * Раз в несколько минут ищет подтверждённые записи, до которых ~24 часа, и шлёт письмо.
 * Письмо отправляется один раз (booking.reminderSentAt).
 */
export function startBookingReminderScheduler() {
  if (process.env.NODE_ENV === 'test') return;

  const pollMinutes = Math.max(1, parseInt(String(process.env.REMINDER_POLL_MINUTES || 10), 10) || 10);
  const windowMinutes = Math.max(1, parseInt(String(process.env.REMINDER_WINDOW_MINUTES || 30), 10) || 30);
  const offset = getSlotOffset();

  const tick = async () => {
    const now = new Date();
    const from = new Date(now.getTime() + (24 * 60 - Math.floor(windowMinutes / 2)) * 60_000);
    const to = new Date(now.getTime() + (24 * 60 + Math.ceil(windowMinutes / 2)) * 60_000);

    try {
      const bookings = await prisma.booking.findMany({
        where: {
          status: 'CONFIRMED',
          reminderSentAt: null,
          email: { not: '' },
        },
        include: { slot: { include: { workshop: true } } },
      });

      for (const b of bookings) {
        const slot = b.slot;
        const workshop = slot?.workshop;
        if (!slot || !workshop) continue;
        const startAt = new Date(slotStartAtIso(slot.date, slot.time, offset));
        if (Number.isNaN(startAt.getTime())) continue;
        if (startAt < from || startAt > to) continue;

        try {
          await sendBookingReminderEmail({
            recipientEmail: b.email.trim(),
            workshopTitle: workshop.title,
            priceRub: workshop.price,
            slotDate: slot.date,
            slotTime: slot.time,
            name: b.name,
            phone: b.phone,
            messenger: b.messenger,
            participants: b.participants,
            comment: b.comment,
            bookingStatus: 'Подтверждена',
          });

          await prisma.booking.update({
            where: { id: b.id },
            data: { reminderSentAt: new Date() },
          });
        } catch (sendErr) {
          console.error('[reminder] send failed', { bookingId: b.id }, sendErr);
        }
      }
    } catch (e) {
      console.error('[reminder] tick failed', e);
    }
  };

  // first run (async)
  void tick();
  setInterval(() => void tick(), pollMinutes * 60_000);
}

