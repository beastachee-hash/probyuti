# 🖥️ Деплой ПроБьюти на облачный сервер (VPS)

Твой сайт — это **приложение с сервером** (`server.js`, Node.js), а не просто HTML-файлы.
Его нужно **запускать** на сервере, который работает 24/7 и доступен из любого интернета
(в отличие от твоего компьютера, который виден только в твоём Wi-Fi).

**Наш код готов к VPS как есть** — он уже слушает `process.env.PORT` и не требует правок.

---

## Шаг 0. Заказать VPS у Beget

1. Зайди на **https://beget.com/ru/cloud/servers** (раздел «Облачные серверы» / «VPS»).
2. Выбери **Ubuntu 22.04** и самый дешёвый тариф (1 CPU / 1–2 ГБ RAM хватит с запасом).
3. После создания в панели будет **IP-адрес** сервера и данные для входа (**root + пароль**).
   Сохрани их — это твой «пульт управления» сервером.

> 💡 Альтернатива на выбор: Timeweb Cloud, Selectel, VDSina, Aeza — все дают VPS с Ubuntu.
> Инструкция ниже одинаковая для любого из них.

---

## Шаг 1. Подключиться к серверу по SSH

На **Windows** открой **PowerShell** и введи (подставь IP из панели Beget):

```powershell
ssh root@ТВОЙ_IP
```

- Спросит `Are you sure...` → набери `yes`
- Спросит **пароль** → вставь (при вводе он не отображается — это нормально) → Enter

Ты внутри сервера. Дальше все команды выполняются здесь.

---

## Шаг 2. Установить Node.js и PM2

Вставь по очереди (копируй целиком, по одной команде):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v            # должно показать v20.x
```

Устанавливаем PM2 (менеджер, который держит сайт запущенным и поднимает после перезагрузки):

```bash
sudo npm install -g pm2
```

---

## Шаг 3. Загрузить файлы сайта

**Способ А — через git (проще всего).** На сервере:

```bash
cd ~
git clone https://github.com/beastachee-hash/probyuti.git
cd probyuti
npm install
```

**Способ Б — закинуть файлы вручную** через тот же **Sprut.io** (теперь понятно зачем он —
это файловый менеджер): залей папку `probyuti-site` в `/root/probyuti` на сервере, затем
выполни `npm install`.

---

## Шаг 4. Создать файл `.env` с секретами

В папке проекта (`~/probyuti`) создай файл `.env`:

```bash
nano .env
```

Вставь (замени значения на свои):

```
PORT=3000
ADMIN_PASSWORD=придумай_сложный_пароль
YDISK_TOKEN=токен_яндекс_диска
```

Сохранить: **Ctrl+O → Enter → Ctrl+X**.

> `YDISK_TOKEN` — если используешь Яндекс.Диск для фото/данных. Если нет — можно
> оставить только `PORT` и `ADMIN_PASSWORD`, данные будут храниться в файле на сервере.

---

## Шаг 5. Запустить сайт

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

`pm2 startup` напечатает длинную команду, начинающуюся с `sudo env ...` —
**скопируй её и выполни** (это включает автозапуск после перезагрузки сервера).

Проверить, что работает:

```bash
pm2 status
pm2 logs probyuti --lines 30
```

---

## Шаг 6. Открыть порт (чтобы сайт был виден из интернета)

```bash
sudo ufw allow 3000
```

Теперь сайт открывается по адресу: **`http://ТВОЙ_IP:3000`** — с телефона, из любой точки мира. 🎉

---

## Шаг 7 (по желанию). Свой домен + HTTPS

1. В панели, где купил домен, поставь **A-запись** на IP сервера:
   | Тип | Имя | Значение |
   |---|---|---|
   | `A` | `@` | `ТВОЙ_IP` |
   | `A` | `www` | `ТВОЙ_IP` |

2. Поставь Nginx и бесплатный HTTPS (Let's Encrypt):

```bash
sudo apt-get install -y nginx
sudo ufw allow 'Nginx Full'
sudo nano /etc/nginx/sites-available/probyuti
```

Вставь (замени `probyuti.ru` на свой домен):

```nginx
server {
    listen 80;
    server_name probyuti.ru www.probyuti.ru;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/probyuti /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d probyuti.ru -d www.probyuti.ru
```

Готово — сайт на **своём домене** с замочком `https://`.

---

## Полезные команды

| Действие | Команда |
|---|---|
| Статус | `pm2 status` |
| Логи (живые) | `pm2 logs probyuti` |
| Перезапустить | `pm2 restart probyuti` |
| Обновить код из GitHub | `cd ~/probyuti && git pull && npm install && pm2 restart probyuti` |
| Остановить | `pm2 stop probyuti` |

---

## Если что-то не работает

1. `pm2 logs probyuti` — покажет **реальную ошибку** (в отличие от других платформ).
2. Частые причины: не введён `.env`; забыт `npm install`; порт 3000 не открыт (`sudo ufw allow 3000`).
3. Пришли мне вывод `pm2 logs` — помогу разобрать.
