#!/usr/bin/env bash
# ============================================================
#  ПроБьюти · авто-деплой на VPS (Oracle Cloud Always Free)
#  Запускать на самой Linux-машине от пользователя ubuntu:
#     bash <(curl -fsSL https://raw.githubusercontent.com/beastachee-hash/probyuti/master/deploy.sh)
#  или: git clone ... && cd probyuti && bash deploy.sh
# ============================================================
set -euo pipefail

APP_DIR="$HOME/probyuti"
REPO="https://github.com/beastachee-hash/probyuti.git"
PORT=3000

echo "==> [1/6] Обновление системы"
sudo apt-get update -y
sudo apt-get install -y curl git build-essential

echo "==> [2/6] Установка Node.js 20 LTS (если ещё нет)"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -c2-3)" != "20" ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v; npm -v

echo "==> [3/6] Установка PM2 (менеджер процессов + автозапуск)"
if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

echo "==> [4/6] Загрузка/обновление кода"
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git pull --ff-only
else
  git clone "$REPO" "$APP_DIR"
  cd "$APP_DIR"
fi

echo "==> [5/6] Установка зависимостей"
npm ci --omit=dev || npm install --omit=dev

# Пароль админа: берём из окружения, иначе оставляем дефолтный (смените в админке!)
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-probyuti2026}"
export PORT="$PORT"

echo "==> [6/6] Запуск под PM2 + автозапуск при перезагрузке"
pm2 delete probyuti 2>/dev/null || true
PORT="$PORT" ADMIN_PASSWORD="$ADMIN_PASSWORD" pm2 start server.js --name probyuti --update-env
pm2 save
# автозапуск без systemd-ошибок (генерируем команду и добавляем в crontab при отсутствии systemd)
if command -v systemctl >/dev/null 2>&1 && systemctl --version >/dev/null 2>&1; then
  pm2 startup || true
  pm2 save
else
  (crontab -l 2>/dev/null | grep -q 'pm2 resurrect' || \
    (crontab -l 2>/dev/null; echo '@reboot PORT='"$PORT"' ADMIN_PASSWORD='"$ADMIN_PASSWORD"' pm2 resurrect >> $HOME/pm2.log 2>&1') | crontab -)
fi

echo ""
echo "================================================"
echo " ГОТОВО! Локально проверьте:  curl http://localhost:$PORT/api/state"
echo " Внешний адрес:              http://<ваш_публичный_IP>:$PORT"
echo " Управление: pm2 logs probyuti | pm2 restart probyuti | pm2 status"
echo "================================================"
