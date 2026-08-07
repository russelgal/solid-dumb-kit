// Сниппеты доки к примеру «Вложенные сетки».
//
// Отдельный файл, потому что подсветка считается НА СБОРКЕ: плагин
// playground/snippets.ts выполняет этот модуль в Node, гонит каждую строку
// через Shiki и подменяет экспорт на { code, html }. Отсюда два требования: в
// файле только строки и ни одного импорта.
export default {
  install: 'pnpm add @solid-dumb-kit/grid',

  nested: [
    "import { DumbGrid } from '@solid-dumb-kit/grid'",
    '',
    '// Блок может быть чем угодно, в том числе другой сеткой: content — обычная',
    '// функция, и внутри неё живёт свой DumbGrid со своей раскладкой.',
    'const outer = [',
    '  {',
    "    id: 'left',",
    "    w: 'half',",
    '    h: 4,',
    '    content: () => (',
    '      <DumbGrid items={inner()} cols={6} rowHeight={60} storageKey="left-pane" />',
    '    ),',
    '  },',
    "  { id: 'chart', w: 'half', h: 4, content: () => <Chart /> },",
    ']',
    '',
    '<DumbGrid items={outer} cols={12} storageKey="board" />',
  ].join('\n'),

  marks: [
    '// Кто из вложенных сеток берёт жест — решается метками, а не порядком',
    '// обработчиков:',
    '//',
    '//   [data-grid-block] — блок сетки. Жест достаётся ТОЙ сетке, чей блок',
    '//                       ближе к цели, поэтому внутренняя выигрывает у внешней;',
    '//   [data-flip-id]    — элемент сортировщика. Такие узлы gridCore пропускает,',
    '//                       и список внутри блока таскается сам по себе.',
    '',
    '// Отсюда же следует, что внутри блока спокойно живёт чужой жест:',
    '{',
    "  id: 'todo',",
    "  w: 'third',",
    '  h: 3,',
    '  content: () => (',
    '    <DumbSortable items={tasks()} setItems={setTasks} id={(t) => t.id}>',
    '      {(t) => <div class="row">{t.text}</div>}',
    '    </DumbSortable>',
    '  ),',
    '}',
  ].join('\n'),

  group: [
    "import { createDumbGridGroup } from '@solid-dumb-kit/grid'",
    '',
    '// Перенос блока между соседними сетками. Внутри группы оригинал остаётся',
    '// на месте приглушённым, а летит клон в top layer — иначе overflow секции',
    '// обрезал бы его на границе.',
    'const group = createDumbGridGroup({',
    '  onTransfer: (from, to) => {',
    '    // from: { grid, id, index }, to: { grid, index, x, y }',
    '    setBoard((b) => moveBlock(b, from, to))',
    '  },',
    '  onOver: (grid) => setHighlight(grid),',
    '})',
    '',
    '<DumbGrid group={group} name="top" items={top()} onLayout={saveTop} />',
    '<DumbGrid group={group} name="bottom" items={bottom()} onLayout={saveBottom} />',
  ].join('\n'),
}

/** язык там, где это не tsx */
export const langs = { install: 'sh' }
