/* ============================================================
   admin.js — личный кабинет администратора.
   Открывается по кнопке 🔒 в футере. Вход — серверный
   (POST /api/admin/login, JWT-токен в sessionStorage).
   Все мутации идут через серверный API (store.js: SalonAPI).
   ============================================================ */

let adminEl = null;

/* ---------- точка входа ---------- */
function initAdmin() {
  document.getElementById('admin-trigger')?.addEventListener('click', openAdmin);
  ensureAdminDom();
}

function ensureAdminDom() {
  if (adminEl) return;
  adminEl = document.createElement('div');
  adminEl.className = 'admin';
  adminEl.innerHTML = `
    <div class="admin__backdrop" data-close></div>
    <div class="admin__panel" role="dialog" aria-modal="true" aria-label="Кабинет администратора">
      <header class="admin__head">
        <h2 class="admin__title">Кабинет администратора</h2>
        <button class="admin__close" data-close aria-label="Закрыть">✕</button>
      </header>
      <div class="admin__body" id="admin-body"></div>
    </div>`;
  document.body.appendChild(adminEl);
  adminEl.querySelectorAll('[data-close]').forEach((b) =>
    b.addEventListener('click', closeAdmin));
}

function openAdmin() {
  ensureAdminDom();
  adminEl.classList.add('open');
  document.body.style.overflow = 'hidden';
  renderAdmin();
}
function closeAdmin() {
  adminEl?.classList.remove('open');
  document.body.style.overflow = '';
}

function isLoggedIn() { return SalonAPI.isLoggedIn(); }
async function doLogout() { await SalonAPI.logout(); closeAdmin(); }

/* Глобальный хук: если сервер отклонил токен — выкидываем на экран входа */
window.onUnauthorized = function () {
  const body = document.getElementById('admin-body');
  if (adminEl && adminEl.classList.contains('open') && body) renderLogin(body);
};

/* ---------- роутер экранов ---------- */
function renderAdmin() {
  const body = document.getElementById('admin-body');
  if (!body) return;
  if (!isLoggedIn()) { renderLogin(body); return; }
  renderDashboard(body);
}

/* ================= ЭКРАН ВХОДА ================= */
function renderLogin(body) {
  body.innerHTML = `
    <p class="admin__hint">Введите пароль администратора (серверная проверка)</p>
    <form class="admin-form" id="admin-login-form">
      <input class="admin-input" type="password" id="admin-pass" placeholder="Пароль" autocomplete="current-password">
      <button class="admin-btn admin-btn--primary" type="submit">Войти</button>
    </form>
    <p class="admin__hint admin__hint--muted">Логин по умолчанию: <code>admin</code>, пароль: <code>probyuti2026</code> — смените его в разделе «Настройки».</p>`;
  document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('admin-pass');
    const val = input.value;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Входим…';
    try {
      const ok = await SalonAPI.login(val);
      if (ok) { renderAdmin(); }
      else {
        input.value = '';
        input.style.borderColor = 'var(--accent)';
      }
    } catch (err) {
      input.value = '';
      input.style.borderColor = 'var(--accent)';
      input.placeholder = 'Сервер недоступен — попробуйте позже';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Войти';
    }
  });
}

/* ================= ГЛАВНЫЙ ЭКРАН ================= */
function renderDashboard(body) {
  body.innerHTML = `
    <nav class="admin-tabs" id="admin-tabs">
      <button class="admin-tab active" data-tab="photos" type="button">🖼️ Фото</button>
      <button class="admin-tab" data-tab="services" type="button">✂️ Услуги &amp; цены</button>
      <button class="admin-tab" data-tab="hours" type="button">🕐 Часы</button>
      <button class="admin-tab" data-tab="settings" type="button">⚙️ Настройки</button>
    </nav>
    <div class="admin-tabpane active" data-pane="photos"></div>
    <div class="admin-tabpane" data-pane="services"></div>
    <div class="admin-tabpane" data-pane="hours"></div>
    <div class="admin-tabpane" data-pane="settings"></div>
    <footer class="admin-foot">
      <button class="admin-btn" id="admin-logout" type="button">Выйти</button>
      <span class="admin-save-hint" id="admin-save-hint"></span>
    </footer>`;

  document.getElementById('admin-tabs').querySelectorAll('.admin-tab').forEach((t) => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach((x) => x.classList.toggle('active', x === t));
      document.querySelectorAll('.admin-tabpane').forEach((p) =>
        p.classList.toggle('active', p.dataset.pane === t.dataset.tab));
    });
  });
  document.getElementById('admin-logout').addEventListener('click', doLogout);

  renderPhotosPane(document.querySelector('[data-pane="photos"]'));
  renderServicesPane(document.querySelector('[data-pane="services"]'));
  renderHoursPane(document.querySelector('[data-pane="hours"]'));
  renderSettingsPane(document.querySelector('[data-pane="settings"]'));
}


/* ================= ВКЛАДКА: ФОТО ================= */
function renderPhotosPane(pane) {
  pane.innerHTML = `
    <div class="gal-admin">
      <div class="gal-admin__cats" id="gal-admin-cats">
        ${GAL_CATS.map((c) => `
          <button class="gal-admin__cat" data-cat="${c.id}" type="button">
            <span>${c.icon}</span> ${c.name}
          </button>`).join('')}
      </div>
      <div class="gal-admin__editor" id="gal-admin-editor"></div>
    </div>`;

  pane.querySelectorAll('.gal-admin__cat').forEach((b) => {
    b.addEventListener('click', () => {
      pane.querySelectorAll('.gal-admin__cat').forEach((x) => x.classList.toggle('active', x === b));
      renderPhotoEditor(b.dataset.cat);
    });
  });
  pane.querySelector('.gal-admin__cat').classList.add('active');
  renderPhotoEditor(GAL_CATS[0].id);
}

function renderPhotoEditor(cat) {
  const ed = document.getElementById('gal-admin-editor');
  if (!ed) return;
  const photos = STORE.gallery[cat] || [];
  ed.innerHTML = `
    <form class="admin-form admin-form--row" id="photo-add-form">
      <input class="admin-input" id="photo-url" type="url" placeholder="Ссылка на фото (https://…)" required>
      <button class="admin-btn admin-btn--primary" type="submit">Добавить</button>
    </form>
    <label class="admin-upload">
      <input type="file" id="photo-file" accept="image/*" hidden>
      <span class="admin-upload__label">📤 Загрузить с устройства</span>
    </label>
    <p class="admin__hint admin__hint--muted">Файлы с устройства сохраняются на сервер (db/uploads) и переживают перезагрузку. Ссылки — на внешние фото.</p>
    <div class="photo-grid">
      ${photos.length ? photos.map((src, i) => `
        <div class="photo-thumb">
          <img src="${src}" alt="" loading="lazy" referrerpolicy="no-referrer">
          <button class="photo-thumb__del" data-idx="${i}" type="button" aria-label="Удалить">✕</button>
        </div>`).join('')
        : '<p class="admin__hint">Фото пока нет.</p>'}
    </div>`;

  document.getElementById('photo-add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const urlEl = document.getElementById('photo-url');
    const url = urlEl.value.trim();
    if (!url) return;
    urlEl.value = '';
    try {
      await SalonAPI.addPhoto(cat, url);
    } catch (err) {
      showPhotoErr(ed, 'Не удалось сохранить фото: ' + err.message);
    }
    renderPhotoEditor(cat);
    renderGalleryChips();
    renderGallery();
    flashSaved();
  });

  document.getElementById('photo-file').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        // сервер сохранит файл в db/uploads и вернёт /uploads/…
        const src = await SalonAPI.uploadPhoto(cat, reader.result);
        if (!STORE.gallery[cat]) STORE.gallery[cat] = [];
        if (src && !STORE.gallery[cat].includes(src)) STORE.gallery[cat].push(src);
        renderPhotoEditor(cat);
        renderGalleryChips();
        renderGallery();
        flashSaved();
      } catch (err) {
        showPhotoErr(ed, 'Не удалось загрузить файл: ' + err.message);
      }
    };
    reader.readAsDataURL(file);
  });

  ed.querySelectorAll('.photo-thumb__del').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await SalonAPI.removePhoto(cat, +btn.dataset.idx);
      } catch (err) {
        showPhotoErr(ed, 'Не удалось удалить фото: ' + err.message);
      }
      renderPhotoEditor(cat);
      renderGalleryChips();
      renderGallery();
      flashSaved();
    });
  });
}

function showPhotoErr(ed, msg) {
  let el = ed.querySelector('.photo-err');
  if (!el) {
    el = document.createElement('p');
    el.className = 'admin__hint photo-err';
    el.style.color = 'var(--accent)';
    ed.appendChild(el);
  }
  el.textContent = msg;
}

/* ================= ВКЛАДКА: УСЛУГИ & ЦЕНЫ ================= */
const CAT_OPTIONS = [
  { id: 'nails',  name: 'Маникюр' },
  { id: 'pedi',   name: 'Педикюр' },
  { id: 'lashes', name: 'Ресницы' },
  { id: 'brows',  name: 'Брови' },
  { id: 'extra',  name: 'Прочее' },
];

function renderServicesPane(pane) {
  const rows = STORE.services.map((s, i) => `
    <div class="svc-row" data-idx="${i}">
      <input class="admin-input svc-row__name" value="${escAttr(s.name)}" placeholder="Название">
      <select class="admin-input svc-row__cat">
        ${CAT_OPTIONS.map((c) => `<option value="${c.id}" ${c.id === s.cat ? 'selected' : ''}>${c.name}</option>`).join('')}
      </select>
      <input class="admin-input svc-row__price" type="number" inputmode="numeric" value="${s.price != null ? s.price : ''}" placeholder="Цена ₽">
      <input class="admin-input svc-row__disc" type="number" inputmode="numeric" min="0" max="90" value="${s.discount ? s.discount : ''}" placeholder="Скидка %" title="Скидка на услугу, %">
      <input class="admin-input svc-row__dur" value="${escAttr(s.duration || '')}" placeholder="Длит. (напр. 2 ч)">
      <button class="icon-btn icon-btn--del svc-row__del" data-idx="${i}" type="button" title="Удалить">🗑</button>
    </div>`).join('');

  pane.innerHTML = `
    <p class="admin__hint">Редактируйте цены, скидки и названия прямо в полях — сохраняется автоматически.</p>
    <div class="svc-head">
      <span>Название</span><span>Категория</span><span>Цена</span><span>Скидка</span><span>Длит.</span><span></span>
    </div>
    <div id="svc-list">${rows}</div>
    <button class="admin-btn admin-btn--primary" id="svc-add" type="button">＋ Добавить услугу</button>
    <hr class="admin-sep">
    <div class="admin-form">
      <label class="admin-label">Синхронизация цен с Dikidi</label>
      <p class="admin__hint admin__hint--muted">Сервер спарсит актуальный прайс с Dikidi и покажет расхождения с текущими ценами. Вы сами выберете, какие применить.</p>
      <button class="admin-btn" id="dikidi-parse" type="button">🔄 Спарсить цены с Dikidi</button>
      <div id="dikidi-result"></div>
    </div>`;

  const list = document.getElementById('svc-list');
  list.addEventListener('input', (e) => {
    const row = e.target.closest('.svc-row');
    if (!row) return;
    const i = +row.dataset.idx;
    const svc = { ...STORE.services[i] };
    svc.name = row.querySelector('.svc-row__name').value;
    svc.cat = row.querySelector('.svc-row__cat').value;
    svc.duration = row.querySelector('.svc-row__dur').value || undefined;
    const priceVal = row.querySelector('.svc-row__price').value;
    if (priceVal === '') { delete svc.price; } else { svc.price = +priceVal; }
    const discEl = row.querySelector('.svc-row__disc');
    if (discEl && discEl.value !== '') {
      svc.discount = Math.max(0, Math.min(90, Math.round(+discEl.value || 0)));
    } else { delete svc.discount; }
    SalonAPI.updateService(i, svc);
    refreshPublic();
    flashSaved();
  });
  list.addEventListener('click', (e) => {
    const del = e.target.closest('.svc-row__del');
    if (!del) return;
    SalonAPI.removeService(+del.dataset.idx);
    renderServicesPane(pane);
    refreshPublic();
    flashSaved();
  });
  document.getElementById('svc-add').addEventListener('click', () => {
    SalonAPI.addService({ cat: 'nails', name: 'Новая услуга', desc: '', price: 1000, duration: '' });
    renderServicesPane(pane);
    refreshPublic();
    flashSaved();
  });
  document.getElementById('dikidi-parse').addEventListener('click', onParseDikidi);
}

/* ---------- парсинг цен с Dikidi ---------- */
async function onParseDikidi() {
  const box = document.getElementById('dikidi-result');
  const btn = document.getElementById('dikidi-parse');
  if (!box || !btn) return;
  btn.disabled = true;
  btn.textContent = 'Парсим Dikidi…';
  box.innerHTML = '<p class="admin__hint">Запрашиваем актуальный прайс…</p>';
  try {
    const res = await SalonAPI.parseDikidi();
    const diffs = (res && res.diffs) || [];
    const fresh = (res && res.fresh) || [];
    const unmatched = (res && res.unmatched) || [];
    if (!diffs.length && !fresh.length) {
      box.innerHTML = `<p class="admin__hint">✓ Расхождений нет — цены актуальны (услуг на Dikidi: ${res.found}, в базе: ${STORE.services.length}).</p>` +
        (unmatched.length ? `<p class="admin__hint admin__hint--muted">Не найдено на Dikidi: ${unmatched.map((u) => escAttr(u.name)).join(', ')}</p>` : '');
    } else {
      let htmlOut = '';
      if (diffs.length) {
        htmlOut += `
        <p class="admin__hint">Расхождений цен: <b>${diffs.length}</b> (услуг на Dikidi: ${res.found}). Отметьте, какие применить:</p>
        <div class="dikidi-list">
          ${diffs.map((d, i) => `
            <label class="dikidi-row">
              <input type="checkbox" data-i="${i}" checked>
              <span class="dikidi-row__name">${escAttr(d.name)}</span>
              <span class="dikidi-row__old">${d.old} ₽</span>
              <span class="dikidi-row__arrow">→</span>
              <span class="dikidi-row__new">${d.new} ₽</span>
            </label>`).join('')}
        </div>
        <button class="admin-btn admin-btn--primary" id="dikidi-apply" type="button">Применить выбранные цены</button>`;
      }
      if (fresh.length) {
        htmlOut += `
        <p class="admin__hint" style="margin-top:14px">Новых услуг на Dikidi (нет в базе): <b>${fresh.length}</b>:</p>
        <div class="dikidi-list">
          ${fresh.map((f, i) => `
            <label class="dikidi-row">
              <input type="checkbox" data-fresh="${i}" checked>
              <span class="dikidi-row__name">${escAttr(f.name)} <small style="color:var(--muted)">· ${escAttr(f.category || '')}</small></span>
              <span class="dikidi-row__arrow">+</span>
              <span class="dikidi-row__new">${f.price} ₽</span>
            </label>`).join('')}
        </div>
        <button class="admin-btn" id="dikidi-import" type="button">Импортировать выбранные</button>`;
      }
      if (unmatched.length) {
        htmlOut += `<p class="admin__hint admin__hint--muted" style="margin-top:10px">Не найдено на Dikidi: ${unmatched.map((u) => escAttr(u.name)).join(', ')}</p>`;
      }
      box.innerHTML = htmlOut;
      window.__dikidiDiffs = diffs;
      window.__dikidiFresh = fresh;
      document.getElementById('dikidi-apply')?.addEventListener('click', async () => {
        const checks = box.querySelectorAll('.dikidi-row input[type="checkbox"][data-i]:checked');
        const updates = Array.from(checks).map((c) => {
          const d = window.__dikidiDiffs[+c.dataset.i];
          return { id: d.id, new: d.new };
        });
        if (!updates.length) return;
        const applyBtn = document.getElementById('dikidi-apply');
        applyBtn.disabled = true;
        applyBtn.textContent = 'Применяем…';
        await SalonAPI.applyDikidi(updates);
        refreshPublic();
        flashSaved();
        const pane = document.querySelector('[data-pane="services"]');
        if (pane) renderServicesPane(pane);
      });
      document.getElementById('dikidi-import')?.addEventListener('click', async () => {
        const checks = box.querySelectorAll('.dikidi-row input[type="checkbox"][data-fresh]:checked');
        const items = Array.from(checks).map((c) => window.__dikidiFresh[+c.dataset.fresh]);
        if (!items.length) return;
        const impBtn = document.getElementById('dikidi-import');
        impBtn.disabled = true;
        impBtn.textContent = 'Импортируем…';
        await SalonAPI.importDikidi(items);
        refreshPublic();
        flashSaved();
        const pane = document.querySelector('[data-pane="services"]');
        if (pane) renderServicesPane(pane);
      });
    }
  } catch (err) {
    box.innerHTML = `<p class="admin__hint" style="color:var(--accent)">Не удалось спарсить: ${escAttr(err.message)}</p>`;
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 Спарсить цены с Dikidi';
  }
}

/* ---------- пере-отрисовка публичной части после правок ---------- */
function refreshPublic() {
  applyStateToSite();
  if (typeof renderServices === 'function') renderServices();
  if (typeof renderGalleryChips === 'function') renderGalleryChips();
  if (typeof renderGallery === 'function') renderGallery();
}

/* Индикатор «✓ Сохранено» в футере админки */
let flashTimer = null;
function flashSaved() {
  const el = document.getElementById('admin-save-hint');
  if (!el) return;
  el.textContent = '✓ Сохранено';
  el.classList.add('ok');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    el.textContent = '';
    el.classList.remove('ok');
  }, 2000);
}

/* ---------- экранирование для вставки в value="…" ---------- */
function escAttr(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ================= ВКЛАДКА: ЧАСЫ ================= */
function renderHoursPane(pane) {
  const h = STORE.salon.hours || {};
  pane.innerHTML = `
    <div class="admin-form">
      <label class="admin-label">Будни (Пн–Пт)</label>
      <div class="admin-form--row">
        <input class="admin-input" id="h-wd-from" type="time" value="${h.weekdays?.from || '10:00'}">
        <span class="admin__hint">—</span>
        <input class="admin-input" id="h-wd-to" type="time" value="${h.weekdays?.to || '20:00'}">
      </div>
      <label class="admin-label">Выходные (Сб–Вс)</label>
      <div class="admin-form--row">
        <input class="admin-input" id="h-we-from" type="time" value="${h.weekend?.from || '10:00'}">
        <span class="admin__hint">—</span>
        <input class="admin-input" id="h-we-to" type="time" value="${h.weekend?.to || '18:00'}">
      </div>
      <button class="admin-btn admin-btn--primary" id="h-save" type="button">Сохранить часы</button>
    </div>`;
  document.getElementById('h-save').addEventListener('click', () => {
    SalonAPI.updateHours({
      weekdays: { from: document.getElementById('h-wd-from').value, to: document.getElementById('h-wd-to').value },
      weekend:  { from: document.getElementById('h-we-from').value, to: document.getElementById('h-we-to').value },
    });
    applyStateToSite();
    flashSaved();
  });
}

/* ================= ВКЛАДКА: НАСТРОЙКИ ================= */
function renderSettingsPane(pane) {
  const s = STORE.salon;
  pane.innerHTML = `
    <div class="admin-form">
      <label class="admin-label">Телефон (для показа)</label>
      <input class="admin-input" id="s-phone" value="${escAttr(s.phone)}">
      <label class="admin-label">Телефон (для звонка, формат +7…)</label>
      <input class="admin-input" id="s-phone-href" value="${escAttr(s.phoneHref)}">
      <label class="admin-label">Адрес</label>
      <input class="admin-input" id="s-address" value="${escAttr(s.address)}">
      <label class="admin-label">Ссылка на онлайн-запись</label>
      <input class="admin-input" id="s-booking" value="${escAttr(s.bookingUrl)}">
      <button class="admin-btn admin-btn--primary" id="s-save" type="button">Сохранить настройки</button>
    </div>
    <hr class="admin-sep">
    <div class="admin-form">
      <label class="admin-label">Сменить пароль администратора</label>
      <input class="admin-input" id="s-pass-old" type="password" placeholder="Текущий пароль" autocomplete="current-password">
      <input class="admin-input" id="s-pass" type="text" placeholder="Новый пароль">
      <button class="admin-btn" id="s-pass-save" type="button">Сохранить пароль</button>
    </div>
    <hr class="admin-sep">
    <button class="admin-btn admin-btn--danger" id="s-reset" type="button">Сбросить всё к заводским настройкам</button>`;

  document.getElementById('s-save').addEventListener('click', () => {
    SalonAPI.updateSalon({
      phone: document.getElementById('s-phone').value,
      phoneHref: document.getElementById('s-phone-href').value,
      address: document.getElementById('s-address').value,
      bookingUrl: document.getElementById('s-booking').value,
    });
    applyStateToSite();
    flashSaved();
  });
  document.getElementById('s-pass-save').addEventListener('click', async () => {
    const oldP = (document.getElementById('s-pass-old') || {}).value || '';
    const p = document.getElementById('s-pass').value.trim();
    if (!p) return;
    const btn = document.getElementById('s-pass-save');
    btn.disabled = true;
    try {
      await SalonAPI.changePassword(oldP, p);
      document.getElementById('s-pass').value = '';
      if (document.getElementById('s-pass-old')) document.getElementById('s-pass-old').value = '';
      flashSaved();
    } catch (err) {
      alert('Не удалось сменить пароль: ' + err.message);
    } finally {
      btn.disabled = false;
    }
  });
  document.getElementById('s-reset').addEventListener('click', async () => {
    if (confirm('Сбросить все услуги, фото и настройки к исходным?')) {
      await SalonAPI.reset();
      applyStateToSite();
      refreshPublic();
      renderDashboard(document.getElementById('admin-body'));
      flashSaved();
    }
  });
}


