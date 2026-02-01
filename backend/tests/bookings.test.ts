import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';

const validBookingPayload = (slotId: string, participants = 1) => ({
  slotId,
  name: 'Test User',
  phone: '+7 999 123-45-67',
  messenger: 'Telegram',
  participants,
  comment: null,
});

async function getAdminToken(): Promise<string> {
  const res = await request(app)
    .post('/api/admin/login')
    .send({ login: process.env.ADMIN_LOGIN || 'admin', password: process.env.ADMIN_PASSWORD || 'change_me' });
  expect(res.status).toBe(200);
  return res.body.token;
}

async function getSlotId(workshopId: string, date: string): Promise<string> {
  const res = await request(app)
    .get('/api/public/slots')
    .query({ workshopId, dateFrom: date, dateTo: date });
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body.length).toBeGreaterThan(0);
  return res.body[0].id;
}

describe('Public bookings API', () => {
  let slotW1: string;
  let slotW2: string; // capacity 2

  beforeAll(async () => {
    slotW1 = await getSlotId('w1', '2026-02-01');
    slotW2 = await getSlotId('w2', '2026-02-01');
  });

  it('GET /api/public/slots returns slots with freeSeats', async () => {
    const res = await request(app)
      .get('/api/public/slots')
      .query({ workshopId: 'w1', dateFrom: '2026-02-01', dateTo: '2026-02-01' });
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    const slot = res.body[0];
    expect(slot).toHaveProperty('freeSeats');
    expect(slot).toHaveProperty('capacityTotal', 6);
    expect(slot).toHaveProperty('capacityBooked');
    expect(slot).toHaveProperty('heldSeats');
  });

  it('booking with enough seats: capacity 6, book 2 → free=4', async () => {
    const res = await request(app)
      .post('/api/public/bookings')
      .send(validBookingPayload(slotW1, 2));
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('CONFIRMED');

    const slotsRes = await request(app)
      .get('/api/public/slots')
      .query({ workshopId: 'w1', dateFrom: '2026-02-01', dateTo: '2026-02-01' });
    const slot = slotsRes.body.find((s: { id: string }) => s.id === slotW1);
    expect(slot).toBeDefined();
    expect(slot.capacityBooked).toBe(2);
    expect(slot.freeSeats).toBe(4);
  });

  it('overflow: free=2 (w2 capacity 2), participants=5 → PENDING_ADMIN + SeatHold', async () => {
    const res = await request(app)
      .post('/api/public/bookings')
      .send(validBookingPayload(slotW2, 5));
    expect(res.status).toBe(202);
    expect(res.body.status).toBe('PENDING_ADMIN');
    expect(res.body.message).toBeDefined();

    const hold = await prisma.seatHold.findFirst({
      where: { slotId: slotW2, status: 'ACTIVE' },
    });
    expect(hold).toBeDefined();
    expect(hold!.participantsHeld).toBe(5);

    const slotsRes = await request(app)
      .get('/api/public/slots')
      .query({ workshopId: 'w2', dateFrom: '2026-02-01', dateTo: '2026-02-01' });
    const slot = slotsRes.body.find((s: { id: string }) => s.id === slotW2);
    expect(slot).toBeDefined();
    expect(slot.heldSeats).toBe(5);
    expect(slot.freeSeats).toBe(0);
  });

  it('HELD slot rejects booking with 409', async () => {
    const token = await getAdminToken();
    const slotId = await getSlotId('w1', '2026-02-02');
    await request(app)
      .post('/api/admin/slots/' + slotId + '/hold')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);

    const res = await request(app)
      .post('/api/public/bookings')
      .send(validBookingPayload(slotId, 1));
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('not available');

    await request(app)
      .post('/api/admin/slots/' + slotId + '/unhold')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
  });

  it('booking with comment is saved and returned in admin list', async () => {
    const slotId = await getSlotId('w1', '2026-02-08');
    const payload = { ...validBookingPayload(slotId, 1), comment: 'Хочу торт на стол' };
    const res = await request(app)
      .post('/api/public/bookings')
      .send(payload);
    expect(res.status).toBe(201);
    const bookingId = res.body.id;

    const token = await getAdminToken();
    const listRes = await request(app)
      .get('/api/admin/bookings')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    const booking = listRes.body.find((b: { id: string }) => b.id === bookingId);
    expect(booking).toBeDefined();
    expect(booking).toHaveProperty('comment', 'Хочу торт на стол');
  });

  it('cancel confirmed booking returns seats', async () => {
    const slotId = await getSlotId('w1', '2026-02-08');
    const bookRes = await request(app)
      .post('/api/public/bookings')
      .send(validBookingPayload(slotId, 3));
    expect(bookRes.status).toBe(201);
    const bookingId = bookRes.body.id;

    let slotsRes = await request(app)
      .get('/api/public/slots')
      .query({ workshopId: 'w1', dateFrom: '2026-02-08', dateTo: '2026-02-08' });
    let slot = slotsRes.body.find((s: { id: string }) => s.id === slotId);
    const bookedBeforeCancel = slot.capacityBooked;
    const freeBeforeCancel = slot.freeSeats;

    const token = await getAdminToken();
    await request(app)
      .patch('/api/admin/bookings/' + bookingId + '/cancel')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);

    slotsRes = await request(app)
      .get('/api/public/slots')
      .query({ workshopId: 'w1', dateFrom: '2026-02-08', dateTo: '2026-02-08' });
    slot = slotsRes.body.find((s: { id: string }) => s.id === slotId);
    expect(slot.capacityBooked).toBe(bookedBeforeCancel - 3);
    expect(slot.freeSeats).toBe(freeBeforeCancel + 3);
  });
});

describe('Race: two concurrent bookings on same slot', () => {
  it('two requests 4 participants each on capacity 6 → one CONFIRMED, one overflow (202)', async () => {
    const slotId = await getSlotId('w3', '2026-02-09');
    const payload1 = validBookingPayload(slotId, 4);
    const payload2 = { ...validBookingPayload(slotId, 4), phone: '+7 999 111-22-33' };

    const [res1, res2] = await Promise.all([
      request(app).post('/api/public/bookings').send(payload1),
      request(app).post('/api/public/bookings').send(payload2),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect([201, 202]).toEqual(expect.arrayContaining([res1.status, res2.status]));
    const confirmed = res1.status === 201 ? res1.body : res2.body;
    const pending = res1.status === 202 ? res1.body : res2.body;
    expect(confirmed.status).toBe('CONFIRMED');
    expect(pending.status).toBe('PENDING_ADMIN');
  });
});
