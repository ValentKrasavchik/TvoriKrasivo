# Деплой — Твори Красиво

Инструкция по развёртыванию на VPS (например, 1 CPU, 1 ГБ RAM, 15 ГБ NVMe).

## Что нужно на сервере

- Node.js 18+ (LTS)
- Веб-сервер (nginx или аналог) для статики и прокси к API
- (Опционально) swap 512 МБ–1 ГБ при 1 ГБ RAM

## 1. Клонирование и сборка

```bash
cd /var/www/gonchar/1

# Backend: зависимости и сборка
cd backend
npm ci --omit=dev
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run build
cd ..

# Admin: сборка статики (лучше собирать локально или на CI и заливать готовый dist)
cd admin
npm ci
npm run build
cd ..
```

На сервере с 1 ГБ RAM сборку админки (`npm run build` в `admin/`) лучше выполнять локально и загружать уже папку `admin/dist`.

## 2. Переменные окружения (backend)

Скопировать `backend/.env.example` в `backend/.env` и задать:

- `DATABASE_URL` — для прода можно оставить SQLite: `file:./prod.db`
- `ADMIN_LOGIN` / `ADMIN_PASSWORD` — надёжные учётные данные
- `JWT_SECRET` — длинная случайная строка
- `CORS_ORIGIN` — домен сайта и админки, например: `https://yourdomain.com,https://admin.yourdomain.com`
- `PORT` — порт API (например, 3001)

## 3. Systemd (backend)

Файл юнита уже в репозитории: `backend/tvori-krasivo-backend.service`.

Установка:

```bash
sudo cp /var/www/gonchar/1/backend/tvori-krasivo-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable tvori-krasivo-backend
sudo systemctl start tvori-krasivo-backend
sudo systemctl status tvori-krasivo-backend
```

Если Node установлен через nvm, в юните раскомментировать `Environment=PATH=...` и указать путь к `node`.

## 4. Nginx (пример)

- Сайт и админка — статика из корня проекта и из `admin/dist`.
- API — прокси на `http://127.0.0.1:3001`.

Пример конфига (замените `yourdomain.com` и пути при необходимости):

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/gonchar/1;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /admin {
        alias /var/www/gonchar/1/admin/dist;
        try_files $uri $uri/ /admin/index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

После правок: `sudo nginx -t && sudo systemctl reload nginx`.

## 5. Чеклист перед запуском

- [ ] В `backend/.env` заданы `ADMIN_LOGIN`, `ADMIN_PASSWORD`, `JWT_SECRET`, `CORS_ORIGIN`
- [ ] Выполнены `prisma migrate deploy` и `prisma db seed`
- [ ] Backend собран (`npm run build` в `backend/`) и запускается через systemd
- [ ] В корне лежит актуальный `data/workshops.json` (мастер-классы, FAQ, контакты)
- [ ] Админка собрана, содержимое `admin/dist` отдаётся по `/admin`
- [ ] На сайте в production не задаётся `window.API_BASE` — запросы идут на тот же домен по `/api`

## 6. Обновление после деплоя

```bash
cd /var/www/gonchar/1
git pull

cd backend
npm ci --omit=dev
npx prisma migrate deploy
npm run build
sudo systemctl restart tvori-krasivo-backend

# Если обновляли админку — пересобрать и залить admin/dist
cd ../admin && npm ci && npm run build
```
