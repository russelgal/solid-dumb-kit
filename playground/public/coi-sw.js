// Изоляция страницы (COOP/COEP) руками — ради SharedArrayBuffer.
//
// `new SharedArrayBuffer(...)` бросает, пока страница не изолирована, а
// изоляция включается ЗАГОЛОВКАМИ ответа. GitHub Pages отдаёт статику и своих
// заголовков поставить не даёт. Обход известный (им живут сборки на WASM,
// Godot и Unity): service worker перехватывает ответы и дописывает заголовки
// сам — от него браузер их принимает так же, как от сервера.
//
// Это ФАЙЛ ВИТРИНЫ, а не кита. Пакетам изоляция не нужна: `createRowIndex` без
// неё работает на копиях, просто без показа строк по ходу фильтрации.
//
// COEP выбран `credentialless`, а не `require-corp`: под `require-corp` любая
// картинка со стороннего домена без заголовка CORP просто не загрузится, и
// вкладки с галереей и файловым менеджером остались бы пустыми. Плата за
// `credentialless` — кросс-доменные запросы уходят без кук; для витрины это
// ничего не меняет. Safari его пока не понимает и остаётся без изоляции —
// тоже не беда, там просто не будет общей памяти.

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('message', (event) => {
  // страница просит уйти: снимаем регистрацию и говорим ей перезагрузиться
  if (event.data && event.data.type === 'coi-off') {
    self.registration.unregister().then(() => {
      event.source && event.source.postMessage({ type: 'coi-gone' })
    })
  }
})

self.addEventListener('fetch', (event) => {
  const request = event.request

  // Запрос из кеша навигации: трогать нельзя, иначе браузер ругается на
  // подменённый ответ и страница не восстанавливается кнопкой «назад».
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return

  event.respondWith(
    fetch(request)
      .then((response) => {
        // непрозрачный ответ (no-cors) читать и пересобирать нечем — отдаём как есть
        if (response.status === 0) return response
        const headers = new Headers(response.headers)
        headers.set('Cross-Origin-Embedder-Policy', 'credentialless')
        headers.set('Cross-Origin-Opener-Policy', 'same-origin')
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        })
      })
      .catch((error) => {
        console.error('coi-sw:', error)
        throw error
      }),
  )
})
