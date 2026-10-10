/* ============================================================
   gallery.js — публичная галерея работ по категориям услуг.
   Данные берутся из STORE.gallery (store.js). Лайтбокс —
   нативный <dialog>, доступен с клавиатуры.
   ============================================================ */

const GAL_CATS = [
  { id: 'nails',  name: 'Маникюр',  icon: '💅' },
  { id: 'pedi',   name: 'Педикюр',  icon: '🦶' },
  { id: 'lashes', name: 'Ресницы',  icon: '👁️' },
  { id: 'brows',  name: 'Брови',    icon: '✨' },
];

let galCat = 'nails';

function renderGalleryChips() {
  const wrap = document.getElementById('gallery-chips');
  if (!wrap) return;
  wrap.innerHTML = GAL_CATS.map((c) => {
    const count = (STORE.gallery[c.id] || []).length;
    const active = c.id === galCat ? ' active' : '';
    return `<button class="gchip${active}" data-cat="${c.id}" type="button">
      <span class="gchip__icon">${c.icon}</span>${c.name}
      <span class="gchip__count">${count}</span>
    </button>`;
  }).join('');
  wrap.querySelectorAll('.gchip').forEach((b) => {
    b.addEventListener('click', () => {
      galCat = b.dataset.cat;
      renderGalleryChips();
      renderGallery();
    });
  });
}

function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;
  const photos = STORE.gallery[galCat] || [];

  if (!photos.length) {
    grid.innerHTML = `<div class="gallery-empty">
      <span class="gallery-empty__icon">🖼️</span>
      Пока нет фото в этой категории.<br>Загляните позже!
    </div>`;
    return;
  }

  grid.innerHTML = photos.map((src, i) => `
    <button class="gitem" data-src="${src}" data-idx="${i}" type="button"
            style="animation-delay:${Math.min(i, 10) * 45}ms">
      <img src="${src}" alt="Работа: ${galCat}" loading="lazy" decoding="async" referrerpolicy="no-referrer">
      <span class="gitem__zoom" aria-hidden="true">⤢</span>
    </button>`).join('');

  grid.querySelectorAll('.gitem').forEach((el) => {
    el.addEventListener('click', () => openLightbox(el.dataset.src));
  });
}

/* ---------- лайтбокс ---------- */
let lbDialog = null;
let lbIndex = 0;
let lbList = [];

function ensureLightbox() {
  if (lbDialog) return lbDialog;
  lbDialog = document.createElement('dialog');
  lbDialog.className = 'lightbox';
  lbDialog.innerHTML = `
    <button class="lightbox__close" aria-label="Закрыть">✕</button>
    <button class="lightbox__nav lightbox__nav--prev" aria-label="Назад">‹</button>
    <img class="lightbox__img" alt="">
    <button class="lightbox__nav lightbox__nav--next" aria-label="Вперёд">›</button>`;
  document.body.appendChild(lbDialog);
  lbDialog.querySelector('.lightbox__close').addEventListener('click', () => lbDialog.close());
  lbDialog.querySelector('.lightbox__nav--prev').addEventListener('click', () => stepLightbox(-1));
  lbDialog.querySelector('.lightbox__nav--next').addEventListener('click', () => stepLightbox(1));
  lbDialog.addEventListener('click', (e) => { if (e.target === lbDialog) lbDialog.close(); });
  return lbDialog;
}

function openLightbox(src) {
  lbList = (STORE.gallery[galCat] || []).slice();
  lbIndex = Math.max(0, lbList.indexOf(src));
  const d = ensureLightbox();
  d.querySelector('.lightbox__img').src = src;
  const multi = lbList.length > 1;
  d.querySelector('.lightbox__nav--prev').style.display = multi ? '' : 'none';
  d.querySelector('.lightbox__nav--next').style.display = multi ? '' : 'none';
  if (d.showModal) d.showModal(); else d.setAttribute('open', '');
}

function stepLightbox(dir) {
  if (lbList.length < 2) return;
  lbIndex = (lbIndex + dir + lbList.length) % lbList.length;
  lbDialog.querySelector('.lightbox__img').src = lbList[lbIndex];
}

function initGallery() {
  renderGalleryChips();
  renderGallery();
}
