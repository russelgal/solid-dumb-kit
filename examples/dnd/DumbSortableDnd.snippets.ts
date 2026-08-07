// Сниппеты доки к примеру DumbSortableDnd.
//
// Отдельный файл, потому что подсветка считается НА СБОРКЕ: плагин
// playground/snippets.ts выполняет этот модуль в Node, гонит каждую строку
// через Shiki и подменяет экспорт на { code, html }. Отсюда два требования: в
// файле только строки и ни одного импорта.
export default {
  install: 'pnpm add @solid-dumb-kit/sortable-dnd',

  basic: [
    "import { createSignal } from 'solid-js'",
    "import { DumbSortableDnd } from '@solid-dumb-kit/sortable-dnd'",
    '',
    'export default function List() {',
    "  const [items, setItems] = createSignal([{ id: 'a', label: 'Первый' }])",
    '',
    '  return (',
    '    <div class="space-y-2">',
    '      <DumbSortableDnd items={items()} setItems={setItems} id={(x) => x.id}>',
    '        {(item) => <div class="row">{item.label}</div>}',
    '      </DumbSortableDnd>',
    '    </div>',
    '  )',
    '}',
  ].join('\n'),

  live: [
    '// setItems зовётся ПО ХОДУ жеста, на каждом шаге, а не один раз на дропе.',
    '// Так данные всё время совпадают с тем, что на экране, и ничего не теряется,',
    '// если браузер не доставит drop (а он это умеет — например, когда бросили',
    '// за пределами окна).',
    '//',
    '// Сохранять при этом надо в onEnd, иначе на каждый шаг уедет запрос.',
    '<DumbSortableDnd',
    '  items={items()}',
    '  setItems={setItems}',
    '  id={(x) => x.id}',
    '  onEnd={(from, to) => api.reorder(from, to)}',
    '  axis="grid"       // плитки вместо списка',
    '  animate={false}',
    '  disabled={busy()}',
    '/>',
  ].join('\n'),

  choose: [
    '// Нативный DnD против указательного:',
    '//',
    '//   DumbSortableDnd — HTML5 drag-and-drop. Тянется мышью и из другого окна,',
    '//                     курсор и «призрак» рисует система, НО пальцем не',
    '//                     работает: тач нативный DnD не поддерживает;',
    '//   DumbSortable    — указательные события. Работает пальцем, порог старта',
    '//                     свой, есть автопрокрутка и ручка [data-drag-handle].',
    '//',
    '// Внутри одного приложения спокойно живут оба: они не мешают друг другу.',
  ].join('\n'),
}

/** язык там, где это не tsx */
export const langs = { install: 'sh' }
