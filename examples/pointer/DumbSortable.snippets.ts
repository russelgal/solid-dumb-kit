// Сниппеты доки к примеру DumbSortable.
//
// Отдельный файл, потому что подсветка считается НА СБОРКЕ: плагин
// playground/snippets.ts выполняет этот модуль в Node, гонит каждую строку
// через Shiki и подменяет экспорт на { code, html }. Отсюда два требования: в
// файле только строки и ни одного импорта.
export default {
  install: 'pnpm add @solid-dumb-kit/sortable',

  basic: [
    "import { createSignal } from 'solid-js'",
    "import { DumbSortable } from '@solid-dumb-kit/sortable'",
    '',
    'export default function List() {',
    "  const [items, setItems] = createSignal([{ id: 'a', label: 'Первый' }])",
    '',
    '  return (',
    '    // контейнер ТВОЙ: тег, классы, прокрутка — всё своё',
    '    <div class="max-h-[60vh] space-y-2 overflow-auto">',
    '      <DumbSortable items={items()} setItems={setItems} id={(x) => x.id}>',
    '        {(item) => (',
    '          // элемент тоже твой; компонент цепляет драг прямо к нему',
    '          <div class="row">{item.label}</div>',
    '        )}',
    '      </DumbSortable>',
    '    </div>',
    '  )',
    '}',
  ].join('\n'),

  handle: [
    '// Ручка — любой потомок с [data-drag-handle]. Нет её — тянется весь',
    '// элемент, и тогда текст внутри не выделить.',
    '<DumbSortable items={items()} setItems={setItems} id={(x) => x.id}>',
    '  {(item) => (',
    '    <div class="row flex items-center gap-2">',
    '      <button class="btn btn-ghost btn-xs" data-drag-handle>',
    '        ⠿',
    '      </button>',
    '      <span>{item.label}</span>',
    '      {/* кнопкам жест не мешает: на них ставится [data-no-drag] */}',
    '      <button class="btn btn-xs" data-no-drag onClick={() => remove(item.id)}>',
    '        ✕',
    '      </button>',
    '    </div>',
    '  )}',
    '</DumbSortable>',
  ].join('\n'),

  grid: [
    "// axis='y' — список (по умолчанию), axis='grid' — плитки в несколько",
    '// колонок: соседи расступаются и по горизонтали тоже.',
    '<div class="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">',
    '  <DumbSortable items={tiles()} setItems={setTiles} id={(t) => t.id} axis="grid">',
    '    {(t) => <div class="tile">{t.name}</div>}',
    '  </DumbSortable>',
    '</div>',
  ].join('\n'),

  thresholds: [
    '// Пальцем жест начинается по УДЕРЖАНИЮ (иначе не прокрутить страницу),',
    '// мышью — по расстоянию (иначе не кликнуть). Пороги разводятся отдельно.',
    '<DumbSortable',
    '  items={items()}',
    '  setItems={setItems}',
    '  id={(x) => x.id}',
    '  pressDelay={250}       // палец: сколько держать',
    '  mousePressDelay={0}    // мышь: без задержки',
    '  mouseThreshold={6}     // мышь: сколько пройти',
    '  disabled={() => sorting()}',
    '  animate={false}        // расступание и приземление выключены',
    '/>',
  ].join('\n'),

  group: [
    "import { createSortableGroup } from '@solid-dumb-kit/sortable'",
    '',
    '// Перенос МЕЖДУ списками (канбан) — отдельный движок: у него свой жест,',
    '// клон в top layer и общий снимок всех колонок.',
    'const group = createSortableGroup({',
    '  // откуда (зона + индекс) и куда',
    '  onEnd: (from, to) => setBoard((b) => move(b, from, to)),',
    '})',
    '',
    '<For each={columns()}>',
    '  {(col) => {',
    '    // каждая колонка регистрируется в группе своим ключом',
    '    const list = group.list(col.id, {',
    '      order: () => col.cards.map((c) => c.id),',
    '      // можно не принимать чужих: accepts: (from) => from !== "done",',
    '    })',
    '    return (',
    '      <div ref={list.container} class="column">',
    '        <For each={col.cards}>{(c) => <div ref={list.bind(c.id)}>{c.text}</div>}</For>',
    '      </div>',
    '    )',
    '  }}',
    '</For>',
  ].join('\n'),
}

/** язык там, где это не tsx */
export const langs = { install: 'sh' }
