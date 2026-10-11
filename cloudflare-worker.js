/* ============================================================
   Cloudflare Worker — обратный прокси для probyuti.ru
   ------------------------------------------------------------
   Зачем: твой провайдер режет порты 80/443 (Cloudflare туда не
   достучится), но открыт порт 8080. Этот Worker принимает HTTPS
   на probyuti.ru и пересылает запрос на http://origin.probyuti.ru:8080
   КОРОТКИМ запросом (провайдер не режет короткие).

   ВАЖНО про error 1003: Cloudflare ЗАПРЕЩАЕТ Worker'у делать fetch()
   напрямую на «голый» IP (анти-SSRF). Поэтому мы стучимся не на
   178.155.73.78, а на домен-маску origin.probyuti.ru, который ведёт
   на тот же IP (A-запись в DNS, СЕРАЯ туча / DNS-only, БЕЗ прокси).
   Worker видит домен — проверка пройдена, запрос уходит на сервер.

   Результат: https://probyuti.ru  → HTTPS, индексируется, быстро.

   Как задеплоить — в файле DEPLOY-WORKER.md (4 шага).
   Меняй ТОЛЬКО ORIGIN_HOST/ORIGIN_PORT, если IP/порт/маска сменятся.
   ============================================================ */
const ORIGIN_HOST = 'origin.probyuti.ru'; // домен-маска для IP (Cloudflare режет fetch() на голый IP → error 1003)
const ORIGIN_PORT = 8080;                 // порт, открытый наружу на роутере → внутренний :80
const ORIGIN = `http://${ORIGIN_HOST}:${ORIGIN_PORT}`;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    // формируем адрес origin: тот же путь и query, но хост/порт/протокол — твой сервер
    const target = new URL(url.pathname + url.search, ORIGIN);

    // копируем заголовки, корректируем Host (иначе origin может отдать редирект на себя)
    const headers = new Headers(request.headers);
    headers.set('Host', `${ORIGIN_HOST}:${ORIGIN_PORT}`);
    headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') || '');
    headers.set('X-Forwarded-Proto', 'https');

    const init = {
      method: request.method,
      headers,
      redirect: 'manual',                 // редиректы origin отдаём как есть
      body: (request.method === 'GET' || request.method === 'HEAD') ? undefined : request.body,
    };

    try {
      const resp = await fetch(target, init);
      // отдаём ответ как есть, сохраняя статус и заголовки (куки админки, content-type фото и т.п.)
      const respHeaders = new Headers(resp.headers);
      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: respHeaders,
      });
    } catch (err) {
      // origin недоступен (сервер выключен / интернет отвалился)
      return new Response(
        `<!doctype html><meta charset="utf-8">
         <div style="font:600 18px system-ui;padding:40px;text-align:center;color:#7a3a37">
           Сайт временно недоступен — сервер офлайн. Попробуйте через пару минут.
         </div>`,
        { status: 502, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }
  },
};
