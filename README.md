# Твори Красиво — Сайт и система записи

Проект состоит из:
- **Корень** — клиентский сайт (статический HTML/CSS/JS), модалка записи обращается к API
- **backend** — Node.js (Express + TypeScript), Prisma, SQLite
- **admin** — админка (React + Vite + Tailwind) на порту 5173

## Быстрый старт

### 1. Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

API: **http://localhost:3001**  
- `GET /api/health` → `{ ok: true }`
- Логин админа: из `.env` (`ADMIN_LOGIN`, `ADMIN_PASSWORD`)

### 2. Админка

```bash
cd admin
npm install
npm run dev
```

Админка: **http://localhost:5173**  
- Логин → Календарь слотов, холд дат, Записи (подтверждение/отмена)

### 3. Клиентский сайт

Откройте `index.html` через любой веб-сервер (или Live Server в VS Code).  
Чтобы форма записи ходила на API, укажите базовый URL API:

- Если сайт и API на одном домене (прокси `/api` на бэкенд) — ничего не настраивать.
- Для локальной разработки добавьте перед подключением `js/main.js` в `index.html`:

```html
<script>window.API_BASE = 'http://localhost:3001';</script>
```

И добавьте `http://localhost:3000` (или порт вашего сайта) в `CORS_ORIGIN` в `backend/.env`.

## Рекомендации из ТЗ

- **Антиспам:** rate limit на `POST /bookings`, honeypot в форме (уже есть)
- **Валидации:** participants не больше свободных мест, телефон нормализуется (уже есть)
- **Логи/аудит:** при желании добавить таблицу аудита и логирование hold/cancel
- **Уведомления:** опционально — Telegram/email после брони
- **Экспорт:** CSV выгрузка записей за период — можно добавить эндпоинт `GET /api/admin/bookings/export?dateFrom=&dateTo=` и кнопку в админке

## Структура

- `backend/prisma/schema.prisma` — модели Slot, Booking, DateHold
- `backend/src/routes/public.ts` — слоты и брони (публичные)
- `backend/src/routes/admin.ts` — логин, слоты, брони, холды дат
- `admin/src/pages/Calendar.tsx` — календарь слотов + холд дат
- `admin/src/pages/Bookings.tsx` — таблица записей
- `js/main.js` — загрузка слотов с API, отправка формы брони
