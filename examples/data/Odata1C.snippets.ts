// Сниппеты доки к примеру Odata1C.
//
// Отдельный файл, потому что подсветка считается НА СБОРКЕ: плагин
// playground/snippets.ts выполняет этот модуль в Node, гонит каждую строку
// через Shiki и подменяет экспорт на { code, html }. Отсюда два требования: в
// файле только строки и ни одного импорта.
export default {
  install: 'pnpm add @solid-dumb-kit/odata-1c',

  basic: [
    "import { createOdataClient } from '@solid-dumb-kit/odata-1c'",
    '',
    'const api = createOdataClient({',
    "  baseUrl: 'https://1c.example.ru/base/odata/standard.odata',",
    '  login: import.meta.env.VITE_1C_LOGIN,',
    '  password: import.meta.env.VITE_1C_PASS,',
    '  timeoutMs: 30000,',
    '})',
    '',
    '// список с фильтром и выборкой полей',
    "const { value } = await api.list('Catalog_Номенклатура', {",
    "  $select: 'Ref_Key,Description,Артикул',",
    "  $filter: `substringof(${odataString('скотч')}, Description)`,",
    '  $top: 20,',
    '})',
  ].join('\n'),

  methods: [
    '// один объект по ключу',
    "const item = await api.one('Catalog_Номенклатура', ref, 'Description,Артикул')",
    '',
    '// сколько всего — 1С не отдаёт $count, поэтому клиент считает сам',
    "const total = await api.count('Document_РеализацияТоваровУслуг', filter)",
    '',
    '// последняя страница: пролистать к концу без выкачивания всего',
    "const tail = await api.tailPage('Document_РеализацияТоваровУслуг', {",
    '  pageSize: 50,',
    '  filter,',
    '})',
    '',
    '// произвольный запрос, если готового метода не хватает',
    "await api.request('POST', 'Document_Заказ', { body: doc })",
  ].join('\n'),

  strings: [
    "import { odataString, OdataError } from '@solid-dumb-kit/odata-1c'",
    '',
    '// Экранирование строк в фильтрах — отдельная функция не для красоты:',
    "// апостроф в названии («Труба 1/2'») ломает запрос ровно так же, как",
    '// кавычка в SQL.',
    "odataString(\"Труба 1/2'\")   // 'Труба 1/2''' — апостроф удвоен",
    "const filter = `Description eq ${odataString(name)}`",
    '',
    '// Ошибки приходят типизированными: у 1С в теле лежит своё описание,',
    '// и оно куда полезнее, чем «500».',
    'try {',
    "  await api.list('Catalog_Номенклатура')",
    '} catch (e) {',
    '  if (e instanceof OdataError) toast.error(`${e.status}: ${e.message}`)',
    '}',
  ].join('\n'),
}

/** язык там, где это не tsx */
export const langs = { install: 'sh' }
