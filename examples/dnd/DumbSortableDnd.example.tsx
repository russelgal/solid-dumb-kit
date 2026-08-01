// DumbSortableDnd — сортировка списка на нативном drag-and-drop.
//
// То же, что вкладка DumbSortable, но жест ведёт браузер — и он же решает, над
// чем курсор: зона приёма висит на каждой строке. Считать остаётся только
// движение: затронутые едут FLIP-ом, данные до дропа не трогаются.
//
// Тач не поддерживается: HTML5 DnD там не существует. Для пальца — DumbSortable.
import { createSignal, For } from 'solid-js'
import { DumbSortableDnd } from '@solid-dumb-kit/sortable-dnd'

type Row = { id: string; n: number; label: string; size: number }

// Триста строк и двести плиток — чтобы было видно, что длина списка ни на что не
// влияет: место вставки ищет браузер, а не мы. Высоты строк нарочно разные — на
// них видно, что сдвиг считается по настоящим размерам, а не «на глазок».
const ROWS: Array<Row> = Array.from({ length: 300 }, (_, i) => ({
  id: `r${i}`,
  n: i,
  label: `Track ${String(i + 1).padStart(3, '0')}`,
  size: i % 7 === 0 ? 2 : 1,
}))

// Цвет закреплён ЗА СТРОКОЙ, а не за её местом — как в пробе `CssOrder`. Так
// видно, что строка переехала, а не перекрасилась; и `style` при перестановке
// правится ровно один раз, на `order`, а не второй раз на цвет.
const HUE = (i: number) => `oklch(0.72 0.13 ${(i * 37) % 360})`

type Tile = { id: string; n: number }
const TILES: Array<Tile> = Array.from({ length: 200 }, (_, i) => ({ id: `t${i}`, n: i + 1 }))

export default function DumbSortableDndExample() {
  const [rows, setRows] = createSignal(ROWS)
  const [tiles, setTiles] = createSignal(TILES)
  const [log, setLog] = createSignal('тащи строку за ⠿')

  return (
    <div class="sd-example">
      <h3>DumbSortableDnd — нативный drag-and-drop</h3>
      <p class="note">
        <b>300 строк и 200 плиток.</b> Место вставки мы не считаем: зона приёма висит на каждом
        элементе, и хиттест делает браузер — даром и всегда верно, хоть после автопрокрутки на три
        тысячи пикселей. Данные до дропа не трогаются, меняется только порядок мест, а доигрывает
        его <b>FLIP</b> (<code>Web Animations</code>, только <i>затронутые</i> элементы: у остальных
        в <code>style</code> не появляется ни байта). Уведи за край — список подкручивается сам.
        <b>Тач не поддерживается</b> — для пальца есть <b>DumbSortable</b>.
      </p>
      <div class="bar">{log()}</div>

      <div class="cols">
      <section class="col">
      <h4 class="col-title">Список — 300 строк</h4>
      <DumbSortableDnd
        class="rows"
        items={rows()}
        setItems={(next) => {
          setRows(next)
          setLog(`порядок: ${next.slice(0, 4).map((r) => r.label).join(', ')}…`)
        }}
        id={(r) => r.id}
      >
        {(row, i) => (
          <article class="row" style={{ '--hue': HUE(row.n), '--size': String(row.size) }}>
            <button class="handle" data-drag-handle type="button" title="перетащить">⠿</button>
            <div class="body">
              <div class="title">{row.label}</div>
              <div class="sub">{row.size === 2 ? 'двойная высота' : 'обычная строка'}</div>
            </div>
            <span class="idx">{i() + 1}</span>
          </article>
        )}
      </DumbSortableDnd>
      </section>

      <section class="col">
      <h4 class="col-title">Сетка плиток — 200</h4>
      <p class="note">
        Тот же движок с <code>axis="grid"</code>: плитка едет на место той, над которой курсор, а
        соседи сдвигаются на одну позицию — с переносом на другую строку, когда упираются в край.
        Тут плитку тащат целиком, без ручки.
      </p>

      <DumbSortableDnd
        class="tiles"
        axis="grid"
        items={tiles()}
        setItems={(next) => {
          setTiles(next)
          setLog(`плитки: ${next.slice(0, 6).map((t) => t.n).join(', ')}…`)
        }}
        id={(t) => t.id}
      >
        {(tile) => (
          <div class="tile" style={{ '--hue': HUE(tile.n) }}>
            {tile.n}
          </div>
        )}
      </DumbSortableDnd>
      </section>
      </div>

      <style>{`
        .sd-example { padding: 16px 20px; color: #0f172a }
        .sd-example h3 { margin: 0 0 4px }
        .sd-example .note { margin: 0 0 10px; font-size: 13px; color: #64748b }
        .sd-example .bar { margin: 0 0 12px; font-size: 13px; color: #64748b; min-height: 18px }

        /* Список и сетка — рядом, каждый со своей прокруткой: иначе до сетки
           пришлось бы листать 300 строк, а это ровно то, чего в витрине не надо. */
        .sd-example .cols { display: grid; grid-template-columns: minmax(320px, 1fr) minmax(320px, 1fr);
                            gap: 20px; align-items: start }
        .sd-example .col { min-width: 0 }
        .sd-example .col-title { margin: 0 0 8px; font-size: 13px; color: #475569 }

        .sd-example .rows { display: flex; flex-direction: column; gap: 8px;
                            max-height: 66vh; overflow-y: auto; scrollbar-gutter: stable;
                            padding-right: 4px }
        .sd-example .row { display: flex; align-items: center; gap: 10px;
                           padding: 10px 12px; border-radius: 10px; background: #fff;
                           box-shadow: inset 0 0 0 1px #e2e8f0;
                           border-left: 4px solid var(--hue);
                           min-height: calc(var(--size) * 34px) }
        .sd-example .handle { cursor: grab; border: none; background: none; padding: 0;
                              color: #94a3b8; font-size: 16px; line-height: 1 }
        .sd-example .handle:active { cursor: grabbing }
        .sd-example .body { flex: 1; min-width: 0 }
        .sd-example .title { font-weight: 500; font-size: 14px }
        .sd-example .sub { font-size: 12px; color: #94a3b8 }
        .sd-example .idx { font-size: 12px; color: #cbd5e1 }

        .sd-example .tiles { display: grid; gap: 8px; max-height: 66vh; overflow-y: auto;
                             scrollbar-gutter: stable; padding-right: 4px;
                             grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)) }
        .sd-example .tile { display: grid; place-items: center; height: 72px; cursor: grab;
                            border-radius: 10px; background: #fff; font-weight: 600; color: #334155;
                            box-shadow: inset 0 0 0 1px #e2e8f0; border-top: 4px solid var(--hue) }
        .sd-example .tile:active { cursor: grabbing }
      `}</style>
    </div>
  )
}
