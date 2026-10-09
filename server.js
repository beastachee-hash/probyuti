/* ============================================================
   ПроБьюти · сервер 2026
   Express + JSON-БД + JWT-вход + REST API + парсер цен Dikidi.
   Запуск:  npm start   (откроется на http://localhost:3000)
   ------------------------------------------------------------
   Данные хранятся в db/data.json. При первом старте создаётся
   из db/seed.json (если есть) или с дефолтными значениями.
   Загруженные фото галереи — в db/uploads/.
   Пароль админа хранится в виде bcrypt-хеша (задаётся через env
   ADMIN_PASSWORD, меняется через API /api/admin/password).
   ============================================================ */

'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');

const ROOT = __dirname;
const DB_DIR = path.join(ROOT, 'db');
const DATA_FILE = path.join(DB_DIR, 'data.json');
const SEED_FILE = path.join(DB_DIR, 'seed.json');
const UPLOAD_DIR = path.join(DB_DIR, 'uploads');
const PORT = process.env.PORT || 3000;
const TOKEN_TTL = 1000 * 60 * 60 * 12; // 12 часов
// Пароль админа по умолчанию можно задать через env (для хостинга)
const ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || 'probyuti2026';

/* ---------- работа с JSON-БД ---------- */
function ensureDirs() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function ensureIds(services) {
  (services || []).forEach((s, i) => {
    if (!s.id) s.id = 's' + (i + 1) + '_' + (s.cat || 'x');
  });
  return services;
}

function defaultData() {
  const seed = fs.existsSync(SEED_FILE)
    ? JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'))
    : { services: [], settings: {}, gallery: { nails: [], pedi: [], lashes: [], brows: [] } };
  return {
    admin: { username: 'admin', passHash: bcrypt.hashSync(ADMIN_DEFAULT_PASSWORD, 10) },
    services: ensureIds(seed.services || []),
    categories: seed.categories || [],
    settings: Object.assign(
      {
        phone: '+7 (906) 168-40-28',
        phoneHref: '+79061684028',
        address: 'Волгоград, ул. Никитина, 127А',
        bookingUrl: 'https://dikidi.ru/profile/probyuti_1871559/',
        hours: { weekdays: { from: '10:00', to: '20:00' }, weekend: { from: '10:00', to: '18:00' }, daysOff: [] },
      },
      seed.settings || {}
    ),
    gallery: seed.gallery || { nails: [], pedi: [], lashes: [], brows: [] },
  };
}

function loadData() {
  ensureDirs();
  if (!fs.existsSync(DATA_FILE)) {
    const d = defaultData();
    fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2), 'utf8');
    return d;
  }
  const loaded = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  // страховка: если файл неполный (старый формат) — дозаполняем из seed
  const base = defaultData();
  const merged = {
    admin: loaded.admin || base.admin,
    services: ensureIds(Array.isArray(loaded.services) ? loaded.services : base.services),
    categories: loaded.categories || base.categories,
    settings: Object.assign(base.settings, loaded.settings || {}),
    gallery: Object.assign(base.gallery, loaded.gallery || {}),
  };
  return merged;
}

function saveData(d) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2), 'utf8');
}

/* ---------- токены сессий (в памяти, сброс при рестарте) ---------- */
const tokens = new Map(); // token -> { username, expires }

function issueToken(username) {
  const token = crypto.randomBytes(24).toString('hex');
  tokens.set(token, { username, expires: Date.now() + TOKEN_TTL });
  return token;
}

function authOk(req) {
  const t = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const rec = tokens.get(t);
  if (!rec) return false;
  if (rec.expires < Date.now()) { tokens.delete(t); return false; }
  return true;
}


/* ---------- Express ---------- */
const app = express();
app.use(express.json({ limit: '25mb' }));

let DATA = loadData();

/* ---------- статика сайта (без служебных папок!) ---------- */
app.use(express.static(ROOT, {
  index: 'index.html',
  setHeaders(res, filePath) {
    // никогда не отдаём БД, сиды и внутренности node
    const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
    if (rel === 'db' || rel.startsWith('db/') ||
        rel === 'node_modules' || rel.startsWith('node_modules/') ||
        rel === 'server.js' || rel === 'package.json' || rel === 'package-lock.json') {
      res.statusCode = 404;
    }
  },
}));
// точечный запрет: прямые запросы к служебному
app.use(['/db', '/node_modules', '/server.js', '/package.json', '/package-lock.json'],
  (req, res) => res.status(404).send('Not found'));
app.use('/uploads', express.static(UPLOAD_DIR));

/* ============ ПУБЛИЧНЫЙ API ============ */

app.get('/api/state', (req, res) => {
  res.json({
    services: DATA.services,
    categories: DATA.categories,
    settings: DATA.settings,
    gallery: DATA.gallery,
  });
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== DATA.admin.username || !bcrypt.compareSync(String(password || ''), DATA.admin.passHash)) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  res.json({ token: issueToken(username), username });
});

app.post('/api/admin/logout', (req, res) => {
  const t = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  tokens.delete(t);
  res.json({ ok: true });
});

function guard(req, res, next) {
  if (!authOk(req)) return res.status(401).json({ error: 'Требуется вход' });
  next();
}

app.post('/api/admin/password', guard, (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!bcrypt.compareSync(String(oldPassword || ''), DATA.admin.passHash)) {
    return res.status(400).json({ error: 'Старый пароль неверный' });
  }
  if (!newPassword || String(newPassword).length < 4) {
    return res.status(400).json({ error: 'Новый пароль слишком короткий' });
  }
  DATA.admin.passHash = bcrypt.hashSync(String(newPassword), 10);
  saveData(DATA);
  res.json({ ok: true });
});

app.post('/api/admin/save', guard, (req, res) => {
  const body = req.body || {};
  if (Array.isArray(body.services)) DATA.services = body.services;
  if (body.settings) {
    const s = body.settings;
    if (s.phone != null) DATA.settings.phone = s.phone;
    if (s.phoneHref != null) DATA.settings.phoneHref = s.phoneHref;
    if (s.address != null) DATA.settings.address = s.address;
    if (s.bookingUrl != null) DATA.settings.bookingUrl = s.bookingUrl;
    if (s.hours) DATA.settings.hours = s.hours;
  }
  saveData(DATA);
  res.json({ ok: true });
});

app.post('/api/admin/gallery', guard, (req, res) => {
  const { cat, url } = req.body || {};
  if (!DATA.gallery[cat]) DATA.gallery[cat] = [];
  DATA.gallery[cat].push({ src: url });
  saveData(DATA);
  res.json({ ok: true, gallery: DATA.gallery });
});

app.post('/api/admin/upload', guard, (req, res) => {
  const { cat, dataUrl } = req.body || {};
  const m = String(dataUrl || '').match(/^data:(image\/[\w+]+);base64,(.+)$/);
  if (!m) return res.status(400).json({ error: 'Некорректное изображение' });
  const ext = (m[1].split('/')[1] || 'jpg').replace(/[^a-z]/gi, '');
  const safeCat = (cat || 'misc').replace(/[^a-z]/gi, '');
  const fname = `${safeCat}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, fname), Buffer.from(m[2], 'base64'));
  const src = '/uploads/' + fname;
  if (!DATA.gallery[safeCat]) DATA.gallery[safeCat] = [];
  DATA.gallery[safeCat].push({ src });
  saveData(DATA);
  res.json({ ok: true, src, gallery: DATA.gallery });
});

app.post('/api/admin/gallery/remove', guard, (req, res) => {
  const { cat, index, src } = req.body || {};
  if (DATA.gallery[cat]) {
    if (src != null) {
      const i = DATA.gallery[cat].findIndex((x) =>
        (typeof x === 'string' ? x : x.src) === src);
      if (i !== -1) DATA.gallery[cat].splice(i, 1);
    } else if (DATA.gallery[cat][index] != null) {
      DATA.gallery[cat].splice(index, 1);
    }
    saveData(DATA);
  }
  res.json({ ok: true, gallery: DATA.gallery });
});

/* ---------- ПАРСЕР ЦЕН DIKIDI ----------
   1) Официальный JSON API: /api/v1/companies/{id}/services (все услуги,
      id/price/durationMinutes/category). 2) Fallback — REDUX-блоб главной
   страницы. Сопоставление с БД — по dikidiId, затем по названию. */
const DIKIDI_COMPANY = '1871559';
const DIKIDI_UA = 'Mozilla/5.0 (compatible; ProbyutiBot/1.0)';

function dikidiDuration(mins) {
  mins = Math.round(Number(mins) || 0);
  if (!mins) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h} ч ${m} мин`;
  if (h) return `${h} ч`;
  return `${m} мин`;
}

async function fetchDikidiServices() {
  const out = [];
  let offset = 0;
  for (let page = 0; page < 10; page++) {
    const url = `https://dikidi.ru/api/v1/companies/${DIKIDI_COMPANY}/services?limit=100&offset=${offset}`;
    const resp = await fetch(url, { headers: { 'user-agent': DIKIDI_UA } });
    if (!resp.ok) throw new Error('Dikidi ответил ' + resp.status);
    const j = await resp.json();
    const items = ((j.data && j.data.data) || j.data || []).map((s) => ({
      dikidiId: String(s.id),
      name: s.name,
      price: Math.round(Number(s.price) || 0),
      duration: dikidiDuration(s.durationMinutes),
      category: s.category && s.category.name,
      desc: s.description || '',
    }));
    out.push(...items);
    const paged = (j.data && j.data.paged) || j.paged || {};
    const total = paged.total || items.length;
    offset += items.length;
    if (offset >= total || !items.length) break;
  }
  return out;
}

function parseReduxPrices(html) {
  // записи вида {id:"19970615",name:"…",price:1800,...} в __REDUX_INITIAL_STATE__
  const out = [];
  const re = /\{id:"(\d+)",name:"((?:[^"\\]|\\.)+)",price:(\d+)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    out.push({
      dikidiId: m[1],
      name: m[2].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim(),
      price: parseInt(m[3], 10),
      duration: '', category: '', desc: '',
    });
  }
  // дедуп по id
  const seen = {};
  return out.filter((s) => (seen[s.dikidiId] ? false : (seen[s.dikidiId] = true)));
}

function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

app.post('/api/admin/parse-dikidi', guard, async (req, res) => {
  try {
    let parsed = [];
    try {
      parsed = await fetchDikidiServices();
    } catch (apiErr) {
      // fallback: REDUX-блоб главной страницы (первые ~5 услуг)
      const resp = await fetch(`https://dikidi.ru/profile/probyuti_${DIKIDI_COMPANY}/`, {
        headers: { 'user-agent': DIKIDI_UA },
      });
      if (!resp.ok) throw apiErr;
      parsed = parseReduxPrices(await resp.text());
    }

    const matched = [];
    const diffs = [];
    const unmatched = [];
    DATA.services.forEach((s) => {
      let found = s.dikidiId
        ? parsed.find((p) => p.dikidiId === String(s.dikidiId))
        : null;
      if (!found) {
        const key = normalizeName(s.name);
        found = parsed.find((p) => normalizeName(p.name) === key);
      }
      if (!found) { unmatched.push({ id: s.id, name: s.name }); return; }
      matched.push(s.id);
      if (found.price !== s.price) {
        diffs.push({ id: s.id, name: s.name, old: s.price, new: found.price });
      }
    });
    // новые услуги на Dikidi, которых нет в БД
    const fresh = parsed.filter((p) =>
      !DATA.services.some((s) =>
        (s.dikidiId && String(s.dikidiId) === p.dikidiId) ||
        normalizeName(s.name) === normalizeName(p.name)));
    res.json({ ok: true, found: parsed.length, diffs, fresh, unmatched });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
});

// применить выбранные изменения цен (запоминаем dikidiId для будущих сверок)
app.post('/api/admin/apply-dikidi', guard, (req, res) => {
  const { updates } = req.body || {}; // [{ id, new, dikidiId? }]
  (updates || []).forEach((u) => {
    const s = DATA.services.find((x) => x.id === u.id);
    if (s) {
      s.price = u.new;
      if (u.dikidiId) s.dikidiId = String(u.dikidiId);
    }
  });
  saveData(DATA);
  res.json({ ok: true, services: DATA.services });
});

// импортировать новые услуги с Dikidi в прайс
app.post('/api/admin/import-dikidi', guard, (req, res) => {
  const { items } = req.body || {}; // [{ dikidiId, name, price, duration, category, desc }]
  const catByName = { 'маникюр': 'nails', 'педикюр': 'pedi', 'ресницы': 'lashes', 'брови': 'brows' };
  let added = 0;
  (items || []).forEach((it) => {
    const dup = DATA.services.some((s) =>
      (s.dikidiId && String(s.dikidiId) === String(it.dikidiId)) ||
      normalizeName(s.name) === normalizeName(it.name));
    if (dup) return;
    const catKey = normalizeName(it.category || '');
    const cat = Object.keys(catByName).find((k) => catKey.includes(k));
    DATA.services.push({
      id: 's' + Date.now() + '_' + added,
      cat: cat ? catByName[cat] : 'extra',
      name: it.name, desc: it.desc || '',
      price: it.price, duration: it.duration || '',
      dikidiId: String(it.dikidiId || ''),
    });
    added++;
  });
  saveData(DATA);
  res.json({ ok: true, added, services: DATA.services });
});

/* ---------- заглушка SPA: любой не-API путь отдаём index.html ---------- */
app.get(/^\/(?!api\/|uploads\/).*/, (req, res, next) => {
  const f = path.join(ROOT, 'index.html');
  if (fs.existsSync(f)) return res.sendFile(f);
  next();
});

/* ---------- старт ---------- */
app.listen(PORT, () => {
  console.log(`ПроБьюти · сервер запущен: http://localhost:${PORT}`);
  // console.log(`Админ-логин: ... / пароль по умолчанию: ...`); // скрыто: не выводить учётные данные в логи
});

