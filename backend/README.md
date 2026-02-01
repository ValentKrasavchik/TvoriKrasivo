# Backend — Твори Красиво

API для записи на мастер-классы и админки.

## Запуск

```bash
# Установка зависимостей
npm install

# База: миграции и сидер
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed

# Запуск API на http://localhost:3001
npm run dev
```

## Переменные (.env)

- `DATABASE_URL` — строка подключения (SQLite: `file:./dev.db`)
- `ADMIN_LOGIN` / `ADMIN_PASSWORD` — логин/пароль админа
- `JWT_SECRET` — секрет для JWT
- `CORS_ORIGIN` — разрешённые домены через запятую
- `PORT` — порт (по умолчанию 3001)

## Эндпоинты

- `GET /api/health` — `{ ok: true }`
- `GET /api/public/slots?workshopId=w1&dateFrom=...&dateTo=...` — список слотов
- `POST /api/public/bookings` — создание брони (body: slotId, name, phone, messenger, participants?, comment?, honeypot?)
- `POST /api/admin/login` — логин (body: login, password) → JWT
- `GET /api/admin/me` — текущий админ (нужен заголовок `Authorization: Bearer <token>`)
- `GET/POST/PATCH/DELETE /api/admin/slots` — CRUD слотов
- `GET /api/admin/bookings` — список броней (query: dateFrom, dateTo, workshopId, status)
- `PATCH /api/admin/bookings/:id/confirm` — подтвердить бронь
- `PATCH /api/admin/bookings/:id/cancel` — отменить бронь (места возвращаются в слот)

## Антиспам

- Rate limit на все запросы (100/мин) и отдельно на `POST /api/public/bookings` (10 за 15 мин).
- В форме брони можно передать скрытое поле `honeypot`; если оно заполнено, запрос отклоняется.
