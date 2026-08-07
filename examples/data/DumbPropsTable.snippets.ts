// Сниппеты доки к примеру DumbPropsTable.
//
// Отдельный файл, потому что подсветка считается НА СБОРКЕ: плагин
// playground/snippets.ts выполняет этот модуль в Node, гонит каждую строку
// через Shiki и подменяет экспорт на { code, html }. Отсюда два требования: в
// файле только строки и ни одного импорта.
export default {
  install: 'pnpm add @solid-dumb-kit/props-table',

  basic: [
    "import { DumbPropsTable } from '@solid-dumb-kit/props-table'",
    '',
    '// Отладочная панель: имя, тип и значение КАЖДОГО пропа, включая функции.',
    'export function MyWidget(props: MyWidgetProps) {',
    '  return (',
    '    <>',
    '      <Show when={import.meta.env.DEV}>',
    '        <DumbPropsTable value={props} title="MyWidget" />',
    '      </Show>',
    '      …',
    '    </>',
    '  )',
    '}',
  ].join('\n'),

  options: [
    '// Вложенные объекты разворачиваются и идут ПЕРВЫМИ: в них обычно и кроется',
    '// причина «почему не работает». Массивы показываются первыми элементами',
    '// и счётчиком — дамп двух тысяч броней никому не нужен.',
    '<DumbPropsTable',
    '  value={props}',
    '  depth={2}                  // насколько глубоко разворачивать; 0 — не разворачивать',
    '  maxItems={5}               // сколько элементов массива показывать',
    "  skip={['rows', 'spans']}   // не раскрывать эти ключи вовсе",
    '  indent={12}',
    '  headless                   // без шапки: в узкой панели она только занимает строку',
    '/>',
  ].join('\n'),

  dump: [
    "import { dumpProps } from '@solid-dumb-kit/props-table'",
    '',
    '// Тот же разбор без разметки и без Solid — годится в тестах и в логе.',
    'console.table(dumpProps(props, { depth: 2 }))',
    '',
    '// каждая строка: { path, name, type, value, kind, depth }',
    "// kind — object | array | function | primitive, по нему панель и красит",
  ].join('\n'),
}

/** язык там, где это не tsx */
export const langs = { install: 'sh' }
