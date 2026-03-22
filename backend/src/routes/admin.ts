import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { requireAdmin } from '../middleware/requireAdmin';
import { prisma } from '../lib/prisma';
import { getSlotsWithAvailability } from '../lib/slotAvailability';
import { normalizePhone } from '../lib/validation';
import { isAllowedContactHref, isAllowedContactIconKey, isAllowedCustomIconUrl } from '../lib/contactBlocks';

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = (file.originalname && path.extname(file.originalname)) || '.jpg';
    cb(null, `w-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change_me';

const adminRouter = Router();

adminRouter.post('/login', (req: Request, res: Response) => {
  const { login, password } = req.body || {};
  if (login !== ADMIN_LOGIN || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid login or password' });
  }
  const token = jwt.sign({ sub: login, login }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, login });
});

adminRouter.use(requireAdmin);

adminRouter.get('/me', (req: Request, res: Response) => {
  res.json({ login: (req as any).admin?.login ?? 'admin' });
});

// --- Upload image (for workshop etc.) ---
adminRouter.post('/upload', upload.single('image'), (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = '/api/uploads/' + req.file.filename;
    res.json({ url });
  } catch (e) {
    console.error('POST /api/admin/upload', e);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// --- Workshops CRUD ---
adminRouter.get('/workshops', async (_req: Request, res: Response) => {
  try {
    const list = await prisma.workshop.findMany({ orderBy: { title: 'asc' } });
    res.json(list);
  } catch (e) {
    console.error('GET /api/admin/workshops', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.get('/workshops/:id', async (req: Request, res: Response) => {
  try {
    const w = await prisma.workshop.findUnique({ where: { id: req.params.id } });
    if (!w) return res.status(404).json({ error: 'Workshop not found' });
    res.json(w);
  } catch (e) {
    console.error('GET /api/admin/workshops/:id', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.post('/workshops', async (req: Request, res: Response) => {
  try {
    const { title, description, durationMinutes, capacityPerSlot, result, price, isActive, imageUrl } = req.body || {};
    if (!title || durationMinutes == null || capacityPerSlot == null || price == null) {
      return res.status(400).json({ error: 'title, durationMinutes, capacityPerSlot, price required' });
    }
    const w = await prisma.workshop.create({
      data: {
        title: String(title),
        description: String(description ?? ''),
        durationMinutes: Math.max(1, parseInt(String(durationMinutes), 10) || 120),
        capacityPerSlot: Math.max(1, parseInt(String(capacityPerSlot), 10) || 6),
        result: String(result ?? ''),
        price: Math.max(0, parseInt(String(price), 10) || 0),
        imageUrl: imageUrl != null && imageUrl !== '' ? String(imageUrl) : null,
        isActive: isActive !== false,
      },
    });
    res.status(201).json(w);
  } catch (e) {
    console.error('POST /api/admin/workshops', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.patch('/workshops/:id', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const data: any = {};

    if (body.title !== undefined) data.title = String(body.title);
    if (body.description !== undefined) data.description = String(body.description);

    // durationMinutes: игнорируем пустую строку, валидируем число
    if (body.durationMinutes !== undefined && body.durationMinutes !== '') {
      const parsed = parseInt(String(body.durationMinutes), 10);
      if (Number.isNaN(parsed)) {
        return res.status(400).json({ error: 'Invalid durationMinutes' });
      }
      data.durationMinutes = Math.max(1, parsed);
    }

    // capacityPerSlot: игнорируем пустую строку, валидируем число
    if (body.capacityPerSlot !== undefined && body.capacityPerSlot !== '') {
      const parsed = parseInt(String(body.capacityPerSlot), 10);
      if (Number.isNaN(parsed)) {
        return res.status(400).json({ error: 'Invalid capacityPerSlot' });
      }
      data.capacityPerSlot = Math.max(1, parsed);
    }

    if (body.result !== undefined) data.result = String(body.result);

    // price: игнорируем пустую строку, валидируем число
    if (body.price !== undefined && body.price !== '') {
      const parsed = parseInt(String(body.price), 10);
      if (Number.isNaN(parsed)) {
        return res.status(400).json({ error: 'Invalid price' });
      }
      data.price = Math.max(0, parsed);
    }

    if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl === '' ? null : String(body.imageUrl);
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    const w = await prisma.workshop.update({ where: { id: req.params.id }, data });
    res.json(w);
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ error: 'Workshop not found' });
    console.error('PATCH /api/admin/workshops/:id', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.delete('/workshops/:id', async (req: Request, res: Response) => {
  try {
    const workshopId = req.params.id;

    await prisma.$transaction(async (tx) => {
      const slots = await tx.slot.findMany({
        where: { workshopId },
        select: { id: true },
      });
      const slotIds = slots.map((s) => s.id);

      if (slotIds.length > 0) {
        // Порядок важен: сначала холды (ссылаются на slot и booking), потом брони, потом слоты
        await tx.seatHold.deleteMany({ where: { slotId: { in: slotIds } } });
        await tx.booking.deleteMany({ where: { slotId: { in: slotIds } } });
        await tx.slot.deleteMany({ where: { id: { in: slotIds } } });
      }

      await tx.workshop.delete({ where: { id: workshopId } });
    });

    res.status(204).send();
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ error: 'Workshop not found' });
    console.error('DELETE /api/admin/workshops/:id', e?.message ?? e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Reviews CRUD ---
adminRouter.get('/reviews', async (_req: Request, res: Response) => {
  try {
    const list = await prisma.review.findMany({ orderBy: { date: 'desc' } });
    res.json(list);
  } catch (e) {
    console.error('GET /api/admin/reviews', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.post('/reviews', async (req: Request, res: Response) => {
  try {
    const { name, text, rating, date } = req.body || {};
    if (!name || !text) return res.status(400).json({ error: 'name, text required' });
    const r = await prisma.review.create({
      data: {
        name: String(name),
        text: String(text),
        rating: Math.min(5, Math.max(1, parseInt(String(rating), 10) || 5)),
        date: date ? String(date) : new Date().toISOString().slice(0, 10),
      },
    });
    res.status(201).json(r);
  } catch (e) {
    console.error('POST /api/admin/reviews', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.patch('/reviews/:id', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const data: any = {};
    if (body.name !== undefined) data.name = String(body.name);
    if (body.text !== undefined) data.text = String(body.text);
    if (body.rating !== undefined) data.rating = Math.min(5, Math.max(1, parseInt(String(body.rating), 10) || 5));
    if (body.date !== undefined) data.date = String(body.date);
    const r = await prisma.review.update({ where: { id: req.params.id }, data });
    res.json(r);
  } catch (e) {
    console.error('PATCH /api/admin/reviews/:id', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.delete('/reviews/:id', async (req: Request, res: Response) => {
  try {
    await prisma.review.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e) {
    console.error('DELETE /api/admin/reviews/:id', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Gallery ---
adminRouter.get('/gallery', async (_req: Request, res: Response) => {
  try {
    const list = await prisma.galleryImage.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json(list);
  } catch (e) {
    console.error('GET /api/admin/gallery', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.post('/gallery', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const alt = (req.body && (req.body as any).alt) ? String((req.body as any).alt) : null;
    const url = '/api/uploads/' + req.file.filename;
    const maxOrder = await prisma.galleryImage.aggregate({ _max: { sortOrder: true } });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
    const g = await prisma.galleryImage.create({
      data: { imageUrl: url, alt, sortOrder },
    });
    res.status(201).json(g);
  } catch (e) {
    console.error('POST /api/admin/gallery', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.patch('/gallery/:id', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const data: any = {};
    if (body.alt !== undefined) data.alt = body.alt === '' ? null : String(body.alt);
    if (body.comment !== undefined) data.comment = body.comment === '' ? null : String(body.comment);
    if (body.sortOrder !== undefined) data.sortOrder = parseInt(String(body.sortOrder), 10) || 0;
    const g = await prisma.galleryImage.update({ where: { id: req.params.id }, data });
    res.json(g);
  } catch (e) {
    console.error('PATCH /api/admin/gallery/:id', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.delete('/gallery/:id', async (req: Request, res: Response) => {
  try {
    await prisma.galleryImage.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e) {
    console.error('DELETE /api/admin/gallery/:id', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Slots CRUD ---
adminRouter.get('/slots', async (req: Request, res: Response) => {
  try {
    const workshopId = (req.query.workshopId as string) || undefined;
    const dateFrom = (req.query.dateFrom as string) || undefined;
    const dateTo = (req.query.dateTo as string) || undefined;
    const where: any = {};
    if (workshopId) where.workshopId = workshopId;
    if (dateFrom) where.date = { ...where.date, gte: dateFrom };
    if (dateTo) where.date = { ...where.date, lte: dateTo };
    const slots = await prisma.slot.findMany({
      where,
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      include: { workshop: true },
    });
    const withAvailability = await getSlotsWithAvailability(prisma, slots);
    res.json(
      withAvailability.map((s) => ({
        ...s,
        capacityTotal: s.capacity,
        capacityBooked: s.bookedSeats,
        startAt: `${s.date}T${s.time}:00`,
      }))
    );
  } catch (e) {
    console.error('GET /api/admin/slots', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.post('/slots', async (req: Request, res: Response) => {
  try {
    const { workshopId, date, time, capacity, freeze, status, durationMinutes } = req.body || {};
    if (!workshopId || !date || !time) {
      return res.status(400).json({ error: 'workshopId, date, time required' });
    }

    const workshop = await prisma.workshop.findUnique({ where: { id: workshopId } });
    if (!workshop) return res.status(404).json({ error: 'Workshop not found' });

    const cap = capacity != null
      ? Math.max(1, parseInt(String(capacity), 10) || 6)
      : workshop.capacityPerSlot;
    const duration =
      durationMinutes != null
        ? Math.max(1, parseInt(String(durationMinutes), 10) || workshop.durationMinutes)
        : workshop.durationMinutes;

    // Приоритет: freeze -> HELD. Иначе status (если валидный). Иначе OPEN.
    const desiredStatus =
      freeze === true
        ? 'HELD'
        : (['OPEN', 'HELD', 'CANCELLED'].includes(String(status)) ? String(status) : 'OPEN');

    const slot = await prisma.slot.upsert({
      where: {
        workshopId_date_time: { workshopId, date: String(date), time: String(time) },
      },
      update: {
        capacity: cap,
        status: desiredStatus,
        ...(durationMinutes != null ? { durationMinutes: duration } : {}),
      },
      create: {
        workshopId,
        date: String(date),
        time: String(time),
        capacity: cap,
        durationMinutes: duration,
        status: desiredStatus,
      },
    });

    res.status(201).json(slot);
  } catch (e) {
    console.error('POST /api/admin/slots', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.patch('/slots/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const existing = await prisma.slot.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    const data: Record<string, unknown> = {};
    if (body.status !== undefined && ['OPEN', 'HELD', 'CANCELLED'].includes(body.status)) {
      data.status = body.status;
    }
    if (body.capacity !== undefined) {
      const c = parseInt(String(body.capacity), 10);
      data.capacity = Number.isFinite(c) && c >= 1 ? c : 1;
    }
    if (body.durationMinutes !== undefined) {
      const d = parseInt(String(body.durationMinutes), 10);
      data.durationMinutes = Number.isFinite(d) && d >= 1 ? d : 1;
    }

    const wantsWorkshopChange =
      body.workshopId !== undefined && String(body.workshopId) !== existing.workshopId;

    if (wantsWorkshopChange) {
      const newWid = String(body.workshopId);
      const ws = await prisma.workshop.findUnique({ where: { id: newWid } });
      if (!ws) {
        return res.status(404).json({ error: 'Workshop not found' });
      }
      const conflict = await prisma.slot.findFirst({
        where: {
          workshopId: newWid,
          date: existing.date,
          time: existing.time,
          NOT: { id },
        },
      });
      if (conflict) {
        return res.status(409).json({
          error: 'Уже есть слот этого мастер-класса на это время',
        });
      }
      data.workshopId = newWid;
      await prisma.$transaction(async (tx) => {
        await tx.slot.update({ where: { id }, data });
        await tx.booking.updateMany({
          where: { slotId: id },
          data: { workshopId: newWid },
        });
      });
      const slot = await prisma.slot.findUnique({ where: { id } });
      return res.json(slot);
    }

    const slot = await prisma.slot.update({ where: { id }, data });
    res.json(slot);
  } catch (e) {
    console.error('PATCH /api/admin/slots/:id', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.post('/slots/:id/hold', async (req: Request, res: Response) => {
  try {
    const slot = await prisma.slot.update({
      where: { id: req.params.id },
      data: { status: 'HELD' },
    });
    res.json(slot);
  } catch (e) {
    console.error('POST /api/admin/slots/:id/hold', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.post('/slots/:id/unhold', async (req: Request, res: Response) => {
  try {
    const slot = await prisma.slot.update({
      where: { id: req.params.id },
      data: { status: 'OPEN' },
    });
    res.json(slot);
  } catch (e) {
    console.error('POST /api/admin/slots/:id/unhold', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.delete('/slots/:id', async (req: Request, res: Response) => {
  try {
    // Delete in transaction: first delete related bookings and seat holds, then the slot
    await prisma.$transaction(async (tx) => {
      const { id } = req.params;
      
      // Delete all bookings for this slot
      await tx.booking.deleteMany({ where: { slotId: id } });
      
      // Delete all seat holds for this slot
      await tx.seatHold.deleteMany({ where: { slotId: id } });
      
      // Now delete the slot itself
      await tx.slot.delete({ where: { id } });
    });
    
    res.status(204).send();
  } catch (e) {
    console.error('DELETE /api/admin/slots/:id', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Bookings ---
adminRouter.get('/bookings', async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo, workshopId, status } = req.query as Record<string, string>;
    const where: any = {};
    if (status) where.status = status;
    if (workshopId || dateFrom || dateTo) {
      where.slot = {};
      if (workshopId) where.slot.workshopId = workshopId;
      if (dateFrom) where.slot.date = { ...where.slot.date, gte: dateFrom };
      if (dateTo) where.slot.date = { ...where.slot.date, lte: dateTo };
    }
    const bookings = await prisma.booking.findMany({
      where,
      include: { slot: true, seatHold: true },
      orderBy: [{ createdAt: 'desc' }],
    });
    res.json(bookings);
  } catch (e) {
    console.error('GET /api/admin/bookings', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.post('/bookings/:id/approve', async (req: Request, res: Response) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: req.params.id },
        include: { slot: true, seatHold: true },
      });
      if (!booking) throw new Error('NOT_FOUND');
      if (booking.status !== 'PENDING_ADMIN') {
        return { booking };
      }
      await tx.booking.update({
        where: { id: req.params.id },
        data: { status: 'CONFIRMED' },
      });
      const hold = await tx.seatHold.findFirst({ where: { bookingId: req.params.id } });
      if (hold) {
        await tx.seatHold.update({
          where: { id: hold.id },
          data: { status: 'RELEASED' },
        });
      }
      const updated = await tx.booking.findUnique({
        where: { id: req.params.id },
        include: { slot: true },
      });
      return { booking: updated! };
    });
    res.json(result.booking);
  } catch (e: any) {
    if (e.message === 'NOT_FOUND') return res.status(404).json({ error: 'Booking not found' });
    console.error('POST /api/admin/bookings/:id/approve', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.post('/bookings/:id/reject', async (req: Request, res: Response) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: req.params.id },
        include: { seatHold: true },
      });
      if (!booking) throw new Error('NOT_FOUND');
      await tx.booking.update({
        where: { id: req.params.id },
        data: { status: 'REJECTED' },
      });
      const hold = await tx.seatHold.findFirst({ where: { bookingId: req.params.id } });
      if (hold) {
        await tx.seatHold.update({
          where: { id: hold.id },
          data: { status: 'RELEASED' },
        });
      }
      const updated = await tx.booking.findUnique({
        where: { id: req.params.id },
        include: { slot: true },
      });
      return { booking: updated! };
    });
    res.json(result.booking);
  } catch (e: any) {
    if (e.message === 'NOT_FOUND') return res.status(404).json({ error: 'Booking not found' });
    console.error('POST /api/admin/bookings/:id/reject', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.patch('/bookings/:id/confirm', async (req: Request, res: Response) => {
  try {
    const booking = await prisma.booking.update({
      where: { id: req.params.id },
      data: { status: 'CONFIRMED' },
    });
    res.json(booking);
  } catch (e) {
    console.error('PATCH /api/admin/bookings/:id/confirm', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.patch('/bookings/:id/cancel', async (req: Request, res: Response) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: req.params.id },
        include: { slot: true, seatHold: true },
      });
      if (!booking) throw new Error('NOT_FOUND');
      if (booking.status === 'CANCELLED') return { booking };
      await tx.booking.update({
        where: { id: req.params.id },
        data: { status: 'CANCELLED' },
      });
      const hold = await tx.seatHold.findFirst({ where: { bookingId: req.params.id } });
      if (hold) {
        await tx.seatHold.update({
          where: { id: hold.id },
          data: { status: 'RELEASED' },
        });
      }
      const updated = await tx.booking.findUnique({
        where: { id: req.params.id },
        include: { slot: true },
      });
      return { booking: updated! };
    });
    res.json(result.booking);
  } catch (e: any) {
    if (e.message === 'NOT_FOUND') return res.status(404).json({ error: 'Booking not found' });
    console.error('PATCH /api/admin/bookings/:id/cancel', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.delete('/bookings/:id', async (req: Request, res: Response) => {
  try {
    await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: req.params.id },
        include: { seatHold: true },
      });
      if (!booking) throw new Error('NOT_FOUND');
      const hold = await tx.seatHold.findFirst({ where: { bookingId: req.params.id } });
      if (hold) {
        await tx.seatHold.update({
          where: { id: hold.id },
          data: { status: 'RELEASED' },
        });
      }
      await tx.booking.delete({ where: { id: req.params.id } });
    });
    res.status(204).send();
  } catch (e: any) {
    if (e.message === 'NOT_FOUND') return res.status(404).json({ error: 'Booking not found' });
    console.error('DELETE /api/admin/bookings/:id', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Requests for new workshop slot ---
adminRouter.get('/workshop-requests', async (_req: Request, res: Response) => {
  try {
    const list = await prisma.workshopRequest.findMany({
      include: {
        workshop: true,
        confirmedSlot: true,
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(list);
  } catch (e) {
    console.error('GET /api/admin/workshop-requests', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.patch('/workshop-requests/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const body = req.body || {};
    const existing = await prisma.workshopRequest.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Request not found' });
    if (existing.status !== 'NEW') return res.status(409).json({ error: 'Можно редактировать только новые заявки' });

    const data: any = {};
    const nextWorkshopId = body.workshopId !== undefined ? String(body.workshopId) : existing.workshopId;
    const nextDate = body.date !== undefined ? String(body.date) : existing.date;
    const nextTime = body.time !== undefined ? String(body.time) : existing.time;

    if (body.workshopId !== undefined) {
      const ws = await prisma.workshop.findUnique({ where: { id: nextWorkshopId } });
      if (!ws) return res.status(404).json({ error: 'Workshop not found' });
      data.workshopId = nextWorkshopId;
    }

    if (body.date !== undefined) data.date = nextDate;
    if (body.time !== undefined) data.time = nextTime;
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.messenger !== undefined) data.messenger = String(body.messenger).trim();
    if (body.comment !== undefined) data.comment = body.comment ? String(body.comment).trim() : null;
    if (body.participants !== undefined) data.participants = Math.max(1, parseInt(String(body.participants), 10) || 1);
    if (body.phone !== undefined) {
      const normalized = normalizePhone(String(body.phone));
      if (!normalized) return res.status(400).json({ error: 'Invalid phone number' });
      data.phone = normalized;
    }

    if (nextDate !== existing.date || nextTime !== existing.time) {
      const slotConflict = await prisma.slot.findFirst({
        where: { date: nextDate, time: nextTime },
        select: { id: true },
      });
      if (slotConflict) {
        return res.status(409).json({ error: 'На эту дату и время уже есть мастер-класс' });
      }
    }

    const updated = await prisma.workshopRequest.update({
      where: { id },
      data,
      include: { workshop: true, confirmedSlot: true },
    });
    res.json(updated);
  } catch (e) {
    console.error('PATCH /api/admin/workshop-requests/:id', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.delete('/workshop-requests/:id', async (req: Request, res: Response) => {
  try {
    await prisma.workshopRequest.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ error: 'Request not found' });
    console.error('DELETE /api/admin/workshop-requests/:id', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Контакты (блоки на сайте) ---
adminRouter.get('/contacts', async (_req: Request, res: Response) => {
  try {
    const list = await prisma.contactBlock.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json({
      blocks: list.map((b) => ({
        id: b.id,
        sortOrder: b.sortOrder,
        blockType: b.blockType,
        label: b.label,
        value: b.value ?? null,
        href: b.href ?? null,
        variant: b.variant ?? null,
        iconKey: b.iconKey,
        customIconUrl: b.customIconUrl ?? null,
      })),
    });
  } catch (e) {
    console.error('GET /api/admin/contacts', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.put('/contacts', async (req: Request, res: Response) => {
  try {
    const raw = req.body?.blocks;
    if (!Array.isArray(raw)) {
      return res.status(400).json({ error: 'Ожидается массив blocks' });
    }
    if (raw.length > 40) {
      return res.status(400).json({ error: 'Не более 40 блоков' });
    }

    const normalized: Array<{
      sortOrder: number;
      blockType: string;
      label: string;
      value: string | null;
      href: string | null;
      variant: string | null;
      iconKey: string;
      customIconUrl: string | null;
    }> = [];

    for (let i = 0; i < raw.length; i++) {
      const b = raw[i] || {};
      const blockType = String(b.blockType || '').toUpperCase();
      if (blockType !== 'FIELD' && blockType !== 'BUTTON') {
        return res.status(400).json({ error: `Блок ${i + 1}: неверный тип (FIELD или BUTTON)` });
      }
      const label = String(b.label ?? '').trim();
      if (!label || label.length > 200) {
        return res.status(400).json({ error: `Блок ${i + 1}: укажите заголовок (до 200 символов)` });
      }
      const iconKey = String(b.iconKey ?? '').trim();
      if (!isAllowedContactIconKey(iconKey)) {
        return res.status(400).json({ error: `Блок ${i + 1}: неизвестная иконка` });
      }
      let customIconUrl: string | null = null;
      if (iconKey === 'custom') {
        const u = String(b.customIconUrl ?? '').trim();
        if (!isAllowedCustomIconUrl(u)) {
          return res.status(400).json({
            error: `Блок ${i + 1}: для «Своя иконка» загрузите файл изображения`,
          });
        }
        customIconUrl = u;
      }

      if (blockType === 'FIELD') {
        const value = b.value != null ? String(b.value) : '';
        if (value.length > 4000) {
          return res.status(400).json({ error: `Блок ${i + 1}: текст слишком длинный` });
        }
        normalized.push({
          sortOrder: i,
          blockType: 'FIELD',
          label,
          value,
          href: null,
          variant: null,
          iconKey,
          customIconUrl,
        });
      } else {
        const href = String(b.href ?? '').trim();
        if (!isAllowedContactHref(href)) {
          return res.status(400).json({
            error: `Блок ${i + 1}: укажите корректную ссылку (https://, http://, tel: или mailto:)`,
          });
        }
        const variantRaw = String(b.variant ?? 'primary').toLowerCase();
        const variant = variantRaw === 'secondary' ? 'secondary' : 'primary';
        normalized.push({
          sortOrder: i,
          blockType: 'BUTTON',
          label,
          value: null,
          href,
          variant,
          iconKey,
          customIconUrl,
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.contactBlock.deleteMany();
      if (normalized.length) {
        await tx.contactBlock.createMany({
          data: normalized.map((n) => ({
            sortOrder: n.sortOrder,
            blockType: n.blockType,
            label: n.label,
            value: n.value,
            href: n.href,
            variant: n.variant,
            iconKey: n.iconKey,
            customIconUrl: n.customIconUrl,
          })),
        });
      }
    });

    const list = await prisma.contactBlock.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json({
      blocks: list.map((b) => ({
        id: b.id,
        sortOrder: b.sortOrder,
        blockType: b.blockType,
        label: b.label,
        value: b.value ?? null,
        href: b.href ?? null,
        variant: b.variant ?? null,
        iconKey: b.iconKey,
        customIconUrl: b.customIconUrl ?? null,
      })),
    });
  } catch (e) {
    console.error('PUT /api/admin/contacts', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.post('/workshop-requests/:id/confirm', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await prisma.$transaction(async (tx) => {
      const request = await tx.workshopRequest.findUnique({
        where: { id },
        include: { workshop: true },
      });
      if (!request) throw new Error('NOT_FOUND');
      if (request.status !== 'NEW') throw new Error('NOT_NEW');

      const conflict = await tx.slot.findFirst({
        where: { date: request.date, time: request.time },
        select: { id: true },
      });
      if (conflict) throw new Error('SLOT_CONFLICT');

      const createdSlot = await tx.slot.create({
        data: {
          workshopId: request.workshopId,
          date: request.date,
          time: request.time,
          capacity: request.workshop.capacityPerSlot,
          durationMinutes: request.workshop.durationMinutes,
          status: 'OPEN',
        },
      });

      const updatedRequest = await tx.workshopRequest.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
          confirmedSlotId: createdSlot.id,
        },
        include: { workshop: true, confirmedSlot: true },
      });
      return updatedRequest;
    });
    res.json(result);
  } catch (e: any) {
    if (e?.message === 'NOT_FOUND') return res.status(404).json({ error: 'Request not found' });
    if (e?.message === 'NOT_NEW') return res.status(409).json({ error: 'Заявка уже обработана' });
    if (e?.message === 'SLOT_CONFLICT') return res.status(409).json({ error: 'На эту дату и время уже есть мастер-класс' });
    console.error('POST /api/admin/workshop-requests/:id/confirm', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { adminRouter };
