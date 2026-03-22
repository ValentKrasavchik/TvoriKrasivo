# Задача для Cursor: полный деплой на новый сервер (https://tvori-krasivo.ru/)

Скопируйте блок ниже в чат Cursor на **новом VPS** (или в агент с SSH-доступом к нему). Цель — развернуть актуальную версию из `main`, как в [DEPLOY.md](DEPLOY.md).

---

## Промпт для агента (вставить целиком)

```
Контекст: деплой проекта TvoriKrasivo на чистый Linux VPS. Домен продакшена: https://tvori-krasivo.ru/ (и при необходимости www). Репозиторий: git@github.com:ValentKrasavchik/TvoriKrasivo.git, ветка main.

Сделай по шагам:

1) Подготовка сервера
   - Установи Node.js 18+ LTS, nginx, git, certbot (если ещё нет). При ~1 ГБ RAM добавь swap 512М–1Г по необходимости.
   - Выбери один каталог APP_ROOT для всего (например /var/www/TvoriKrasivo) — один и тот же путь в nginx root/alias, systemd WorkingDirectory и в git.

2) Код
   - Клонируй репозиторий в APP_ROOT, переключись на main, git pull.
   - Не смешивай с другими клонами на этом же сервере — у прод-домена должен быть один источник правды.

3) Backend
   - В backend скопируй .env.example → .env и заполни:
     DATABASE_URL (для SQLite на проде обычно file:./prod.db),
     ADMIN_LOGIN, ADMIN_PASSWORD, JWT_SECRET (сильные значения),
     CORS_ORIGIN=https://tvori-krasivo.ru,https://www.tvori-krasivo.ru
     PORT=3001
   - Если переносишь данные со старого сервера: скопируй файл SQLite (например backend/prod.db) до migrate; иначе после первого деплоя будет пустая БД — тогда выполни prisma migrate deploy и prisma db seed.
   - В каталоге backend: npm ci, npx prisma generate, npx prisma migrate deploy, при необходимости npx prisma db seed, npm run build.
   - Установи systemd-юнит из backend/tvori-krasivo-backend.service: поправь пути под APP_ROOT и путь к node (если nvm — раскомментируй Environment PATH), скопируй в /etc/systemd/system/, daemon-reload, enable, start, проверь status и curl http://127.0.0.1:3001/api/health.

4) Nginx + TLS
   - Скопируй nginx-tvori-krasivo.conf из репозитория в sites-available, подставь APP_ROOT в root и alias для admin/dist, проверь nginx -t.
   - Убедись, что DNS A/AAAA для tvori-krasivo.ru (и www) указывают на этот сервер, затем certbot --nginx -d tvori-krasivo.ru -d www.tvori-krasivo.ru (или certonly + пропиши ssl пути).
   - reload nginx.

5) Клиентский сайт и админка
   - В корне репозитория должен быть актуальный статический сайт (index.html, js/, css/, data/workshops.json и т.д.).
   - Для админки: в admin создай .env.production с VITE_API_BASE= (пусто, чтобы API шло на тот же хост через /api).
   - cd admin && npm ci && npm run build. Убедись, что admin/dist отдаётся по /admin/ как в примере nginx.

6) Проверки
   - https://tvori-krasivo.ru/ открывается, форма записи работает (слоты и POST брони).
   - https://tvori-krasivo.ru/admin/ — логин админки.
   - В index.html не должен быть зашит чужой API_BASE на старый сервер (для этого домена — пустой window.API_BASE, запросы на /api).

7) После переключения DNS со старого сервера
   - На старом сервере можно остановить nginx/backend или оставить как бэкап, но DNS должен вести только на новый VPS.

Подробные команды и чеклист — в файле DEPLOY.md в корне репозитория. Не выводи секреты из .env в логи.
```

---

## Кратко для человека

| Шаг | Действие |
|-----|----------|
| DNS | A/AAAA `tvori-krasivo.ru` (и `www`) → IP **нового** VPS |
| Код | `git clone` → `main` в единый `APP_ROOT` |
| Секреты | `backend/.env` — не коммитить; перенести со старого сервера или создать новые |
| БД | Скопировать `prod.db` **или** чистый `migrate deploy` + `seed` |
| Сборка | `backend`: `npm ci` → prisma → `build`; `admin`: `VITE_API_BASE=` → `npm run build` |
| Процессы | systemd для API, nginx для статики и `/api` → `127.0.0.1:3001` |

Полная процедура обновления без смены сервера — раздел 6 в [DEPLOY.md](DEPLOY.md).
