// DumbSortableDnd — сортировка списка на нативном drag-and-drop.
//
// То же, что вкладка DumbSortable, но жест ведёт браузер — и он же решает, над
// чем курсор: зона приёма висит на каждой строке. Считать остаётся только
// движение: затронутые едут FLIP-ом.
//
// Порядок меняется прямо по ходу жеста, но DOM при этом не шевелится: разметка
// стоит в неизменном порядке, а показ задаёт CSS `order`. Отсюда требование к
// контейнеру — flex или grid, иначе `order` браузер проигнорирует.
//
// Тач не поддерживается: HTML5 DnD там не существует. Для пальца — DumbSortable.
import { createSignal } from 'solid-js'
import { DumbSortableDnd } from '@solid-dumb-kit/sortable-dnd'

type Row = { id: string; n: number; label: string; tall: boolean }

// Триста строк и двести плиток — чтобы было видно, что длина списка ни на что не
// влияет: место вставки ищет браузер, а не мы. Высоты строк нарочно разные — на
// них видно, что сдвиг считается по настоящим размерам, а не «на глазок».
const ROWS: Array<Row> = Array.from({ length: 300 }, (_, i) => ({
  id: `r${i}`,
  n: i,
  label: `Track ${String(i + 1).padStart(3, '0')}`,
  tall: i % 7 === 0,
}))

type Tile = { id: string; n: number }
const TILES: Array<Tile> = Array.from({ length: 200 }, (_, i) => ({ id: `t${i}`, n: i + 1 }))

// Цвет закреплён ЗА ЭЛЕМЕНТОМ, а не за его местом: так видно, что элемент
// переехал, а не перекрасился. Классы перечислены целиком, а не собираются из
// кусков, — Tailwind ищет их в исходнике буквально.
const EDGE_L = [
  'border-l-rose-400',
  'border-l-orange-400',
  'border-l-amber-400',
  'border-l-lime-400',
  'border-l-emerald-400',
  'border-l-cyan-400',
  'border-l-blue-400',
  'border-l-violet-400',
  'border-l-fuchsia-400',
]
const EDGE_T = [
  'border-t-rose-400',
  'border-t-orange-400',
  'border-t-amber-400',
  'border-t-lime-400',
  'border-t-emerald-400',
  'border-t-cyan-400',
  'border-t-blue-400',
  'border-t-violet-400',
  'border-t-fuchsia-400',
]

export default function DumbSortableDndExample() {
  const [rows, setRows] = createSignal(ROWS)
  const [tiles, setTiles] = createSignal(TILES)
  const [log, setLog] = createSignal('тащи строку за ⠿')

  return (
    <div class="p-5">
      <h3 class="text-lg font-semibold">DumbSortableDnd — нативный drag-and-drop</h3>
      <p class="mt-1 mb-3 max-w-4xl text-sm text-base-content">
        <b>300 строк и 200 плиток.</b> Место вставки мы не считаем: зона приёма висит на каждом
        элементе, и хиттест делает браузер — даром и всегда верно, хоть после автопрокрутки на три
        тысячи пикселей. <b>DOM за жест не меняется вовсе:</b> разметка стоит в неизменном порядке,
        показ задаёт CSS <code class="kbd kbd-sm">order</code>, а доигрывает движение <b>FLIP</b>{' '}
        (<code class="kbd kbd-sm">Web Animations</code>, только <i>затронутые</i> элементы). Уведи за
        край — список подкручивается сам. <b>Тач не поддерживается</b> — для пальца есть{' '}
        <b>DumbSortable</b>.
      </p>

      <div class="mb-3 min-h-6 text-sm text-base-content">{log()}</div>

      <div class="grid items-start gap-5 lg:grid-cols-2">
        <section class="min-w-0">
          <h4 class="mb-2 text-sm font-medium text-base-content">Список — 300 строк</h4>

          {/* daisyUI `list`: контейнер — flex-колонка, значит CSS `order` на нём
              действует, а строки получают готовую сетку колонок. */}
          <DumbSortableDnd
            class="list sd-scroll rounded-box bg-base-100 shadow-sm"
            items={rows()}
            setItems={(next) => {
              setRows(next)
              setLog(`порядок: ${next.slice(0, 4).map((r) => r.label).join(', ')}…`)
            }}
            id={(r) => r.id}
          >
            {(row, i) => (
              <article
                class={`list-row items-center border-l-4 ${EDGE_L[row.n % EDGE_L.length]} ${row.tall ? 'min-h-17' : ''}`}
              >
                <button class="sd-handle" data-drag-handle type="button" title="перетащить">
                  ⠿
                </button>
                {/* растёт именно эта колонка — иначе длинное название вытолкнет
                    номер за край строки */}
                <div class="list-col-grow min-w-0">
                  <div class="sd-title font-medium">{row.label}</div>
                  {/* без прозрачности: приписка должна читаться, а не угадываться */}
                  <div class="text-xs font-semibold uppercase text-base-content">
                    {row.tall ? 'двойная высота' : 'обычная строка'}
                  </div>
                </div>
                <span class="badge badge-ghost badge-sm">{i() + 1}</span>
              </article>
            )}
          </DumbSortableDnd>
        </section>

        <section class="min-w-0">
          <h4 class="mb-2 text-sm font-medium text-base-content">Сетка плиток — 200</h4>
          <p class="mb-2 text-sm text-base-content">
            Тот же движок с <code class="kbd kbd-sm">axis="grid"</code>: плитка едет на место той,
            над которой курсор, а соседи сдвигаются на одну позицию — с переносом на другую строку,
            когда упираются в край. Тут плитку тащат целиком, без ручки.
          </p>

          <DumbSortableDnd
            class="sd-grid"
            axis="grid"
            items={tiles()}
            setItems={(next) => {
              setTiles(next)
              setLog(`плитки: ${next.slice(0, 6).map((t) => t.n).join(', ')}…`)
            }}
            id={(t) => t.id}
          >
            {(tile) => (
              <div class={`sd-tile ${EDGE_T[tile.n % EDGE_T.length]}`}>{tile.n}</div>
            )}
          </DumbSortableDnd>
        </section>
      </div>
    </div>
  )
}
