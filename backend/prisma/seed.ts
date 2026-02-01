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

  await prisma.review.deleteMany({});
  const reviews = [
    { id: 'r1', name: 'Анна К.', text: 'Прекрасная атмосфера! Никогда не думала, что смогу что-то слепить, а тут сразу получилась красивая тарелка. Мастер всё объясняет понятно и терпеливо.', rating: 5, date: '2026-01-15' },
    { id: 'r2', name: 'Михаил и Ольга', text: 'Были на романтическом мастер-классе — это лучшее свидание! Уютно, тепло, и каждый увёз домой подарок друг другу.', rating: 5, date: '2026-01-10' },
    { id: 'r3', name: 'Екатерина С.', text: 'Подарила сертификат маме — она в восторге! Теперь хочет научиться работать на гончарном круге.', rating: 5, date: '2026-01-08' },
    { id: 'r4', name: 'Дарья М.', text: 'Приводила дочку 8 лет — она слепила котика и была счастлива! Обязательно вернёмся.', rating: 5, date: '2025-12-20' },
    { id: 'r5', name: 'Игорь В.', text: 'Отличный способ отвлечься от рутины. Глина в руках — это медитация! Рекомендую всем.', rating: 5, date: '2025-12-15' },
  ];
  await prisma.review.createMany({ data: reviews });

  await prisma.galleryImage.deleteMany({});
  const galleryImages = [
    { imageUrl: 'images/workshop-1.jpg', alt: 'Декоративная тарелка с надписью', sortOrder: 0 },
    { imageUrl: 'images/workshop-2.jpg', alt: 'Тарелка ручной работы', sortOrder: 1 },
    { imageUrl: 'images/gallery-1.jpg', alt: 'Процесс работы в студии', sortOrder: 2 },
    { imageUrl: 'images/gallery-2.jpg', alt: 'Работа с глиной', sortOrder: 3 },
    { imageUrl: 'images/gallery-3.jpg', alt: 'Керамическое изделие в форме сердца', sortOrder: 4 },
    { imageUrl: 'images/about-studio.jpg', alt: 'Интерьер студии', sortOrder: 5 },
    { imageUrl: 'images/hero.jpg', alt: 'Мастер за работой', sortOrder: 6 },
    { imageUrl: 'images/certificate.jpg', alt: 'Подарочный сертификат', sortOrder: 7 },
  ];
  await prisma.galleryImage.createMany({ data: galleryImages });

  console.log('Seed: workshops, slots, reviews, gallery created');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
