// Сниппеты доки к примеру Kanban (createSortableGroup).
//
// Отдельный файл, потому что подсветка считается НА СБОРКЕ: плагин
// playground/snippets.ts выполняет этот модуль в Node, гонит каждую строку
// через Shiki и подменяет экспорт на { code, html }. Отсюда два требования: в
// файле только строки и ни одного импорта.
export default {
  install: 'pnpm add @solid-dumb-kit/sortable',

  basic: [
    "import { createSortableGroup } from '@solid-dumb-kit/sortable'",
    '',
    'export default function Board() {',
    '  const [board, setBoard] = createStore(initial)',
    '',
    '  const group = createSortableGroup({',
    '    // откуда (зона + индекс) и куда; перекладывает данные потребитель',
    '    onEnd: (from, to) => setBoard(move(board, from, to)),',
    '  })',
    '',
    '  return (',
    '    <div class="flex gap-3">',
    '      <For each={COLUMNS}>',
    '        {(col) => {',
    '          // зона регистрируется своим именем и отдаёт визуальный порядок',
    '          const list = group.list(col, { order: () => board[col].map((c) => c.id) })',
    '          return (',
    '            <div ref={list.container} class="column overflow-y-auto">',
    '              <For each={board[col]}>',
    '                {(card) => (',
    '                  <div ref={list.bind(card.id)} class="card">',
    '                    {card.title}',
    '                  </div>',
    '                )}',
    '              </For>',
    '            </div>',
    '          )',
    '        }}',
    '      </For>',
    '    </div>',
    '  )',
    '}',
  ].join('\n'),

  accepts: [
    '// Кто кого принимает. Функция получает имя зоны, ОТКУДА тянут: колонка',
    '// «Готово» может брать только с ревью, а архив — вообще ничего не отдавать.',
    'const review = group.list("review", {',
    '  order: () => board.review.map((c) => c.id),',
    '  accepts: (from) => from !== "done",',
    '})',
  ].join('\n'),

  feedback: [
    '// Подсветка зоны под курсором и приглушение оригинала — из группы:',
    '// activeList говорит, над какой колонкой указатель, draggingId — что летит.',
    '<div',
    '  ref={list.container}',
    '  classList={{ "ring-2 ring-primary": group.activeList() === col }}',
    '>',
    '  <For each={board[col]}>',
    '    {(card) => (',
    '      <div',
    '        ref={list.bind(card.id)}',
    '        classList={{ "opacity-40": group.draggingId() === card.id }}',
    '      >',
    '        {card.title}',
    '      </div>',
    '    )}',
    '  </For>',
    '</div>',
  ].join('\n'),

  why: [
    '// Почему это отдельный движок, а не проп у DumbSortable:',
    '//',
    '// 1. снимок берётся сразу по ВСЕМ колонкам — иначе зону под курсором',
    '//    пришлось бы вычислять замерами, то есть forced layout в кадре;',
    '// 2. оригинал карточки остаётся в потоке своей колонки (просто прячется),',
    '//    поэтому колонки не схлопываются и высота не скачет;',
    '// 3. за курсором летит КЛОН в top layer — его не режет overflow, так что',
    '//    колонки могут спокойно прокручиваться.',
    '',
    'const group = createSortableGroup({',
    '  onEnd,',
    '  disabled: () => readOnly(),',
    '  pressDelay: 350,     // палец: удержание до старта',
    '  mouseThreshold: 6,   // мышь: расстояние до старта',
    '  animate: false,      // без расступания и приземления',
    '})',
  ].join('\n'),
}

/** язык там, где это не tsx */
export const langs = { install: 'sh' }
