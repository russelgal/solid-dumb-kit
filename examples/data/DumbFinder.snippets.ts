// Сниппеты доки к примеру DumbFinder.
//
// Отдельный файл, потому что подсветка считается НА СБОРКЕ: плагин
// playground/snippets.ts выполняет этот модуль в Node, гонит каждую строку
// через Shiki и подменяет экспорт на { code, html }. Отсюда два требования: в
// файле только строки и ни одного импорта.
export default {
  install: 'pnpm add @solid-dumb-kit/finder',

  basic: [
    "import { DumbFinder, createS3Source } from '@solid-dumb-kit/finder'",
    '',
    '// Источник — это и есть весь договор с хранилищем. Готовые: S3, WebDAV,',
    '// HTTP-ручки, локальная папка через Node, память (для тестов и демо).',
    'const source = createS3Source({',
    '  bucket: import.meta.env.VITE_BUCKET,',
    '  endpoint: import.meta.env.VITE_S3,',
    '  sign: (op) => fetch(`/api/s3-sign?op=${op}`).then((r) => r.json()),',
    '})',
    '',
    '<DumbFinder source={source} rootLabel="Файлы" height="70vh" />',
  ].join('\n'),

  source: [
    '// Свой источник — пять функций, и все, кроме list, необязательны:',
    '// нет remove — нет удаления, нет upload — нет ни кнопки, ни приёма броском.',
    'const source: FinderSource = {',
    '  // ТОЛЬКО прямое содержимое папки: рекурсию файндер не просит никогда,',
    '  // а десять тысяч ключей одним списком подвесят вкладку',
    '  list: async (prefix, { signal }) => {',
    '    const r = await fetch(`/api/files?prefix=${prefix}`, { signal })',
    '    return r.json()',
    '  },',
    '',
    '  // все папки разом — дерево слева строится целиком с первого вздоха;',
    '  // не задан — дерево грузится по веткам',
    '  tree: async ({ signal }) => (await fetch("/api/folders", { signal })).json(),',
    '',
    '  upload: myUploader,',
    '  remove: (keys) => api.remove(keys),',
    '  move: (keys, toPrefix) => api.move(keys, toPrefix),',
    '  mkdir: (prefix) => api.mkdir(prefix),',
    '}',
  ].join('\n'),

  controlled: [
    '// По умолчанию файндер водит себя сам. Но путь, выделение и вид можно',
    '// поднять наружу — например, чтобы держать папку в адресе страницы.',
    '<DumbFinder',
    '  source={source}',
    '  path={path()}',
    '  onPathChange={setPath}',
    '  selected={selected()}',
    '  onSelectionChange={setSelected}',
    '  view={view()}',
    '  onViewChange={setView}',
    '/>',
  ].join('\n'),

  look: [
    '// Значки — CSS-КЛАССЫ, а не разметка: набор выбирает потребитель, и его же',
    '// Tailwind собирает из этих строк. Не задан — рисуются эмодзи, чтобы пакет',
    '// работал и без иконочного набора вовсе.',
    '<DumbFinder',
    '  source={source}',
    '  icons={{',
    "    dir: 'icon-[solar--folder-bold]',",
    "    dirOpen: 'icon-[solar--folder-open-bold]',",
    "    image: 'icon-[solar--gallery-bold]',",
    "    upload: 'icon-[solar--upload-bold]',",
    '  }}',
    '  tile="minmax(150px, 1fr)"',
    '  sidebar',
    '  sidebarWidth="240px"',
    '  treeKey="files-tree"',
    '  accept="image/*"',
    '  concurrency={4}',
    '/>',
  ].join('\n'),
}

/** язык там, где это не tsx */
export const langs = { install: 'sh' }
