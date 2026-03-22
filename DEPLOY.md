# Деплой — Твори Красиво

Инструкция по развёртыванию на VPS (например, 1 CPU, 1 ГБ RAM, 15 ГБ NVMe).

**Каталог проекта на сервере** дальше: `APP_ROOT` — по умолчанию **`/var/www/TvoriKrasivo`**. На уже настроенных машинах может быть **`/var/www/gonchar/1`**: это нормально, главное — **один и тот же путь** в `git`, **nginx** (`root` / `alias`) и **systemd** (`WorkingDirectory`, `ExecStart`). Если деплоите в `TvoriKrasivo`, а nginx отдаёт файлы из `gonchar/1` (или наоборот), в браузере будет **старая** вёрстка и логика.

**Публичный сайт в продакшене** должен открываться по корню домена: **[https://tvori-krasivo.ru/](https://tvori-krasivo.ru/)** (без обязательного префикса вроде `/gonchar/1/`). Nginx и `CORS_ORIGIN` настройте под этот хост и HTTPS.

## Что нужно на сервере

- Node.js 18+ (LTS)
- Веб-сервер (nginx или аналог) для статики и прокси к API
- (Опционально) swap 512 МБ–1 ГБ при 1 ГБ RAM

## 1. Клонирование и сборка

```bash
cd /var/www/TvoriKrasivo

# Backend: зависимости и сборка
cd backend
npm ci
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

Для `npm run build` в backend нужны TypeScript и Prisma CLI из devDependencies — используйте **`npm ci` без `--omit=dev`**. Сборку админки на сервере с 1 ГБ RAM можно перенести на другую машину и залить только `admin/dist` (см. ниже).

## 2. Переменные окружения (backend)

Скопировать `backend/.env.example` в `backend/.env` и задать:

- `DATABASE_URL` — для прода можно оставить SQLite: `file:./prod.db`
- `ADMIN_LOGIN` / `ADMIN_PASSWORD` — надёжные учётные данные
- `JWT_SECRET` — длинная случайная строка
- `CORS_ORIGIN` — домен сайта и админки; для основного сайта: `https://tvori-krasivo.ru` (при отдельном поддомене админки добавьте его через запятую)
- `PORT` — порт API (например, 3001)

## 3. Systemd (backend)

Файл юнита в репозитории: `backend/tvori-krasivo-backend.service`. **Пути внутри файла должны совпадать с вашим `APP_ROOT`** (при необходимости отредактируйте `WorkingDirectory` и `ExecStart` перед копированием).

```bash
sudo cp /var/www/TvoriKrasivo/backend/tvori-krasivo-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable tvori-krasivo-backend
sudo systemctl start tvori-krasivo-backend
sudo systemctl status tvori-krasivo-backend
```

Если Node установлен через nvm, раскомментируйте `Environment=PATH=...` и укажите путь к `node`.

## 4. Nginx (пример)

- Сайт и админка — статика из корня проекта и из `admin/dist`.
- API — прокси на `http://127.0.0.1:3001`.
- Для продакшена `server_name` и SSL обычно завязаны на **tvori-krasivo.ru**, чтобы главная открывалась как **https://tvori-krasivo.ru/**.

Пример (замените **`APP_ROOT`**; для прода укажите `server_name tvori-krasivo.ru` и отдельный `server` с `listen 443 ssl`):

```nginx
server {
    listen 80;
    server_name tvori-krasivo.ru;
    root /var/www/TvoriKrasivo;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /admin {
        alias /var/www/TvoriKrasivo/admin/dist;
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

    # Если админка собрана с префиксом (запросы вида /gonchar/1/api/...), без этого блока
    # GET может работать из кэша, а PATCH вернёт HTML:
    location /gonchar/1/api/ {
        proxy_pass http://127.0.0.1:3001/api/;
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

- [ ] Сайт доступен по **https://tvori-krasivo.ru/** (статика с корня, API через `/api` на том же хосте)
- [ ] В `backend/.env` заданы `ADMIN_LOGIN`, `ADMIN_PASSWORD`, `JWT_SECRET`, `CORS_ORIGIN`
- [ ] Выполнены `prisma migrate deploy` и при необходимости `prisma db seed`
- [ ] Backend собран (`npm run build` в `backend/`) и запускается через systemd
- [ ] В корне лежит актуальный `data/workshops.json` (мастер-классы, FAQ, контакты)
- [ ] Админка собрана, содержимое `admin/dist` отдаётся по URL админки
- [ ] На сайте в production не задаётся жёстко «чужой» API: для своего домена `window.API_BASE` не должен указывать на старый сервер (см. логику в `index.html`)

## 6. Обновление после деплоя (полный цикл)

Рабочая копия на сервере должна совпадать с тем каталогом, откуда nginx отдаёт файлы.

```bash
cd /var/www/TvoriKrasivo
git fetch origin
git checkout main
git pull origin main

cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
cd ..

sudo systemctl restart tvori-krasivo-backend
sudo systemctl status tvori-krasivo-backend
# при ошибках: journalctl -u tvori-krasivo-backend -n 50 --no-pager

cd admin
npm ci
npm run build
cd ..
```

После выкладки сделайте **жёсткое обновление** страницы (Ctrl+F5) или очистку кэша: браузер может долго держать старый `js/main.js`. При необходимости увеличьте параметр `?v=` у скрипта в `index.html` и закоммитьте.

После обновления backend обязательно перезапускайте сервис (`restart`), иначе старый процесс Node может отдавать API без корректной обработки тела PATCH — смена мастер-класса в календаре «не сохранится».

## 7. Короткое обновление (git pull уже сделан)

```bash
cd /var/www/TvoriKrasivo/backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
sudo systemctl restart tvori-krasivo-backend

cd ../admin && npm ci && npm run build
```

## Процесс веток

- **Рекомендуется:** мержить релиз в **`main`** и на сервере всегда деплоить с **`main`** (`git pull origin main`), чтобы не было расхождения между «веткой для прода» и основной линией.
- **Или:** явно клонировать/переключать на нужную **`release/...`** на сервере и следить, чтобы её содержимое совпадало с тем, что вы считаете актуальным в `main`; иначе возможен **рассинхрон** (на прод уезжают не те коммиты).

## Старая версия сайта после деплоя

Проверьте по порядку:

1. **`pwd` и nginx:** каталог `git pull` = каталог в `alias` / `root` nginx для этого URL (частая ошибка — обновили `TvoriKrasivo`, а nginx смотрит в `gonchar/1`).
2. **Файл на диске:** `wc -c APP_ROOT/js/main.js` и сравнение с локальной сборкой; для API: `curl -sS http://127.0.0.1:3001/api/health`.
3. **Кэш:** жёсткое обновление, инкремент `?v=` у `main.js` в `index.html`.
4. **URL префикса:** основной прод — **https://tvori-krasivo.ru/** (`window.API_BASE` пустой, запросы на `/api/...`). Если тестируете по другому URL (например `https://хост/gonchar/1/`), в `index.html` должна срабатывать ветка с `window.API_BASE` для этого префикса; иначе запросы уйдут не туда.
