// DumbGridDnd — сетка, где перенос ведёт нативный drag-and-drop браузера.
//
// Порядок блоков держит пример: компонент только сообщает, что куда переехало.
//
// Тач не поддерживается — HTML5 DnD там не существует; для пальца есть вкладка
// DumbGrid со своим указательным жестом.
import { createSignal, For } from 'solid-js'
import { createDumbGridDndGroup, DumbGridDnd, type DumbGridDndItem } from 'solid-dumb-kit'

type Widget = { id: string; title: string; hue: number; w: number; h: number }

const LEFT: Array<Widget> = [
  { id: 'l1', title: 'Выручка', hue: 265, w: 6, h: 2 },
  { id: 'l2', title: 'Средний чек', hue: 200, w: 3, h: 1 },
  { id: 'l3', title: 'Конверсия', hue: 30, w: 3, h: 1 },
  { id: 'l4', title: 'Возвраты', hue: 20, w: 6, h: 1 },
]
const RIGHT: Array<Widget> = [
  { id: 'r1', title: 'Склад', hue: 150, w: 3, h: 2 },
  { id: 'r2', title: 'Доставка', hue: 90, w: 3, h: 1 },
]

const move = <T,>(list: Array<T>, from: number, to: number): Array<T> => {
  const next = list.slice()
  const [x] = next.splice(from, 1)
  next.splice(to, 0, x)
  return next
}

export default function DumbGridDndExample() {
  const [left, setLeft] = createSignal(LEFT)
  const [right, setRight] = createSignal(RIGHT)
  const [log, setLog] = createSignal('тащи блок мышью — внутри доски и между досками')

  const sides = { left: { get: left, set: setLeft }, right: { get: right, set: setRight } } as const
  type Side = keyof typeof sides

  const group = createDumbGridDndGroup({
    onTransfer: (from, to) => {
      const src = sides[from.grid as Side]
      const dst = sides[to.grid as Side]
      const moved = src.get().find((w) => w.id === from.id)
      if (!moved) return
      src.set((l) => l.filter((w) => w.id !== from.id))
      dst.set((l) => [...l.slice(0, to.index), moved, ...l.slice(to.index)])
      setLog(`«${moved.title}»: ${from.grid} → ${to.grid} #${to.index}`)
    },
  })

  const itemsOf = (side: Side): Array<DumbGridDndItem> =>
    sides[side].get().map((w) => ({
      id: w.id,
      w: w.w,
      h: w.h,
      content: () => (
        <div class="widget" style={{ '--hue': String(w.hue) }}>
          <span class="wtitle">{w.title}</span>
          <span class="wval">{((w.hue * 137) % 900) + 100}</span>
        </div>
      ),
    }))

  const Board = (p: { side: Side; title: string }) => (
    <section class="board" classList={{ over: group.over() === p.side && group.active()?.grid !== p.side }}>
      <header>
        <strong>{p.title}</strong>
        <span class="count">{sides[p.side].get().length}</span>
      </header>
      <DumbGridDnd
        group={group}
        name={p.side}
        cols={6}
        rowHeight={64}
        gap={8}
        items={itemsOf(p.side)}
        onReorder={(from, to) => {
          sides[p.side].set((l) => move(l, from, to > from ? to - 1 : to))
          setLog(`${p.side}: ${from} → ${to}`)
        }}
      />
    </section>
  )

  return (
    <div class="dnd-example">
      <h3>DumbGridDnd — нативный drag-and-drop</h3>
      <p class="note">
        Перенос ведёт <b>браузер</b>: над какой доской и над каким блоком курсор — говорят его же
        события, поэтому считать здесь почти нечего. Порядок держит пример, компонент лишь
        сообщает <code>onReorder</code> и <code>onTransfer</code>.{' '}
        <b>Тач не поддерживается</b> — HTML5 DnD там не существует.
      </p>

      <div class="bar"><span class="log">{log()}</span></div>

      <div class="boards">
        <Board side="left" title="Продажи" />
        <Board side="right" title="Операционка" />
      </div>

      <style>{`
        .dnd-example { padding: 16px; max-width: 1000px; margin: 0 auto; color: #0f172a }
        .dnd-example h3 { margin: 0 0 4px }
        .dnd-example .note { margin: 0 0 10px; font-size: 13px; color: #64748b; max-width: 84ch }
        .dnd-example .bar { margin: 0 0 12px; font-size: 13px; min-height: 18px }
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
