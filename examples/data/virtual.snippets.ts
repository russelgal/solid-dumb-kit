// Сниппеты доки к примеру createVirtualizer.
//
// Отдельный файл, потому что подсветка считается НА СБОРКЕ: плагин
// playground/snippets.ts выполняет этот модуль в Node, гонит каждую строку
// через Shiki и подменяет экспорт на { code, html }. Отсюда два требования: в
// файле только строки и ни одного импорта.
export default {
  install: 'pnpm add @solid-dumb-kit/shared',

  basic: [
    "import { createVirtualizer } from '@solid-dumb-kit/shared'",
    '',
    'let scroller!: HTMLDivElement',
    'const [range, setRange] = createSignal({ start: 0, end: 0, offset: 0, total: 0 })',
    '',
    'const v = createVirtualizer({',
    '  count: () => rows().length,',
    '  itemSize: () => 32,       // высота строки ВМЕСТЕ с зазором',
    '  scroller: () => scroller,',
    '  onChange: setRange,',
    '})',
    'onCleanup(v.destroy)',
    '',
    '<div ref={scroller} style={{ height: "60vh", overflow: "auto" }}>',
    '  {/* распорка задаёт полосу прокрутки, нарисованное сдвигается transform */}',
    '  <div style={{ height: `${range().total}px`, position: "relative" }}>',
    '    <div style={{ transform: `translateY(${range().offset}px)` }}>',
    '      <For each={rows().slice(range().start, range().end)}>',
    '        {(row) => <div class="row">{row.name}</div>}',
    '      </For>',
    '    </div>',
    '  </div>',
    '</div>',
  ].join('\n'),

  sizes: [
    '// Ряды разной высоты — заявленные, а не измеренные: шахматка знает высоту',
    '// строки как «этажей × высота этажа», и это по-прежнему арифметика, без',
    '// единого обращения к элементам.',
    'const v = createVirtualizer({',
    '  count: () => rows().length,',
    '  itemSizes: () => heights(),  // массив должен быть НОВЫМ при изменении:',
    '                               // движок узнаёт правку по ссылке',
    '  scroller: () => scroller,',
    '  onChange: setRange,',
    '})',
    '',
    '// правите массив на месте — зовите refresh() сами',
    'heights()[10] = 64',
    'v.refresh()',
  ].join('\n'),

  axis: [
    '// Сетка плиток: columns говорит, сколько штук в ряду',
    'createVirtualizer({ count, itemSize, columns: () => 4, scroller, onChange })',
    '',
    '// Горизонтальная прокрутка — шкала времени и прочее, что едет вбок:',
    '// читаются scrollLeft и ширина видимой части.',
    'createVirtualizer({',
    '  count: () => days().length,',
    "  itemSize: () => 34,",
    "  axis: 'x',",
    '  // сколько px стоит ПЕРЕД первым рядом в том же скроллере: липкая колонка',
    '  // с названиями, шапка, отступ. Без поправки окно уедет ровно на её размер',
    '  lead: () => 200,',
    '  scroller: () => scroller,',
    '  onChange: setRange,',
    '})',
  ].join('\n'),

  why: [
    '// Почему total не всегда равен count * itemSize:',
    '//',
    '// у распорки есть потолок высоты, за которым браузер начинает врать про',
    '// scrollTop. На миллионе строк по 32px это уже далеко за пределом, поэтому',
    '// распорка обрезается, а позиция пересчитывается пропорционально.',
    '//',
    '// Что важно для потребителя: рисуйте по range, а не по своим формулам —',
    '// offset и total уже учитывают эту поправку.',
    'overscan: 3, // сколько рядов сверх видимого; меньше двух — белая полоса',
                 '// при быстрой прокрутке',
  ].join('\n'),
}

/** язык там, где это не tsx */
export const langs = { install: 'sh' }
