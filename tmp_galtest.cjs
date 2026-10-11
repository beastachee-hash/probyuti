// Корректный сквозной тест — как настоящий клиент (store.js)
const BASE = 'http://127.0.0.1';
const post = (path, body, token) => fetch(BASE + path, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body),
}).then((r) => r.json());
const get = (path) => fetch(BASE + path).then((r) => r.json());

(async () => {
  const login = await post('/api/admin/login', { username: 'admin', password: 'ProByuti2026!' });
  const token = login.token;
  console.log('1. login ok:', !!token);

  // чистим мусор из nails, если он там остался от прошлого теста
  const before = await get('/api/state');
  console.log('   nails до теста:', JSON.stringify((before.gallery && before.gallery.nails) || []));

  // 2. добавляем фото через url (как store.js addPhoto)
  const url = 'https://example.com/real-photo.jpg';
  await post('/api/admin/gallery', { cat: 'nails', url }, token);

  // 3. удаляем по src=url (как store.js removePhoto, doomed=url-строка)
  await post('/api/admin/gallery/remove', { cat: 'nails', src: url }, token);

  // 4. состояние с сервера после «перезагрузки»
  const state = await get('/api/state');
  const nails = (state.gallery && state.gallery.nails) || [];
  console.log('4. nails после теста:', JSON.stringify(nails));
  const clean = nails.length === 0;
  console.log(clean ? '✅ PASS: удаление сохранилось, фото НЕ вернулось' : '⚠️ в nails остались элементы: ' + JSON.stringify(nails));
  console.log('   ключ nails присутствует:', Object.prototype.hasOwnProperty.call(state.gallery || {}, 'nails'), '| массив:', Array.isArray(state.gallery.nails));
})().catch((e) => console.error('TEST ERROR', e));
