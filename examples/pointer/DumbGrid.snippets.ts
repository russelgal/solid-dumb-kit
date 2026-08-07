// Сниппеты доки к примеру DumbGrid.
//
// Отдельный файл, потому что подсветка считается НА СБОРКЕ: плагин
// playground/snippets.ts выполняет этот модуль в Node, гонит каждую строку
// через Shiki и подменяет экспорт на { code, html }. Отсюда два требования: в
// файле только строки и ни одного импорта.
export default {
  install: 'pnpm add @solid-dumb-kit/grid',

  basic: [
    "import { DumbGrid } from '@solid-dumb-kit/grid'",
    '',
    'const blocks = [',
    "  { id: 'sales', w: 'half', h: 2, content: () => <SalesChart /> },",
    "  { id: 'today', w: 'quarter', content: () => <TodayCard /> },",
    "  { id: 'log', w: 'full', h: 3, content: () => <EventLog /> },",
    ']',
    '',
    '<DumbGrid',
    '  items={blocks}',
    '  cols={12}',
    '  rowHeight={80}',
    '  gap={12}',
    '  // раскладка сама ляжет в localStorage и переживёт перезагрузку',
    '  storageKey="dashboard"',
    '/>',
  ].join('\n'),

  modes: [
    "// flow (по умолчанию) — блоки текут по порядку, дырки остаются",
    '<DumbGrid items={blocks} mode="flow" />',
    '',
    '// dense — то же, но дырки затыкаются следующими блоками',
    '<DumbGrid items={blocks} mode="dense" />',
    '',
    '// free — у каждого блока свои {x, y}: двигай куда угодно, включая пустоту',
    '// внизу. Соседи НЕ расступаются и не расталкиваются: дроп на занятое место',
    '// отклоняется, ресайз обрезается по свободному — ради предсказуемости,',
    '// из-за которой этот режим и включают.',
    '<DumbGrid items={blocks} mode="free" spareRows={3} />',
  ].join('\n'),

  size: [
    '// Ширина — число колонок ИЛИ доля сетки. Доля округляется ВНИЗ: иначе три',
    "// блока по 'third' не влезли бы в строку на неделящейся сетке.",
    'const blocks = [',
    "  { id: 'a', w: 'half' },        // 6 из 12",
    "  { id: 'b', w: 'two-thirds' },  // 8",
    "  { id: 'c', w: '5/12' },        // 5",
    "  { id: 'd', w: 4 },             // ровно 4 колонки",
    ']',
    '',
    '// пределы ресайза задаются так же — числом или пресетом',
    "{ id: 'chart', w: 'half', minW: 'quarter', maxW: 'full', minH: 2, maxH: 6 }",
  ].join('\n'),

  state: [
    '// Раскладку можно держать у себя — тогда storageKey не нужен',
    'const [layout, setLayout] = createSignal(loadFromServer())',
    '',
    '<DumbGrid',
    '  items={blocks}',
    '  layout={layout()}',
    '  onLayout={(next) => {',
    '    setLayout(next)',
    '    api.saveLayout(next) // [{ id, w, h, x?, y? }]',
    '  }}',
    '  onRemove={(id) => setBlocks((b) => b.filter((x) => x.id !== id))}',
    '/>',
    '',
    '// Сохранённую раскладку всегда прогоняй через mergeLayout: набор блоков',
    '// меняется, а в хранилище лежит вчерашний снимок.',
    "import { mergeLayout } from '@solid-dumb-kit/grid'",
    "const safe = mergeLayout(saved, blocks, 12, 'free')",
  ].join('\n'),

  view: [
    '// editable={false} — боевой экран: ни ручек ресайза, ни кнопок удаления,',
    '// ни подложки, ни единого обработчика на блоках. Это ОТДЕЛЬНАЯ ветка',
    '// рендера, а не флаг: ref навешивается при создании элемента.',
    '<DumbGrid items={blocks} layout={layout()} editable={false} />',
    '',
    '// disabled — другое: обвязка редактора остаётся, глушатся только жесты.',
    '// Удобно, пока идёт сохранение.',
    '<DumbGrid items={blocks} onLayout={save} disabled={saving()} />',
    '',
    '// разметка сетки: во время жеста (по умолчанию), всегда или никогда',
    '<DumbGrid items={blocks} showGrid={true} resizable={false} />',
  ].join('\n'),

  group: [
    "import { createDumbGridGroup, DumbGrid } from '@solid-dumb-kit/grid'",
    '',
    '// Перенос блока МЕЖДУ сетками — отдельный движок: локальные перестановки',
    '// каждая сетка по-прежнему делает сама, а наружу уходит только переезд,',
    '// который затрагивает две раскладки сразу.',
    'const group = createDumbGridGroup({',
    '  // from: { grid, id, index }, to: { grid, index, x, y }',
    '  onTransfer: (from, to) => moveBlock(from, to),',
    '  onOver: (grid) => setHighlight(grid),',
    '})',
    '',
    '<DumbGrid group={group} name="left" items={left()} />',
    '<DumbGrid group={group} name="right" items={right()} />',
  ].join('\n'),
}

/** язык там, где это не tsx */
export const langs = { install: 'sh' }
