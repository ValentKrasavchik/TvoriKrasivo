import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const workshops = [
    { id: 'w1', title: 'Декоративная тарелка', description: 'Создайте уникальную тарелку с авторским рисунком или надписью.', durationMinutes: 120, capacityPerSlot: 6, result: 'Авторская тарелка диаметром 18-22 см', price: 1800, isActive: true },
    { id: 'w2', title: 'Романтический мастер-класс', description: 'Идеальное свидание! Лепите вместе.', durationMinutes: 150, capacityPerSlot: 2, result: '2 изделия на выбор', price: 3500, isActive: true },
    { id: 'w3', title: 'Лепка на гончарном круге', description: 'Почувствуйте магию гончарного ремесла!', durationMinutes: 120, capacityPerSlot: 4, result: 'Чашка или пиала ручной работы', price: 2200, isActive: true },
    { id: 'w4', title: 'Детский мастер-класс', description: 'Творческое занятие для детей от 6 лет.', durationMinutes: 90, capacityPerSlot: 8, result: 'Фигурка или поделка на выбор', price: 1200, isActive: true },
  ];

  await prisma.seatHold.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.slot.deleteMany({});
  await prisma.workshop.deleteMany({});

  await prisma.workshop.createMany({ data: workshops });

  const slots = [
    { workshopId: 'w1', date: '2026-02-01', time: '12:00', capacity: 6, status: 'OPEN' },
    { workshopId: 'w1', date: '2026-02-01', time: '16:00', capacity: 6, status: 'OPEN' },
    { workshopId: 'w1', date: '2026-02-02', time: '12:00', capacity: 6, status: 'OPEN' },
    { workshopId: 'w1', date: '2026-02-08', time: '12:00', capacity: 6, status: 'OPEN' },
    { workshopId: 'w1', date: '2026-02-08', time: '16:00', capacity: 6, status: 'OPEN' },
    { workshopId: 'w2', date: '2026-02-01', time: '18:00', capacity: 2, status: 'OPEN' },
    { workshopId: 'w2', date: '2026-02-08', time: '18:00', capacity: 2, status: 'OPEN' },
    { workshopId: 'w2', date: '2026-02-14', time: '18:00', capacity: 2, status: 'OPEN' },
    { workshopId: 'w2', date: '2026-02-15', time: '12:00', capacity: 2, status: 'OPEN' },
    { workshopId: 'w3', date: '2026-02-02', time: '14:00', capacity: 4, status: 'OPEN' },
    { workshopId: 'w3', date: '2026-02-09', time: '12:00', capacity: 4, status: 'OPEN' },
    { workshopId: 'w3', date: '2026-02-09', time: '16:00', capacity: 4, status: 'OPEN' },
    { workshopId: 'w3', date: '2026-02-16', time: '14:00', capacity: 4, status: 'OPEN' },
    { workshopId: 'w4', date: '2026-02-02', time: '11:00', capacity: 8, status: 'OPEN' },
    { workshopId: 'w4', date: '2026-02-09', time: '11:00', capacity: 8, status: 'OPEN' },
    { workshopId: 'w4', date: '2026-02-16', time: '11:00', capacity: 8, status: 'OPEN' },
  ];

  await prisma.slot.createMany({ data: slots });
  console.log('Seed: workshops w1–w4 and slots created');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
