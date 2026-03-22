# Деплой — Твори Красиво

Инструкция по развёртыванию на VPS (например, 1 CPU, 1 ГБ RAM, 15 ГБ NVMe).

Эта инструкция — **только продакшен:** **[https://tvori-krasivo.ru/](https://tvori-krasivo.ru/)** на **отдельном VPS**. Стейджинг и другие тестовые сервера с ним **не связаны**: у каждого свой `APP_ROOT`, свой nginx и свой `git pull` — перенос на прод делается **заново** по шагам ниже на машине, куда указывает DNS для **tvori-krasivo.ru**.

**`APP_ROOT`** — каталог клона репозитория на **прод-сервере**, обычно **`/var/www/TvoriKrasivo`**. Его же должны использовать **nginx** (`root` / `alias`), **systemd** (`WorkingDirectory` для бэкенда) и команды `git pull` — иначе после деплоя в браузере останется старая версия.

### Перенос на другой VPS (домен тот же: tvori-krasivo.ru)

1. Поднять **новый** сервер по разделам 1–5 ниже (или пошагово скопировать команды из репозитория).
2. **DNS** переключить на IP нового VPS, когда новый стек проверен по IP или временному имени.
3. **База:** либо скопировать `backend/prod.db` со старого сервера (до первого осмысленного запуска миграций на новом), либо задеплоить с нуля и выполнить `prisma migrate deploy` и при необходимости `prisma db seed`.
4. **Секреты:** перенести `backend/.env` с прод-сервера или заново задать `ADMIN_*`, `JWT_SECRET`, `CORS_ORIGIN` для `https://tvori-krasivo.ru` и `https://www.tvori-krasivo.ru`.

Готовый **промпт для Cursor** (одним блоком для агента на новой машине): **[CURSOR_TASK_DEPLOY_NEW_SERVER.md](CURSOR_TASK_DEPLOY_NEW_SERVER.md)**.

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
- `CORS_ORIGIN` — разрешённые origin через запятую, без пробелов. Для основного сайта с `www` и без:  
  `https://tvori-krasivo.ru,https://www.tvori-krasivo.ru`  
  (при отдельном поддомене админки добавьте его сюда же.)
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
- Для продакшена типичные **`server_name`**: `tvori-krasivo.ru` и `www.tvori-krasivo.ru`, **HTTPS** (`listen 443 ssl`), сертификаты Let's Encrypt.

**Готовый пример под прод** лежит в репозитории: **`nginx-tvori-krasivo.conf`**. Скопируйте его на сервер (например в `/etc/nginx/sites-available/tvori-krasivo`), подставьте **`APP_ROOT`** в директивах `root` и `alias`, проверьте `sudo nginx -t`, включите сайт и перезагрузите nginx.

Сертификаты: после того как DNS **A/AAAA** для `tvori-krasivo.ru` указывают на этот VPS:

```bash
sudo certbot --nginx -d tvori-krasivo.ru -d www.tvori-krasivo.ru
```

(либо `certbot certonly` и пропишите пути к `fullchain.pem` / `privkey.pem` в конфиге.)

Упрощённый фрагмент (детали и редирект HTTP→HTTPS — в **`nginx-tvori-krasivo.conf`**):

```nginx
server {
    listen 443 ssl http2;
    server_name tvori-krasivo.ru www.tvori-krasivo.ru;
    root /var/www/TvoriKrasivo;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /admin {
        alias /var/www/TvoriKrasivo/admin/dist;
        try_files $uri $uri/ /admin/index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ssl_certificate / ssl_certificate_key — см. полный файл nginx-tvori-krasivo.conf
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

## 6. Обновление на прод-сервере (после коммитов в `main`)

Все команды — на **VPS для tvori-krasivo.ru**, в **`APP_ROOT`** (ниже — **`/var/www/TvoriKrasivo`**).

### 6.1. Если ещё не на ветке `main`

```bash
cd /var/www/TvoriKrasivo
git fetch origin
git checkout main
git pull origin main
```

### 6.2. Полный цикл деплоя

```bash
cd /var/www/TvoriKrasivo

git pull origin main
```

Если после этого **не видно новых коммитов** или возникают конфликты:

```bash
git fetch origin
git status
git pull origin main
```

Убедитесь, что ветка **`main`** и рабочая копия **чистая** (или осознанно мержите конфликты).

**Nginx (если меняли шаблон в репо):** скопируйте и подключите **`nginx-tvori-krasivo.conf`**, подставьте **`APP_ROOT`** в `root` и `alias`, при необходимости **certbot** для **tvori-krasivo.ru**.

```bash
sudo nginx -t && sudo systemctl reload nginx
```

**Backend** (одна цепочка):

```bash
cd /var/www/TvoriKrasivo/backend

npm ci
npx prisma generate
npx prisma migrate deploy
npm run build

sudo systemctl restart tvori-krasivo-backend
sudo systemctl status tvori-krasivo-backend
# при ошибках: sudo journalctl -u tvori-krasivo-backend -n 50 --no-pager
```

**Админка** для **tvori-krasivo.ru**: в **`admin/.env.production`** задайте **`VITE_API_BASE=`** (пусто), затем сборка:

```bash
cd /var/www/TvoriKrasivo/admin
npm ci
npm run build
cd ..
```

После выкладки — **жёсткое обновление** (Ctrl+F5) или смена `?v=` у `js/main.js` в `index.html`. Без перезапуска backend после обновления кода старый Node может отдавать API без корректного PATCH.

## 7. Короткое обновление (git pull уже сделан)

Перед сборкой админки: **`admin/.env.production`** с **`VITE_API_BASE=`** для прод-домена.

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

Изменения только в **репозитории** (в том числе в `DEPLOY.md`) **сами по себе не обновляют** живой сайт: нужен `git pull` на том VPS, куда указывает DNS для **tvori-krasivo.ru**, пересборка backend/admin при необходимости и **актуальный nginx** с `root`/`alias` на этот каталог.

Проверьте по порядку:

1. **DNS:** `tvori-krasivo.ru` (и при необходимости `www`) ведут на **тот** сервер, где вы делаете деплой.
2. **`pwd` и nginx:** каталог `git pull` на прод-сервере совпадает с `root` / `alias` для **https://tvori-krasivo.ru/**.
3. **Файл на диске:** на сервере `wc -c APP_ROOT/js/main.js` и при необходимости сравнение с репозиторием; API: `curl -sS http://127.0.0.1:3001/api/health`.
4. **Кэш:** жёсткое обновление в браузере, инкремент `?v=` у `main.js` в `index.html` и новый деплой.
5. **Прод [https://tvori-krasivo.ru/](https://tvori-krasivo.ru/):** для корня домена в `index.html` срабатывает ветка с **пустым** `window.API_BASE`, запросы идут на **`/api/...`** того же хоста.
