import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma';
import { normalizePhone } from '../lib/validation';
import { getSlotsWithAvailability } from '../lib/slotAvailability';

export const publicRouter = Router();

const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many booking attempts. Try again later.' },
});

// GET /api/public/workshops — список активных мастер-классов
publicRouter.get('/workshops', async (_req: Request, res: Response) => {
  try {
    const workshops = await prisma.workshop.findMany({
      where: { isActive: true },
      orderBy: { title: 'asc' },
    });
    res.json(
      workshops.map((w) => ({
        id: w.id,
        title: w.title,
        description: w.description,
        durationMinutes: w.durationMinutes,
        capacityPerSlot: w.capacityPerSlot,
        result: w.result,
        price: w.price,
        imageUrl: w.imageUrl ?? null,
        isActive: w.isActive,
      }))
    );
  } catch (e) {
    console.error('GET /api/public/workshops', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/public/reviews — отзывы гостей
publicRouter.get('/reviews', async (_req: Request, res: Response) => {
  try {
    const list = await prisma.review.findMany({ orderBy: { date: 'desc' } });
    res.json(
      list.map((r) => ({
        id: r.id,
        name: r.name,
        text: r.text,
        rating: r.rating,
        date: r.date,
      }))
    );
  } catch (e) {
    console.error('GET /api/public/reviews', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/public/gallery — галерея работ
publicRouter.get('/gallery', async (_req: Request, res: Response) => {
  try {
    const list = await prisma.galleryImage.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json(
      list.map((g) => ({
        id: g.id,
        imageUrl: g.imageUrl,
        alt: g.alt ?? null,
        sortOrder: g.sortOrder,
      }))
    );
  } catch (e) {
    console.error('GET /api/public/gallery', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/public/slots — слоты с вычисленными bookedSeats, heldSeats, freeSeats
publicRouter.get('/slots', async (req: Request, res: Response) => {
  try {
    const workshopId = req.query.workshopId as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;

    if (!workshopId) {
      return res.status(400).json({ error: 'workshopId is required' });
    }

    const workshop = await prisma.workshop.findUnique({ where: { id: workshopId } });
    if (!workshop) {
      return res.status(404).json({ error: 'Workshop not found' });
    }

    const where: any = { workshopId };
    if (dateFrom) where.date = { ...where.date, gte: dateFrom };
    if (dateTo) where.date = { ...where.date, lte: dateTo };
    if (dateFrom && dateTo) where.date = { gte: dateFrom, lte: dateTo };
    else if (dateFrom) where.date = { gte: dateFrom };
    else if (dateTo) where.date = { lte: dateTo };

    const slots = await prisma.slot.findMany({
      where,
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });

    const withAvailability = await getSlotsWithAvailability(prisma, slots);

    // Чтобы замороженные (HELD) слоты сразу отображались на клиенте — не кэшировать ответ
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

    res.json(
      withAvailability.map((s) => {
        const startAt = `${s.date}T${s.time}:00`;
        const durationMinutes = (s as any).durationMinutes ?? workshop.durationMinutes;
        return {
          id: s.id,
          workshopId: s.workshopId,
          date: s.date,
          time: s.time,
          startAt,
          durationMinutes,
          capacityTotal: s.capacity,
          capacityBooked: s.bookedSeats,
          heldSeats: s.heldSeats,
          freeSeats: s.freeSeats,
          status: s.status,
        };
      })
    );
  } catch (e) {
    console.error('GET /api/public/slots', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const SEAT_HOLD_EXPIRES_MINUTES = 120; // 2 hours

// POST /api/public/bookings — с логикой overflow (participants > freeSeats → PENDING_ADMIN + SeatHold)
publicRouter.post('/bookings', bookingLimiter, async (req: Request, res: Response) => {
  try {
    const { slotId, workshopId, date, time, name, phone, messenger, participants = 1, comment, honeypot } = req.body;

    if (honeypot) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const hasSlotId = Boolean(slotId);
    const hasTimePick = Boolean(workshopId && date && time);

    if ((!hasSlotId && !hasTimePick) || !name || !phone || !messenger) {
      return res.status(400).json({
        error: 'Validation error',
        fields: {
          ...(!hasSlotId && !hasTimePick && { slotId: 'Choose time in calendar' }),
          ...(!name?.trim() && { name: 'Required' }),
          ...(!phone?.trim() && { phone: 'Required' }),
          ...(!messenger && { messenger: 'Required' }),
        },
      });
    }

    const participantsNum = Math.max(1, parseInt(String(participants), 10) || 1);
    const phoneNorm = normalizePhone(phone);
    if (!phoneNorm) {
      return res.status(400).json({ error: 'Validation error', fields: { phone: 'Invalid phone number' } });
    }

    const result = await prisma.$transaction(async (tx) => {
      let effectiveSlotId: string = String(slotId || '');

      if (!effectiveSlotId) {
        const ws = await tx.workshop.findUnique({ where: { id: String(workshopId) } });
        if (!ws) return { error: 'Workshop not found', status: 404 as const };

        const upserted = await tx.slot.upsert({
          where: {
            workshopId_date_time: {
              workshopId: String(workshopId),
              date: String(date),
              time: String(time),
            },
          },
          update: {},
          create: {
            workshopId: String(workshopId),
            date: String(date),
            time: String(time),
            capacity: ws.capacityPerSlot,
            durationMinutes: ws.durationMinutes,
            status: 'OPEN',
          },
        });
        effectiveSlotId = upserted.id;
      }

      const slot = await tx.slot.findUnique({ where: { id: effectiveSlotId } });
      if (!slot) return { error: 'not_found', status: 404 as const };
      if (slot.status === 'HELD') {
        return { error: 'Slot is not available for booking', status: 409 as const };
      }
      if (slot.status === 'CANCELLED') {
        return { error: 'Slot is cancelled', status: 409 as const };
      }

      const { freeSeats } = await import('../lib/slotAvailability').then((m) =>
        m.getSlotAvailability(tx, slot)
      );

      if (participantsNum <= freeSeats) {
        const booking = await tx.booking.create({
          data: {
            workshopId: slot.workshopId,
            slotId: effectiveSlotId,
            name: String(name).trim(),
            phone: phoneNorm,
            messenger: String(messenger).trim(),
            participants: participantsNum,
            comment: comment ? String(comment).trim() : null,
            status: 'CONFIRMED',
          },
        });
        return { booking, status: 201 as const, overflow: false };
      }

      // Overflow: создаём PENDING_ADMIN + SeatHold на participants
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + SEAT_HOLD_EXPIRES_MINUTES);

      const booking = await tx.booking.create({
        data: {
          workshopId: slot.workshopId,
          slotId: effectiveSlotId,
          name: String(name).trim(),
          phone: phoneNorm,
          messenger: String(messenger).trim(),
          participants: participantsNum,
          comment: comment ? String(comment).trim() : null,
          status: 'PENDING_ADMIN',
        },
      });

      await tx.seatHold.create({
        data: {
          slotId: effectiveSlotId,
          bookingId: booking.id,
          participantsHeld: participantsNum,
          reason: 'overflow request',
          expiresAt,
          status: 'ACTIVE',
        },
      });

      return {
        booking,
        status: 202 as const,
        overflow: true,
        message:
          'Столько мест в выбранном времени нет. Мы поставили холд на указанное количество мест и передали запрос администратору.',
      };
    });

    if (result.error && result.status) {
      return res.status(result.status).json({ error: result.error });
    }
    if ('booking' in result && result.booking) {
      const status = result.status;
      const body: any = {
        id: result.booking.id,
        slotId: result.booking.slotId,
        status: result.booking.status,
        message: status === 202 ? result.message : 'Booking created',
      };
      return res.status(status).json(body);
    }
    return res.status(500).json({ error: 'Internal server error' });
  } catch (e: any) {
    console.error('POST /api/public/bookings', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
