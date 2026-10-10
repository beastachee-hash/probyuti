'use strict';
/* ============================================================
   Хранилище ПроБьюти — несколько режимов (облако / локально).
   ------------------------------------------------------------
   ★ Яндекс.Диск (рекомендуется, бесплатно):
      YDISK_TOKEN  → и данные, и фото на Яндекс.Диске (REST API)
   Облако (платно):
      DATABASE_URL                 → PostgreSQL
      YOS_ACCESS_KEY/SECRET/BUCKET → Yandex Object Storage (S3) для фото
   Локально (без переменных):
      данные  → db/data.json
      фото    → db/uploads/

   Облачные зависимости (pg, @aws-sdk/client-s3) подгружаются
   ЛЕНИВО — локально они не нужны и могут быть не установлены.
   ============================================================ */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = __dirname;
const DB_DIR = process.env.DATA_DIR || path.join(ROOT, 'db');
const DATA_FILE = path.join(DB_DIR, 'data.json');
const UPLOAD_DIR = path.join(DB_DIR, 'uploads');

const API = 'https://cloud-api.yandex.net';

// Режимы. Самый бесплатный — задать ТОЛЬКО YDISK_TOKEN (+ ADMIN_PASSWORD).
const USE_YD = !!process.env.YDISK_TOKEN;                                   // Яндекс.Диск (бесплатно)
const USE_PG = !!process.env.DATABASE_URL;                                  // PostgreSQL (платно)
const USE_S3 = !!(process.env.YOS_ACCESS_KEY && process.env.YOS_SECRET_KEY && process.env.YOS_BUCKET); // Object Storage (платно)

const YD = {
  token: process.env.YDISK_TOKEN || '',
  // Рабочая папка на Диске. По умолчанию — обычная папка в корне Диска
  // (disk:/…), чтобы работал простой токен с Полигона (полный доступ).
  // Если у тебя токен «приложения» (доступ только к своей папке) — задай
  // в .env:  YDISK_ROOT=app://probyuti
  root: (process.env.YDISK_ROOT || 'disk:/probyuti').replace(/\/+$/, ''),
  get statePath() { return this.root + '/state.json'; },
  get galleryDir() { return this.root + '/gallery'; },
};

const YOS = {
  bucket: process.env.YOS_BUCKET || '',
  region: process.env.YOS_REGION || 'ru-central1',
  endpoint: (process.env.YOS_ENDPOINT || 'https://storage.yandexcloud.net').replace(/\/+$/, ''),
  accessKey: process.env.YOS_ACCESS_KEY || '',
  secretKey: process.env.YOS_SECRET_KEY || '',
};

console.log(`[storage] данные → ${USE_PG ? 'PostgreSQL (' + String(process.env.DATABASE_URL).replace(/\/\/.*@/, '//***@') + ')' : USE_YD ? 'Яндекс.Диск (' + YD.statePath + ')' : 'файл ' + DATA_FILE}`);
console.log(`[storage] фото   → ${USE_YD ? 'Яндекс.Диск (' + YD.galleryDir + ')' : USE_S3 ? 'Yandex Object Storage (bucket: ' + YOS.bucket + ')' : 'файл ' + UPLOAD_DIR}`);

/* ---------- Яндекс.Диск (чистый HTTP, без SDK) ---------- */
const ydHeaders = () => ({ Authorization: 'OAuth ' + YD.token });

// создаём папки (201 — создана, 409 — уже есть; оба варианта ок)
async function ydEnsureDirs() {
  for (const dir of [YD.root, YD.galleryDir]) {
    try {
      await fetch(API + '/v1/disk/resources?path=' + encodeURIComponent(dir), { method: 'PUT', headers: ydHeaders() });
    } catch (e) { /* не критично на каждый вызов */ }
  }
}

// читает файл с Диска → Buffer или null (если нет)
async function ydRead(p) {
  const meta = await fetch(API + '/v1/disk/resources/download?path=' + encodeURIComponent(p), { headers: ydHeaders() });
  if (meta.status === 404) return null;
  const j = await meta.json().catch(() => null);
  if (!j || !j.href) return null;
  const r = await fetch(j.href);
  if (!r.ok) return null;
  return Buffer.from(await r.arrayBuffer());
}

// загружает файл на Диск (перезапись)
async function ydWrite(p, buffer, contentType) {
  const up = await fetch(API + '/v1/disk/resources/upload?path=' + encodeURIComponent(p) + '&overwrite=true', { headers: ydHeaders() });
  const j = await up.json().catch(() => null);
  if (!j || !j.href) throw new Error('Яндекс.Диск: нет ссылки для загрузки');
  const r = await fetch(j.href, { method: 'PUT', headers: { 'Content-Type': contentType || 'application/octet-stream' }, body: buffer });
  if (!(r.ok || r.status === 201 || r.status === 202)) throw new Error('Яндекс.Диск: ошибка загрузки');
}

const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' };
const mimeByKey = (key) => MIME[(String(key).split('.').pop() || '').toLowerCase()] || 'application/octet-stream';

/* ---------- PostgreSQL (ленивая загрузка pg) ---------- */
let _pg = null;
async function pgClient() {
  if (_pg) return _pg;
  const { Client } = require('pg');
  _pg = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await _pg.connect();
  // одна строка с JSON-состоянием салона (миграций не нужно)
  await _pg.query(
    'CREATE TABLE IF NOT EXISTS salon_state (' +
    ' id int PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())'
  );
  return _pg;
}

/* ---------- Yandex Object Storage / S3 (ленивая загрузка aws-sdk) ---------- */
let _s3Client = null;
async function s3Client() {
  if (_s3Client) return _s3Client;
  const { S3Client } = require('@aws-sdk/client-s3');
  _s3Client = new S3Client({
    region: YOS.region,
    endpoint: YOS.endpoint,
    credentials: { accessKeyId: YOS.accessKey, secretAccessKey: YOS.secretKey },
    forcePathStyle: true,
  });
  return _s3Client;
}

async function putImage(key, buffer, contentType) {
  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
  const client = _s3Client || (await s3Client());
  await client.send(new PutObjectCommand({
    Bucket: YOS.bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    // ACL 'public-read': бакет отдаёт фото напрямую по постоянной ссылке
    ACL: 'public-read',
  }));
  return `${YOS.endpoint}/${YOS.bucket}/${key}`;
}

/* ================= публичный интерфейс ================= */

// читает состояние салона; null → сервер создаст дефолт и сохранит
async function loadData() {
  if (USE_YD) {
    const buf = await ydRead(YD.statePath);
    if (!buf) return null;
    try { return JSON.parse(buf.toString('utf8')); } catch { return null; }
  }
  if (USE_PG) {
    const db = await pgClient();
    const r = await db.query('SELECT data FROM salon_state WHERE id = 1');
    return r.rows[0] ? r.rows[0].data : null;
  }
  if (fs.existsSync(DATA_FILE)) {
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return null; }
  }
  return null;
}

async function saveData(data) {
  if (USE_YD) {
    await ydEnsureDirs();
    await ydWrite(YD.statePath, Buffer.from(JSON.stringify(data), 'utf8'), 'application/json');
    return;
  }
  if (USE_PG) {
    const db = await pgClient();
    await db.query(
      'INSERT INTO salon_state (id, data, updated_at) VALUES (1, $1::jsonb, now()) ' +
      'ON CONFLICT (id) DO UPDATE SET data = $1::jsonb, updated_at = now()',
      [JSON.stringify(data)]
    );
    return;
  }
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// принимает dataURL (base64), возвращает URL фото.
// В режиме Яндекс.Диска отдаёт стабильный локальный путь /photos/<файл>
// (байты раздаёт наш сервер из Диска — прямая ссылка Яндекса ненадёжна).
async function uploadImage(cat, dataUrl) {
  const m = String(dataUrl || '').match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
  if (!m) throw new Error('Некорректное изображение');
  const contentType = m[1];
  const ext = (m[1].split('/')[1] || 'jpg').replace(/[^a-z]/gi, '');
  const safeCat = (cat || 'misc').replace(/[^a-z]/gi, '');
  const key = `gallery/${safeCat}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.${ext}`;
  const buffer = Buffer.from(m[2], 'base64');

  if (USE_YD) {
    await ydEnsureDirs();
    await ydWrite(YD.galleryDir + '/' + path.basename(key), buffer, contentType);
    return '/photos/' + path.basename(key); // раздаёт сервер через readImage()
  }
  if (USE_S3) return putImage(key, buffer, contentType);

  // локальный режим — пишем файл, как раньше
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const fname = path.basename(key);
  fs.writeFileSync(path.join(UPLOAD_DIR, fname), buffer);
  return '/uploads/' + fname;
}

// читает фото по имени файла → { buffer, contentType } | null.
// Используется роутом /photos/:name в режиме Яндекс.Диска.
async function readImage(name) {
  const file = path.basename(String(name || '')); // защита от выхода за папку
  if (USE_YD) {
    const buf = await ydRead(YD.galleryDir + '/' + file);
    if (!buf) return null;
    return { buffer: buf, contentType: mimeByKey(file) };
  }
  const p = path.join(UPLOAD_DIR, file);
  if (!fs.existsSync(p)) return null;
  return { buffer: fs.readFileSync(p), contentType: mimeByKey(file) };
}

module.exports = {
  USE_YD, USE_PG, USE_S3, YD, YOS, DB_DIR, DATA_FILE, UPLOAD_DIR,
  loadData, saveData, uploadImage, readImage,
};
