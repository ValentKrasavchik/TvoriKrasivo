#!/bin/bash
# Включить SSL для tvori-krasivo.ru (Let's Encrypt).
# Запускать после того, как домен резолвится: host tvori-krasivo.ru
set -e
sudo certbot --nginx -d tvori-krasivo.ru -d www.tvori-krasivo.ru \
  --non-interactive --agree-tos --email admin@tvori-krasivo.ru
echo "SSL включён. Проверьте: https://tvori-krasivo.ru"
