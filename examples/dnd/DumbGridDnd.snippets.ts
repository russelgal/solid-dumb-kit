// Сниппеты доки к примеру DumbGridDnd.
//
// Отдельный файл, потому что подсветка считается НА СБОРКЕ: плагин
// playground/snippets.ts выполняет этот модуль в Node, гонит каждую строку
// через Shiki и подменяет экспорт на { code, html }. Отсюда два требования: в
// файле только строки и ни одного импорта.
export default {
  install: 'pnpm add @solid-dumb-kit/grid-dnd',

  basic: [
    "import { DumbGridDnd } from '@solid-dumb-kit/grid-dnd'",
    '',
    'const blocks = [',
    "  { id: 'sales', w: 'half', h: 2, content: () => <SalesChart /> },",
    "  { id: 'today', w: 'quarter', content: () => <TodayCard /> },",
    ']',
    '',
    '<DumbGridDnd',
    '  items={blocks}',
    '  cols={12}',
    '  rowHeight={80}',
    '  gap={12}',
    '  // порядок перекладывает потребитель — своего состояния у кита нет',
    '  onReorder={(from, to) => setBlocks((b) => move(b, from, to))}',
    '/>',
  ].join('\n'),

  group: [
    "import { createDumbGridDndGroup, DumbGridDnd } from '@solid-dumb-kit/grid-dnd'",
    '',
    '// Несколько сеток одной группы: блок можно утащить в соседнюю. Зону',
    '// решает браузер (dragover прилетает от той сетки, над которой курсор),',
    '// поэтому считать её самим не нужно вовсе.',
    'const group = createDumbGridDndGroup({',
    '  onTransfer: (from, to) => setBoard((b) => moveBlock(b, from, to)),',
    '})',
    '',
    '<DumbGridDnd group={group} name="left" items={left()} onReorder={reorderLeft} />',
    '<DumbGridDnd group={group} name="right" items={right()} onReorder={reorderRight} />',
  ].join('\n'),

  choose: [
    '// Когда какая сетка:',
    '//',
    '//   DumbGridDnd  — нативный HTML5 drag-and-drop. Зону выбирает браузер,',
    '//                  работает перенос из другого окна и с рабочего стола,',
    '//                  НО пальцем не тянется: тач нативный DnD не поддерживает;',
    '//   DumbGrid     — указательные события. Работает пальцем, зону считаем',
    '//                  сами, есть покадровый ресайз и расступание соседей.',
    '//',
    '// Это ДВЕ независимые реализации, общая у них только математика (gridMath).',
    '// Сводить их в одну флагом уже пробовали — ломается рабочее поведение.',
  ].join('\n'),
}

/** язык там, где это не tsx */
export const langs = { install: 'sh' }
