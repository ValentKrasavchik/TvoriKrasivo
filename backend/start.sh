#!/bin/bash
# Запуск бэкенда с автоперезапуском через systemd.
# Использование: ./start.sh или systemd вызывает node после сборки.

cd "$(dirname "$0")"
export NODE_ENV=production

# Сборка, если нет dist/index.js или есть более новые файлы в src/prisma.
if [ ! -f dist/index.js ] || find src prisma -type f -newer dist/index.js | grep -q .; then
  npm run build
fi

exec node dist/index.js
