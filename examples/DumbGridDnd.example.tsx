// DumbGridDnd — та же сетка, но перенос ведёт НАТИВНЫЙ drag-and-drop браузера.
//
// Отличие от вкладки DumbGrid: там весь жест наш, на указательных событиях, и он
// работает пальцем. Здесь браузер сам решает, над какой сеткой курсор (dragover
// приходит прямо на контейнер), сам рисует картинку переноса и скроллит у краёв,
// а блок объявлен через dataTransfer — его понимают и чужие приёмники. Ценой
// того, что на тач-устройствах HTML5 DnD не существует вовсе.
//
// Наше в обоих случаях одинаково: раскладка, расступание соседей, рамка места,
// снап ресайза.
import { createMemo, createSignal, For } from 'solid-js'
import { createDumbGridDndGroup, DumbGridDnd, type DumbGridDndItem, type DumbGridDndLayout } from 'solid-dumb-kit'

type Widget = { id: string; title: string; hue: number }

const LEFT: Array<Widget> = [
  { id: 'l1', title: 'Выручка', hue: 265 },
  { id: 'l2', title: 'Средний чек', hue: 200 },
  { id: 'l3', title: 'Конверсия', hue: 30 },
  { id: 'l4', title: 'Возвраты', hue: 20 },
]
const RIGHT: Array<Widget> = [
  { id: 'r1', title: 'Склад', hue: 150 },
  { id: 'r2', title: 'Доставка', hue: 90 },
]

const layoutOf = (list: Array<Widget>): DumbGridDndLayout =>
  list.map((w, i) => ({ id: w.id, w: i === 0 ? 6 : 3, h: i === 0 ? 2 : 1 }))

export default function DumbGridDndExample() {
  const [left, setLeft] = createSignal(LEFT)
  const [right, setRight] = createSignal(RIGHT)
  const [leftLayout, setLeftLayout] = createSignal(layoutOf(LEFT))
  const [rightLayout, setRightLayout] = createSignal(layoutOf(RIGHT))
  const [edit, setEdit] = createSignal(true)
  const [log, setLog] = createSignal('тащи блок мышью — в своей сетке и в соседнюю')

  const lists = {
    left: { get: left, set: setLeft, layout: leftLayout, setLayout: setLeftLayout },
    right: { get: right, set: setRight, layout: rightLayout, setLayout: setRightLayout },
  } as const
  type Side = keyof typeof lists

  const group = createDumbGridDndGroup({
    onTransfer: (from, to) => {
      const src = lists[from.grid as Side]
      const dst = lists[to.grid as Side]
      const moved = src.get().find((w) => w.id === from.id)
      const span = src.layout().find((s) => s.id === from.id)
      if (!moved || !span) return

      src.set((l) => l.filter((w) => w.id !== from.id))
      src.setLayout((l) => l.filter((s) => s.id !== from.id))
      dst.set((l) => [...l.slice(0, to.index), moved, ...l.slice(to.index)])
      dst.setLayout((l) => [...l.slice(0, to.index), span, ...l.slice(to.index)])
      setLog(`«${moved.title}»: ${from.grid} → ${to.grid} #${to.index}`)
    },
  })

  const itemsOf = (side: Side) =>
    createMemo<Array<DumbGridDndItem>>(() =>
      lists[side].get().map((w) => ({
        id: w.id,
        w: 3,
        h: 1,
        minW: 2,
        content: () => (
          <div class="widget" style={{ '--hue': String(w.hue) }}>
            <span class="wtitle">{w.title}</span>
            <span class="wval">{((w.hue * 137) % 900) + 100}</span>
          </div>
        ),
      })),
    )

  const leftItems = itemsOf('left')
  const rightItems = itemsOf('right')

  const Board = (p: { side: Side; title: string; items: () => Array<DumbGridDndItem> }) => (
    <section class="board" classList={{ over: group.over() === p.side && group.active()?.grid !== p.side }}>
      <header>
        <strong>{p.title}</strong>
        <span class="count">{p.items().length}</span>
      </header>
      <DumbGridDnd
        group={group}
        name={p.side}
        cols={6}
        rowHeight={64}
        gap={8}
        editable={edit()}
        items={p.items()}
        layout={lists[p.side].layout()}
        onLayout={lists[p.side].setLayout}
        onRemove={(id) => {
          lists[p.side].set((l) => l.filter((w) => w.id !== id))
          lists[p.side].setLayout((l) => l.filter((s) => s.id !== id))
        }}
        blockStyle={{ cursor: 'default' }}
      />
    </section>
  )

  return (
    <div class="dnd-example">
      <h3>DumbGridDnd — нативный drag-and-drop</h3>
      <p class="note">
        Здесь перенос ведёт <b>браузер</b>: он решает, над какой сеткой курсор (<code>dragover</code>
        {' '}приходит прямо на контейнер), рисует картинку переноса и скроллит у краёв. Наше — куда
        именно встанет блок, расступание соседей и рамка места. Блок объявлен через{' '}
        <code>dataTransfer</code>, поэтому понятен и чужому приёмнику. <b>Тач не поддерживается</b> —
        HTML5 DnD там не реализован; для пальца есть вкладка <b>DumbGrid</b> со своим жестом.
      </p>

      <div class="bar">
        <label class="switch">
          <input type="checkbox" checked={edit()} onChange={(e) => setEdit(e.currentTarget.checked)} />
          <b>edit mode</b>
        </label>
        <span class="log">{log()}</span>
      </div>

      <div class="boards">
        <Board side="left" title="Продажи" items={leftItems} />
        <Board side="right" title="Операционка" items={rightItems} />
      </div>

      <style>{`
        .dnd-example { padding: 16px; max-width: 1100px; margin: 0 auto; color: #0f172a }
        .dnd-example h3 { margin: 0 0 4px }
        .dnd-example .note { margin: 0 0 10px; font-size: 13px; color: #64748b; max-width: 84ch }
        .dnd-example .bar { display: flex; gap: 12px; align-items: center; margin: 0 0 12px; font-size: 13px }
        .dnd-example .switch { display: inline-flex; gap: 6px; align-items: center; padding: 4px 10px;
                               border: 1px solid #cbd5e1; border-radius: 999px; background: #fff }
        .dnd-example .log { color: #64748b }

        .dnd-example .boards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start }
        .dnd-example .board { border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc;
                              padding: 8px; transition: background .15s, border-color .15s }
        .dnd-example .board.over { border-color: #6366f1; background: #eef2ff }
        .dnd-example .board header { display: flex; gap: 8px; align-items: center;
                                     padding: 2px 4px 8px; font-size: 13px }
        .dnd-example .count { color: #94a3b8; font-size: 12px }

        .dnd-example .widget { height: 100%; box-sizing: border-box; display: flex; flex-direction: column;
                               justify-content: center; gap: 2px; padding: 8px 10px; border-radius: 10px;
                               background: #fff; box-shadow: inset 0 0 0 1px #e2e8f0;
                               border-left: 3px solid oklch(0.7 0.13 var(--hue)) }
        .dnd-example .wtitle { font-size: 12px; color: #64748b }
        .dnd-example .wval { font-size: 17px; font-weight: 600 }
      `}</style>
    </div>
  )
}
