/* ============================================================
   store.js — клиент API сервера + единое состояние сайта.
   Загружает /api/state, держит STORE, сохраняет через API
   с дебаунсом. Если сервер недоступен — fallback на localStorage.
   ============================================================ */

const STORE_KEY = 'probyuti.state.v1';
const TOKEN_KEY = 'probyuti.admin.token';

/* Категории галереи — те же, что услуги, КРОМЕ «Прочее» */
const GALLERY_CATS = ['nails', 'pedi', 'lashes', 'brows'];

/* Сиды галереи: реальные фото из отзывов Dikidi (запасной набор,
   пока админ не загрузит свои). Разложены по категориям вручную. */
const GALLERY_SEED = {
  nails: [
    'https://f2.dikidi.net/c27/v26223/mv04p0ioea.jpg',
    'https://f2.dikidi.net/c27/v26223/4r6h5mqoj3.jpg',
    'https://f2.dikidi.net/c27/v26223/1mucig1g1k.jpg',
    'https://f2.dikidi.net/c27/v26217/27l60rtrm1.jpg',
    'https://f2.dikidi.net/c27/v26217/1pfmt10po2.jpg',
    'https://f2.dikidi.net/c27/v26217/jrv2duberb.jpg',
  ],
  pedi: [
    'https://f2.dikidi.net/c26/v25713/1veur1dsp7.jpg',
    'https://f2.dikidi.net/c26/v25713/1jubrggjol.jpg',
  ],
  lashes: [
    'https://f2.dikidi.net/c25/v24248/52vga0qs9d.jpg',
    'https://f2.dikidi.net/c25/v24248/5dm4r1rjll.jpg',
    'https://f2.dikidi.net/c25/v24248/5cdjv0tvac.jpg',
    'https://f2.dikidi.net/c25/v24248/2mhf1aovrg.jpg',
    'https://f2.dikidi.net/c21/v20503/4n9ues3t5o.jpg',
  ],
  brows: [
    'https://f2.dikidi.net/c21/v20503/6dfu7uov29.jpg',
    'https://f2.dikidi.net/c21/v20503/6o3du88den.jpg',
    'https://f2.dikidi.net/c21/v20503/pg2r1baoek.jpg',
    'https://f2.dikidi.net/c21/v20273/17jqeuj4qt.jpg',
  ],
};

/* Дефолтные настройки салона */
function defaultState() {
  return {
    salon: {
      phone: '+7 (906) 168-40-28',
      phoneHref: '+79061684028',
      address: 'Волгоград, ул. Никитина, 127А',
      bookingUrl: 'https://dikidi.ru/profile/probyuti_1871559/',
      hours: {
        weekdays: { from: '10:00', to: '20:00' },
        weekend:  { from: '10:00', to: '18:00' },
        daysOff:  [],
      },
    },
    services: JSON.parse(JSON.stringify(typeof SERVICES !== 'undefined' ? SERVICES : [])),
    gallery: JSON.parse(JSON.stringify(GALLERY_SEED)),
  };
}

/* ----- токен админа ----- */
function getToken() {
  try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
}
function setToken(t) {
  try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
}

/* ----- fetch с токеном ----- */
async function apiFetch(url, opts) {
  opts = opts || {};
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  const t = getToken();
  if (t) headers['Authorization'] = 'Bearer ' + t;
  const res = await fetch(url, Object.assign({}, opts, { headers }));
  if (res.status === 401) {
    setToken('');
    if (typeof onUnauthorized === 'function') onUnauthorized();
    throw new Error('unauthorized');
  }
  if (!res.ok) {
    let msg = 'HTTP ' + res.status;
    try { const j = await res.json(); if (j && j.error) msg = j.error; } catch (e) {}
    throw new Error(msg);
  }
  return res.json();
}

/* ----- нормализация форм сервера → клиент ----- */
function normGallery(serverGallery) {
  const out = {};
  GALLERY_CATS.forEach((c) => { out[c] = []; });
  Object.keys(serverGallery || {}).forEach((k) => {
    const arr = (serverGallery[k] || []).map((item) =>
      (typeof item === 'string' ? item : (item && item.src) || ''));
    if (!out[k]) out[k] = [];
    out[k] = out[k].concat(arr.filter(Boolean));
  });
  return out;
}

/* ----- глобальное состояние ----- */
let STORE = defaultState();
let SERVER_MODE = true; // false → работаем локально (localStorage)

/* Нормализует raw (с сервера или из localStorage) в STORE */
function setStore(raw) {
  const base = defaultState();
  const settings = raw.settings || raw.salon || {};
  STORE.salon = Object.assign({}, base.salon, settings);
  STORE.salon.hours = Object.assign({}, base.salon.hours, settings.hours || {});
  ensureIds(raw.services);
  STORE.services = (Array.isArray(raw.services) && raw.services.length)
    ? raw.services : base.services;
  // галерею сервера берём только если там есть фото,
  // иначе оставляем сиды из GALLERY_SEED
  const srvGal = normGallery(raw.gallery || {});
  STORE.gallery = {};
  GALLERY_CATS.forEach((c) => {
    STORE.gallery[c] = (srvGal[c] && srvGal[c].length)
      ? srvGal[c]
      : (base.gallery[c] || []);
  });
}

/* Гарантирует стабильные id услуг (нужны для apply-dikidi) */
function ensureIds(services) {
  (services || []).forEach((s, i) => {
    if (!s.id) s.id = 's' + (i + 1) + '_' + (s.cat || 'x');
  });
}

/* ----- чтение / запись ----- */
async function loadState() {
  try {
    const r = await fetch('/api/state');
    if (!r.ok) throw new Error('api ' + r.status);
    const data = await r.json();
    SERVER_MODE = true;
    setStore(data);
    return true;
  } catch (e) {
    SERVER_MODE = false;
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) { setStore(JSON.parse(raw)); return true; }
    } catch (err) { console.warn('store: повреждён localStorage', err); }
    STORE = defaultState();
    return false;
  }
}

let saveTimer = null;
function saveState() {
  if (!SERVER_MODE) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(STORE)); } catch (e) {
      console.error('store save error', e);
    }
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await apiFetch('/api/admin/save', {
          method: 'POST',
          body: JSON.stringify({ services: STORE.services, settings: STORE.salon }),
        });
        resolve(true);
      } catch (e) {
        console.error('store: не удалось сохранить на сервер', e);
        resolve(false);
      }
    }, 400);
  });
}

/* Форматированная строка часов работы */
function formatHours(h) {
  if (!h) return 'Ежедневно с 10:00';
  const wd = h.weekdays ? `${h.weekdays.from}–${h.weekdays.to}` : '';
  const we = h.weekend ? `${h.weekend.from}–${h.weekend.to}` : '';
  if ((h.daysOff || []).length === 7) return 'Выходной';
  return (`Пн–Пт ${wd} · Сб–Вс ${we}`).trim();
}

function applyText(sel, val) {
  document.querySelectorAll(sel).forEach((el) => { el.textContent = val; });
}
function applyAttr(sel, attr, val) {
  document.querySelectorAll(sel).forEach((el) => { el.setAttribute(attr, val); });
}

/* Применяет состояние к публичной части сайта */
function applyStateToSite() {
  try { SERVICES = STORE.services; } catch (e) {}
  try { BOOKING_URL = STORE.salon.bookingUrl; } catch (e) {}
  applyText('[data-cms="phone"]', STORE.salon.phone);
  applyAttr('[data-cms="phone-href"]', 'href', 'tel:' + STORE.salon.phoneHref);
  applyText('[data-cms="address"]', STORE.salon.address);
  applyAttr('[data-cms="booking"]', 'href', STORE.salon.bookingUrl);
  applyText('[data-cms="hours"]', formatHours(STORE.salon.hours));
  try {
    document.querySelectorAll('.service-card__book, #book-btn, .nav__cta').forEach((a) => {
      a.setAttribute('href', STORE.salon.bookingUrl);
    });
  } catch (e) {}
}

/* ----- API для админки ----- */
const SalonAPI = {
  get state() { return STORE; },
  get serverMode() { return SERVER_MODE; },
  save: saveState,

  isLoggedIn() { return !!getToken(); },

  async login(password) {
    const data = await apiFetch('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password }),
    });
    if (data && data.token) { setToken(data.token); return true; }
    return false;
  },

  async logout() {
    try { await apiFetch('/api/admin/logout', { method: 'POST' }); } catch (e) {}
    setToken('');
  },

  async changePassword(oldPassword, newPassword) {
    return apiFetch('/api/admin/password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    });
  },

  /* услуги: оптимистично меняем STORE, сохраняем в фоне */
  addService(svc) {
    STORE.services.push(svc);
    saveState();
  },
  updateService(index, svc) {
    STORE.services[index] = svc;
    saveState();
  },
  removeService(index) {
    STORE.services.splice(index, 1);
    saveState();
  },

  /* галерея по ссылке */
  async addPhoto(cat, url) {
    if (!STORE.gallery[cat]) STORE.gallery[cat] = [];
    STORE.gallery[cat].push(url);
    if (SERVER_MODE) {
      await apiFetch('/api/admin/gallery', {
        method: 'POST', body: JSON.stringify({ cat, url }),
      });
    }
    saveState();
  },

  /* галерея с устройства (dataURL) → сервер кладёт файл в uploads */
  async uploadPhoto(cat, dataUrl) {
    const data = await apiFetch('/api/admin/upload', {
      method: 'POST', body: JSON.stringify({ cat, dataUrl }),
    });
    return (data && data.src) ? data.src : null;
  },

  async removePhoto(cat, index) {
    const doomed = (STORE.gallery[cat] || [])[index];
    STORE.gallery[cat].splice(index, 1);
    if (SERVER_MODE) {
      try {
        await apiFetch('/api/admin/gallery/remove', {
          method: 'POST', body: JSON.stringify({ cat, index, src: doomed }),
        });
      } catch (e) {
        // фото могло быть сидом (его нет на сервере) — не страшно
        console.warn('removePhoto: сервер не подтвердил', e.message);
      }
    }
    saveState();
  },

  /* настройки салона */
  updateSalon(patch) {
    Object.assign(STORE.salon, patch);
    saveState();
  },
  updateHours(patch) {
    STORE.salon.hours = Object.assign({}, STORE.salon.hours, patch);
    saveState();
  },

  async reset() {
    STORE = defaultState();
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    if (SERVER_MODE) {
      await apiFetch('/api/admin/save', {
        method: 'POST',
        body: JSON.stringify({ services: STORE.services, settings: STORE.salon }),
      });
    }
  },

  /* парсинг цен с Dikidi */
  async parseDikidi() {
    return apiFetch('/api/admin/parse-dikidi', { method: 'POST' });
  },
  async applyDikidi(updates) {
    const data = await apiFetch('/api/admin/apply-dikidi', {
      method: 'POST', body: JSON.stringify({ updates }),
    });
    if (data && Array.isArray(data.services)) {
      STORE.services = data.services;
      saveState();
    }
    return data;
  },
  async importDikidi(items) {
    const data = await apiFetch('/api/admin/import-dikidi', {
      method: 'POST', body: JSON.stringify({ items }),
    });
    if (data && Array.isArray(data.services)) {
      STORE.services = data.services;
      saveState();
    }
    return data;
  },
};
