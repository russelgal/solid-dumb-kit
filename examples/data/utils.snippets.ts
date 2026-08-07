// Сниппеты доки к примеру utils.
//
// Отдельный файл, потому что подсветка считается НА СБОРКЕ: плагин
// playground/snippets.ts выполняет этот модуль в Node, гонит каждую строку
// через Shiki и подменяет экспорт на { code, html }. Отсюда два требования: в
// файле только строки и ни одного импорта.
export default {
  install: 'pnpm add @solid-dumb-kit/utils',

  fmt: [
    "import { Rub2, Rub0, fmtNum, fmtPrice, fmtSize } from '@solid-dumb-kit/utils'",
    '',
    'Rub2(1234.5)      // 1 234,50 ₽',
    'Rub0(1234.5)      // 1 235 ₽',
    'fmtNum(1234567)   // 1 234 567',
    'fmtPrice(0)       // —   (ноль в прайсе обычно значит «нет цены»)',
    'fmtSize(1536)     // 1,5 КБ',
  ].join('\n'),

  dates: [
    "import { fmtDate, fmtDateTime, fmtTime, timeAgo } from '@solid-dumb-kit/utils'",
    '',
    'fmtDate(iso)          // 14.06.2026',
    'fmtDateTime(iso)      // 14.06.2026, 16:30',
    'fmtTime(iso)          // 16:30',
    'timeAgo(iso)          // «5 минут назад»',
    '',
    '// принимают и строку, и Date, и число — чтобы не приводить на каждом вызове',
  ].join('\n'),

  slug: [
    "import { genSlug } from '@solid-dumb-kit/utils'",
    '',
    "genSlug('Труба 1/2\" оцинкованная')  // truba-1-2-ocinkovannaya",
    '',
    '// синхронный: транслитерация лежит в самом пакете, поэтому вызов можно',
    '// делать прямо в обработчике ввода, без ожиданий',
  ].join('\n'),

  images: [
    "import { imgproxyUrl, configureImgproxy } from '@solid-dumb-kit/utils'",
    '',
    '// один раз на приложение — адреса и ключи приходят из окружения,',
    '// в пакете нет ни одного домена',
    'configureImgproxy({',
    '  baseUrl: import.meta.env.VITE_IMGPROXY,',
    '  key: import.meta.env.VITE_IMGPROXY_KEY,',
    '  salt: import.meta.env.VITE_IMGPROXY_SALT,',
    '})',
    '',
    "imgproxyUrl(src, { width: 320, height: 240, fit: 'cover', format: 'webp' })",
  ].join('\n'),

  zip: [
    "import { extractImagesFromZip } from '@solid-dumb-kit/utils'",
    '',
    '// fflate грузится ДИНАМИЧЕСКИ, внутри самой функции: приложение, которое',
    '// зипы не распаковывает, не тащит распаковщик в бандл вовсе',
    'const files = await extractImagesFromZip(file)',
    'for (const img of files) upload(img)',
  ].join('\n'),
}

/** язык там, где это не tsx */
export const langs = { install: 'sh' }
