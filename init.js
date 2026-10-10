/* ============ ПроБьюти Mini App — логика и интерфейс ============ */

/* ---------- утилиты ---------- */
const fmtPrice = (n) => n.toLocaleString('ru-RU') + ' ₽';

const haptic = () => { /* в обычном сайте хаптика нет */ };

const starsHtml = (n) => {
  const full = Math.round(Number(n) || 5);
  return '★'.repeat(full) + '☆'.repeat(Math.max(0, 5 - full));
};

/* ---------- вкладки ---------- */
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.panel;
      if (tab.classList.contains('active')) return;
      haptic('light');
      tabs.forEach((t) => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.panel').forEach((p) => {
        p.classList.toggle('active', p.id === targetId);
      });
      window.scrollTo({ top: 0 });

      if (targetId === 'panel-reviews') {
        animateRating();
        if (!liveRequested) {
          liveRequested = true;
          loadLiveReviews(true); // тихое авто-обновление при первом открытии
        }
      }
    });
  });
}

/* ---------- услуги ---------- */
const listEl = document.getElementById('services-list');
const bentoEl = document.getElementById('bento');
let activeCat = 'all';

function syncBento() {
  if (!bentoEl) return;
  bentoEl.querySelectorAll('.bento__tile').forEach((t) => {
    t.classList.toggle('active', t.dataset.cat === activeCat);
  });
}

function setCat(cat) {
  if (activeCat === cat) return;
  activeCat = cat;
  syncBento();
  renderServices();
}

/* ---------- цены со скидкой ---------- */
const clampDisc = (d) => Math.max(0, Math.min(90, Math.round(Number(d) || 0)));

function fmtRange(from, to) {
  return `<small class="service-card__from">от</small>${fmtPrice(from)}<small class="service-card__to">до ${fmtPrice(to)}</small>`;
}

function priceHtml(svc) {
  const disc = clampDisc(svc.discount);
  if (disc <= 0) {
    return svc.priceFrom != null ? fmtRange(svc.priceFrom, svc.priceTo) : fmtPrice(svc.price);
  }
  const badge = `<span class="service-card__discount" title="Скидка ${disc}%">−${disc}%</span>`;
  if (svc.priceFrom != null) {
    const nf = Math.round(svc.priceFrom * (1 - disc / 100));
    const nt = Math.round(svc.priceTo * (1 - disc / 100));
    return `<span class="service-card__price-old">${fmtRange(svc.priceFrom, svc.priceTo)}</span>` +
      `<span class="service-card__price-new">${fmtRange(nf, nt)}</span>${badge}`;
  }
  const n = Math.round(svc.price * (1 - disc / 100));
  return `<span class="service-card__price-old">${fmtPrice(svc.price)}</span>` +
    `<span class="service-card__price-new">${fmtPrice(n)}</span>${badge}`;
}

function serviceCard(svc, i) {
  const el = document.createElement('article');
  el.className = 'service-card';
  el.style.animationDelay = (i * 40) + 'ms';

  el.innerHTML = `
    <div class="service-card__head">
      <h3 class="service-card__name">${svc.name}</h3>
      <div class="service-card__price">${priceHtml(svc)}</div>
    </div>
    <p class="service-card__desc">${svc.desc}</p>
    <div class="service-card__foot">
      ${svc.duration ? `<span class="service-card__duration">⏱ ${svc.duration}</span>` : ''}
      <a class="service-card__book" href="${BOOKING_URL}" target="_blank" rel="noopener">Записаться</a>
    </div>
  `;
  return el;
}

function renderServices() {
  const items = activeCat === 'all'
    ? SERVICES
    : SERVICES.filter((s) => s.cat === activeCat);

  listEl.innerHTML = '';
  items.forEach((svc, i) => listEl.appendChild(serviceCard(svc, i)));
}

/* ---------- отзывы ---------- */
const REVIEWS_BATCH = 8;
const reviewsListEl = document.getElementById('reviews-list');
const moreBtn = document.getElementById('more-reviews');
let reviewsShown = 0;

function reviewCard(r, i) {
  const el = document.createElement('article');
  el.className = 'review-card';
  el.style.animationDelay = Math.min(i, 8) * 40 + 'ms';

  const photos = (r.images || []).length
    ? `<div class="review-card__photos">${r.images
        .map((src) => `<a href="${src.replace('size=s', 'size=b')}" target="_blank" rel="noopener"><img src="${src}" alt="Фото отзыва" loading="lazy" decoding="async"></a>`)
        .join('')}</div>`
    : '';

  el.innerHTML = `
    <div class="review-card__head">
      <div class="review-card__avatar">${(r.name || 'Гость').charAt(0).toUpperCase()}</div>
      <div class="review-card__who">
        <strong>${r.name || 'Гость'}</strong>
        <small>${r.date}</small>
      </div>
      <div class="review-card__stars" title="${r.stars} из 5">${starsHtml(r.stars)}</div>
    </div>
    ${r.service ? `<span class="review-card__service">${r.service}</span>` : ''}
    ${r.text ? `<p class="review-card__text">${r.text}</p>` : ''}
    ${photos}
  `;
  return el;
}

function renderReviews(reset) {
  if (reset) {
    reviewsListEl.innerHTML = '';
    reviewsShown = 0;
  }
  const next = REVIEWS.slice(reviewsShown, reviewsShown + REVIEWS_BATCH);
  next.forEach((r, i) => reviewsListEl.appendChild(reviewCard(r, reviewsShown + i)));
  reviewsShown += next.length;

  const left = REVIEWS.length - reviewsShown;
  if (left <= 0) {
    moreBtn.style.display = 'none';
  } else {
    moreBtn.style.display = '';
    moreBtn.textContent = `Показать ещё (${left})`;
  }
}

function initReviews() {
  renderReviews(true);
  moreBtn.addEventListener('click', () => {
    haptic('light');
    renderReviews(false);
  });

  document.getElementById('refresh-reviews')?.addEventListener('click', () => {
    haptic('medium');
    loadLiveReviews(false);
  });
}

/* ---------- живой парсинг отзывов Dikidi ---------- */
let liveRequested = false;

const DIKIDI_FILTERS = encodeURIComponent(JSON.stringify({
  reviews_list_sort_rating: 'date_desc',
  reviews_list_only_photo: false,
  reviews_list_sort: 'date_desc',
  is_master: 0,
}));

const DIKIDI_PAGE_URL = (offset) =>
  'https://dikidi.ru/ajax/profile/reviews_pagination/?company=1871559&offset=' +
  offset + '&rating=0&filters=' + DIKIDI_FILTERS;

// CORS-прокси (пробуем по очереди — бывает, один из них недоступен)
const DIKIDI_PROXIES = [
  (u) => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
  (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
  (u) => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u),
];

const EN_MONTHS = {
  jan: 'января', feb: 'февраля', mar: 'марта', apr: 'апреля', may: 'мая', jun: 'июня',
  jul: 'июля', july: 'июля', aug: 'августа', sep: 'сентября', sept: 'сентября',
  oct: 'октября', october: 'октября', nov: 'ноября', dec: 'декабря', december: 'декабря',
};

const decodeHtml = (s) => (s || '')
  .replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')
  .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/[ \t]+/g, ' ').trim();

function parseDikidiHtml(html) {
  const out = [];
  const re = /<div class="review[^"]*" data-review-id="(\d+)">([\s\S]*?)(?=<div class="review[^"]*" data-review-id="|$)/g;
  for (const m of html.matchAll(re)) {
    const block = m[2];
    const name = decodeHtml((block.match(/class="username">([^<]+)</) || [])[1]);
    const dateRaw = ((block.match(/class="date">([\s\S]*?)<\/div>/) || [])[1] || '').replace(/\s+/g, ' ').trim();
    const dm = dateRaw.match(/(\d+)\s+([A-Za-z.]+)\s+(\d+)/);
    const monthKey = dm ? dm[2].toLowerCase().replace(/\./g, '') : '';
    const date = dm ? dm[1] + ' ' + (EN_MONTHS[monthKey] || dm[2]) + ' ' + dm[3] : dateRaw;
    const service = decodeHtml((block.match(/class="service"[^>]*>([\s\S]*?)<\/a>/) || [])[1]);
    const starsM = block.match(/--stars:\s*(\d+)px/);
    const stars = starsM ? Math.round((parseInt(starsM[1], 10) / 130) * 5 * 10) / 10 : 5;
    const textM = block.match(/class="abandoned-center-text">([\s\S]*?)<\/div>/)
      || block.match(/class="text">([\s\S]*?)<\/div>/);
    const text = textM ? decodeHtml(textM[1]) : '';
    const imgSec = block.match(/<div class="images">([\s\S]*?)<\/div>/);
    const images = imgSec
      ? [...imgSec[1].matchAll(/<img src="(https:\/\/f2\.dikidi\.net\/[^"]+)"/g)].map((x) => x[1])
      : [];
    if (name || text) out.push({ name, date, service, text, stars, images });
  }
  return out;
}

async function fetchThroughProxy(url) {
  for (const wrap of DIKIDI_PROXIES) {
    try {
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 9000) : null;
      const res = await fetch(wrap(url), ctrl ? { signal: ctrl.signal } : {});
      if (timer) clearTimeout(timer);
      if (!res.ok) continue;
      const txt = await res.text();
      if (txt) return txt;
    } catch (e) { /* пробуем следующий прокси */ }
  }
  return null;
}

async function loadLiveReviews(silent) {
  const btn = document.getElementById('refresh-reviews');
  const status = document.getElementById('reviews-status');
  btn?.classList.add('loading');
  if (status && !silent) { status.textContent = 'Обновляю…'; status.className = 'live-status'; }

  const first = await fetchThroughProxy(DIKIDI_PAGE_URL(0));
  if (first === null) {
    btn?.classList.remove('loading');
    if (status && !silent) {
      status.textContent = 'Сервер недоступен — показаны сохранённые';
      status.className = 'live-status error';
    }
    return false;
  }

  const parsePage = (txt) => {
    try { return parseDikidiHtml(JSON.parse(txt).html || ''); }
    catch (e) { return parseDikidiHtml(txt); }
  };

  let all = parsePage(first);
  for (let offset = 5; offset <= 45; offset += 5) {
    const page = await fetchThroughProxy(DIKIDI_PAGE_URL(offset));
    if (page === null) break;
    const batch = parsePage(page);
    if (batch.length === 0) break;
    all = all.concat(batch);
    if (batch.length < 5) break;
  }

  btn?.classList.remove('loading');

  if (all.length < 30) {
    if (status && !silent) {
      status.textContent = 'Не удалось обновить — показаны сохранённые';
      status.className = 'live-status error';
    }
    return false;
  }

  // верхние 5 отзывов (с главной) + свежие из Dikidi, без дублей
  const top = REVIEWS.slice(0, 5);
  const seen = new Set(top.map((r) => r.name + '|' + (r.text || '').slice(0, 40)));
  const fresh = [];
  for (const r of all) {
    const key = r.name + '|' + (r.text || '').slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push(r);
  }

  REVIEWS.length = 0;
  Array.prototype.push.apply(REVIEWS, top.concat(fresh));
  renderReviews(true);

  if (status) {
    status.textContent = '✓ Обновлено: ' + REVIEWS.length + ' отзывов';
    status.className = 'live-status ok';
  }
  return true;
}

/* ---------- анимация счётчика рейтинга ---------- */
function animateRating() {
  const el = document.querySelector ? document.querySelector('.rating-card__value') : null;
  if (!el || el.dataset.done) return;
  el.dataset.done = '1';
  const target = 4.8;
  const t0 = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / 900);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = (target * eased).toFixed(1);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ---------- стеклянная навигация при скролле ---------- */
function initNavScroll() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 24);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ---------- плавное появление секций при скролле (scroll-reveal) ---------- */
function initReveal() {
  const items = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('in-view'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); }
    });
  }, { threshold: .12, rootMargin: '0px 0px -40px 0px' });
  items.forEach((el) => io.observe(el));
}

/* ---------- счётчики статистики ---------- */
function animateCounters() {
  const els = document.querySelectorAll('.stat__value');
  if (!els.length) return;
  const run = (el) => {
    if (el.dataset.done) return;
    el.dataset.done = '1';
    const target = parseFloat(el.dataset.count || el.textContent);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / 1100);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(decimals);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if (!('IntersectionObserver' in window)) { els.forEach(run); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
  }, { threshold: .5 });
  els.forEach((el) => io.observe(el));
}

/* ---------- магнитный hover-подсвет на карточках (bento/услуги/отзывы) ---------- */
function initMagnetic() {
  const sel = '.bento__tile, .service-card, .contact, .stat, .review-card';
  document.addEventListener('pointermove', (ev) => {
    const card = ev.target.closest ? ev.target.closest(sel) : null;
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', ((ev.clientX - r.left) / r.width) * 100 + '%');
    card.style.setProperty('--my', ((ev.clientY - r.top) / r.height) * 100 + '%');
  });
}

/* ---------- клики по bento-плиткам: выбрать категорию и прокрутить к прайсу ---------- */
function initBento() {
  bentoEl?.addEventListener('click', (ev) => {
    const tile = ev.target.closest('.bento__tile');
    if (!tile) return;
    const cat = tile.dataset.cat;
    if (cat) {
      // повторный клик по активной плитке сбрасывает на «Все»
      setCat(activeCat === cat ? 'all' : cat);
    }
    scrollToServices();
  });
}

function scrollToServices() {
  const el = document.getElementById('services-list');
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- старт: сначала грузим состояние с сервера ---------- */
function bootSite() {
  applyStateToSite(); // применить состояние до рендера
  initTabs();
  syncBento();
  renderServices();
  if (typeof initGallery === 'function') initGallery();
  initReviews();
  initNavScroll();
  initReveal();
  animateCounters();
  initMagnetic();
  initBento();
  if (typeof initAdmin === 'function') initAdmin();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    loadState().then(bootSite).catch(bootSite);
  });
} else {
  loadState().then(bootSite).catch(bootSite);
}

// кнопка «Смотреть прайс» в hero
document.getElementById('scroll-price')?.addEventListener('click', () => {
  setCat('all');
  scrollToServices();
});

// при первой отрисовке — запускаем анимацию рейтинга, если вкладка отзывов активна не будет
// (она запускается при переключении на отзывы внутри initTabs)



