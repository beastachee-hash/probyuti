# Деплой на Cloudflare Pages (БЕЗ сервера, БЕЗ админки)

Зачем: домашний ПК + туннель = нестабильно (провайдер рвёт соединения). Cloudflare Pages раздаёт сайт с их CDN по всему миру — быстро, всегда онлайн, HTTPS. Правки: меняешь файл → `git push` → сайт обновляется сам за ~30 сек.

## Что куда
- Репозиторий: `github.com/beastachee-hash/probyuti` (уже есть).
- Аккаунт Cloudflare: `beastachee@gmail.com` (уже есть).
- Домен: `probyuti.ru` (уже есть, неймсерверы уже на Cloudflare).

## Шаг 1. Подключить репозиторий к Pages
1. Открой **dash.cloudflare.com** → слева **Workers & Pages** → **Create** → вкладка **Pages** → **Connect to Git**.
2. Выбери репозиторий **probyuti** → **Begin setup**.

## Шаг 2. Настройки сборки (заполни точно так)
- **Project name:** `probyuti`
- **Production branch:** `master`
- **Framework preset:** `None`
- **Build command:** *(оставь ПУСТЫМ)*
- **Build output directory:** *(оставь ПУСТЫМ или `/`)*

> Сайт статичный — сборка не нужна. Pages просто отдаст файлы из репозитория.

## Шаг 3. Сохранить и деплой
Нажми **Save and Deploy**. Через ~30–60 сек получишь адрес вида `https://probyuti.pages.dev` — открой, проверь. Уже работает из любой точки мира.

## Шаг 4. Привязать домен probyuti.ru
1. В проекте Pages → вкладка **Custom domains** → **Set up a domain**.
2. Введи **probyuti.ru** → **Continue** → **Activate domain**.
3. Pages сам добавит DNS-запись (неймсерверы уже у Cloudflare) и выпустит HTTPS. Подожди 1–5 мин.

## Шаг 5. Убрать старый тоннель (чтобы домен указывал на Pages, а не на ПК)
1. В Cloudflare → **Websites** → **probyuti.ru** → слева **DNS → Records**.
2. Найди запись **`probyuti` (CNAME) → `....cfargotunnel.com`** → **удали** её.
3. Запись от Pages (`CNAME probyuti.pages.dev`) уже стоит — домен теперь на Pages.

## Шаг 6. Выключить туннель на ПК (больше не нужен)
В PowerShell (от админа):
```powershell
Get-Process cloudflared -EA SilentlyContinue | Stop-Process -Force
Unregister-ScheduledTask -TaskName 'ProByuti Site' -Confirm:$false -EA SilentlyContinue
```

## Как теперь править сайт
1. Меняешь файл в `G:\Cline\probyuti-site` (напр. цены в `app.js`, отзывы в `reviews-data.js`).
2. Коммит + пуш:
```powershell
cd G:\Cline\probyuti-site
git add -A
git commit -m "обновление"
git push origin master
```
3. Pages сам задеплоит за ~30 сек. Готово.

## Что теряем (и почему это ок)
- **Админка «временно недоступна»** — на Pages нет сервера, она не работает. Вместо неё — правка файлов + `git push` (ты так и просил: «менять всё вручную»).
- **Фото из админки** — загружай файлы в папку `assets/gallery/` вручную → коммит → пуш. Ссылки на фото пропиши в `store.js`/данных.
