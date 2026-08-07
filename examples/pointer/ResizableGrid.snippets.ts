// Сниппеты доки к примеру ResizableGrid.
//
// Отдельный файл, потому что подсветка считается НА СБОРКЕ: плагин
// playground/snippets.ts выполняет этот модуль в Node, гонит каждую строку
// через Shiki и подменяет экспорт на { code, html }. Отсюда два требования: в
// файле только строки и ни одного импорта.
export default {
  install: 'pnpm add @solid-dumb-kit/resizable-grid',

  basic: [
    "import { ResizableGrid } from '@solid-dumb-kit/resizable-grid'",
    '',
    '// Панели редактора: слева дерево, посередине работа, справа свойства.',
    '// Размеры сами лягут в localStorage по storageKey и переживут перезагрузку.',
    '<ResizableGrid',
    '  storageKey="editor-panes"',
    '  cols={[',
    "    { id: 'tree', content: () => <FileTree />, min: 180, initial: 1 },",
    "    { id: 'main', content: () => <Editor />, min: 320, initial: 3 },",
    "    { id: 'props', content: () => <Inspector />, min: 220 },",
    '  ]}',
    '/>',
  ].join('\n'),

  rows: [
    '// Второй ряд: до трёх панелей, со своей высотой. Между рядами появляется',
    '// горизонтальная ручка.',
    '<ResizableGrid',
    '  storageKey="dashboard-panes"',
    '  cols={[',
    "    { id: 'map', content: () => <Map />, min: 300, initial: 2 },",
    "    { id: 'list', content: () => <List />, min: 220 },",
    '  ]}',
    '  rows={[',
    "    { id: 'log', content: () => <Log />, min: 120 },",
    "    { id: 'chart', content: () => <Chart />, min: 120 },",
    '  ]}',
    '  rowInitial={2}   // высота первого ряда, fr',
    '  row2Initial={1}',
    '  rowMin={100}     // минимальная высота ряда, px',
    '/>',
  ].join('\n'),

  storage: [
    '// Размеры пишутся во fr, а не в пиксели: окно поменяло ширину — пропорции',
    '// сохранились. В хранилище лежит { cols, rows, rowSplit }.',
    '//',
    '// Битые или устаревшие данные (поменялось число панелей) не роняют сетку:',
    '// они проверяются схемой и молча заменяются умолчаниями.',
    "localStorage.getItem('editor-panes')",
    '// => {"cols":[1.4,2.6,1],"rows":[1,1]}',
  ].join('\n'),
}

/** язык там, где это не tsx */
export const langs = { install: 'sh' }
