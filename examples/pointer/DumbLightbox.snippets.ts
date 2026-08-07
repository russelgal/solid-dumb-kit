// Сниппеты доки к примеру DumbLightbox.
//
// Отдельный файл, потому что подсветка считается НА СБОРКЕ: плагин
// playground/snippets.ts выполняет этот модуль в Node, гонит каждую строку
// через Shiki и подменяет экспорт на { code, html }. Отсюда два требования: в
// файле только строки и ни одного импорта.
export default {
  install: 'pnpm add @solid-dumb-kit/lightbox',

  basic: [
    "import { createSignal } from 'solid-js'",
    "import { DumbLightbox } from '@solid-dumb-kit/lightbox'",
    '',
    'const SHOTS = [',
    "  { url: '/img/1-big.jpg', preview: '/img/1-small.jpg', title: 'Кухня' },",
    "  { url: '/img/2-big.jpg', preview: '/img/2-small.jpg', title: 'Спальня' },",
    ']',
    '',
    'export default function Gallery() {',
    '  // что открыто; null — просмотрщик закрыт',
    '  const [shown, setShown] = createSignal<number | null>(null)',
    '',
    '  return (',
    '    <>',
    '      <For each={SHOTS}>',
    '        {(s, i) => (',
    '          <button onClick={() => setShown(i())}>',
    '            <img src={s.preview} alt={s.title} />',
    '          </button>',
    '        )}',
    '      </For>',
    '',
    '      <DumbLightbox items={SHOTS} index={shown} onIndexChange={setShown} />',
    '    </>',
    '  )',
    '}',
  ].join('\n'),

  preview: [
    '// preview — мелкая версия: показывается, пока грузится большая, поэтому',
    '// открытие не даёт пустого экрана даже на медленном канале. Соседние',
    '// картинки (одна вперёд, одна назад) кит подгружает сам, через new Image().',
    'const items = photos.map((p) => ({',
    '  url: full(p),      // 1600px',
    '  preview: thumb(p), // 320px, тот же кадр',
    '  title: p.name,',
    '}))',
  ].join('\n'),

  actions: [
    '// свой низ: скачать, удалить, поделиться. Функция получает то, что сейчас',
    '// открыто, — кнопки могут зависеть от конкретной картинки.',
    '<DumbLightbox',
    '  items={items()}',
    '  index={shown}',
    '  onIndexChange={setShown}',
    '  actions={(item, i) => (',
    '    <>',
    '      <a class="btn btn-sm" href={item.url} download>',
    '        Скачать',
    '      </a>',
    '      <button class="btn btn-sm btn-error" onClick={() => remove(i)}>',
    '        Удалить',
    '      </button>',
    '    </>',
    '  )}',
    '/>',
  ].join('\n'),

  control: [
    '// index и onIndexChange — обычная управляемая пара, так что открыть можно',
    '// откуда угодно: из таблицы, из тоста, по ссылке в адресе',
    'const openFirst = () => setShown(0)',
    'const close = () => setShown(null)',
    '',
    '// анимацию можно выключить принудительно; по умолчанию она есть, но',
    '// молча отключается при системном prefers-reduced-motion',
    '<DumbLightbox items={items()} index={shown} onIndexChange={setShown} animate={false} />',
  ].join('\n'),
}

/** язык там, где это не tsx */
export const langs = { install: 'sh' }
