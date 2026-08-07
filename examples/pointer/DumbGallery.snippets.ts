// Сниппеты доки к примеру DumbGallery.
//
// Отдельный файл, потому что подсветка считается НА СБОРКЕ: плагин
// playground/snippets.ts выполняет этот модуль в Node, гонит каждую строку
// через Shiki и подменяет экспорт на { code, html }. Отсюда два требования: в
// файле только строки и ни одного импорта.
export default {
  install: 'pnpm add @solid-dumb-kit/gallery',

  basic: [
    "import { createSignal } from 'solid-js'",
    "import { DumbGallery, type GalleryItem } from '@solid-dumb-kit/gallery'",
    '',
    'export default function Photos() {',
    '  const [items, setItems] = createSignal<GalleryItem[]>([])',
    '',
    '  // без upload галерея локальная: файлы живут в браузере как objectURL',
    '  // и пропадут с перезагрузкой — годится для формы, где всё уходит разом',
    '  return <DumbGallery items={items()} setItems={setItems} />',
    '}',
  ].join('\n'),

  upload: [
    "import { DumbGallery, createPresignedUploader } from '@solid-dumb-kit/gallery'",
    '',
    '// Заливка по подписанной ссылке: сервер отдаёт URL, браузер кладёт файл',
    '// прямо в хранилище — трафик мимо приложения.',
    'const upload = createPresignedUploader({',
    '  sign: async (file) => {',
    "    const r = await fetch('/api/upload-url', {",
    "      method: 'POST',",
    '      body: JSON.stringify({ name: file.name, type: file.type }),',
    '    })',
    '    return r.json() // { url, key, publicUrl }',
    '  },',
    '})',
    '',
    '<DumbGallery',
    '  items={items()}',
    '  setItems={setItems}',
    '  upload={upload}',
    '  concurrency={3}   // сколько файлов тянуть одновременно',
    '  accept="image/*"',
    '  max={20}',
    '/>',
  ].join('\n'),

  look: [
    '// Раскладка — css-трек и зазор; правку можно выключить целиком.',
    '<DumbGallery',
    '  items={items()}',
    '  setItems={setItems}',
    '  tile="minmax(160px, 1fr)"',
    '  gap={12}',
    '  // editable={false} — только просмотр: ни выбора, ни перестановки, ни ✕',
    '  editable={editable()}',
    '  onOpen={(item, i) => setShown(i)}',
    '/>',
  ].join('\n'),

  custom: [
    '// Своя плитка целиком. Третьим аргументом идёт прогресс (0…1) — в items',
    '// его намеренно нет: он меняется десятки раз в секунду и перерисовывал бы',
    '// весь список.',
    '<DumbGallery items={items()} setItems={setItems} upload={upload}>',
    '  {(item, i, progress) => (',
    '    <figure class="card bg-base-200">',
    '      <img src={item.preview ?? item.url} alt={item.name} />',
    '      <figcaption class="p-2 text-sm">',
    '        {item.name}',
    "        <Show when={item.status === 'uploading'}>",
    '          <progress class="progress" value={progress()} max="1" />',
    '        </Show>',
    '      </figcaption>',
    '    </figure>',
    '  )}',
    '</DumbGallery>',
  ].join('\n'),
}

/** язык там, где это не tsx */
export const langs = { install: 'sh' }
