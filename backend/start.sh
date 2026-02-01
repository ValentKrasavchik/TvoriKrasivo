#!/bin/bash
# Запуск бэкенда с автоперезапуском через systemd.
# Использование: ./start.sh или systemd вызывает node после сборки.

cd "$(dirname "$0")"
export NODE_ENV=production

# Сборка, если нет dist или исходники новее
if [ ! -d dist ] || [ src/index.ts -nt dist/index.js ]; then
  npm run build
fi

exec node dist/index.js
