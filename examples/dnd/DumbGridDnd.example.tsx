// DumbGridDnd — сетка, где перенос ведёт нативный drag-and-drop браузера.
//
// Порядок блоков держит пример: компонент только сообщает, что куда переехало.
//
// Тач не поддерживается — HTML5 DnD там не существует; для пальца есть вкладка
// DumbGrid со своим указательным жестом.
import { createSignal, For } from 'solid-js'
import { createDumbGridDndGroup, DumbGridDnd, type DumbGridDndItem } from '@solid-dumb-kit/grid-dnd'

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
        <div class="flex h-full box-border flex-col justify-center gap-0.5 rounded-box bg-base-100 px-2.5 py-2 ring-1 ring-base-300 border-l-[3px]" style={{ 'border-left-color': `oklch(0.7 0.13 ${w.hue})` }}>
          <span class="text-xs text-base-content">{w.title}</span>
          <span class="text-[17px] font-semibold">{((w.hue * 137) % 900) + 100}</span>
        </div>
      ),
    }))

  const Board = (p: { side: Side; title: string }) => (
    <section
      class="rounded-xl border border-base-300 bg-base-200 p-2 transition-colors"
      classList={{
        'border-primary bg-primary/15': group.over() === p.side && group.active()?.grid !== p.side,
      }}
    >
      <header class="flex items-center gap-2 px-1 pt-0.5 pb-2 text-[13px]">
        <strong>{p.title}</strong>
        <span class="text-xs text-base-content">{sides[p.side].get().length}</span>
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
    <div class="p-5 text-base-content">
      <h3 class="mb-1 text-lg font-semibold">DumbGridDnd — нативный drag-and-drop</h3>
      <p class="mb-2.5 text-[13px] text-base-content">
        Перенос ведёт <b>браузер</b>: над какой доской и над каким блоком курсор — говорят его же
        события, поэтому считать здесь почти нечего. Порядок держит пример, компонент лишь
        сообщает <code>onReorder</code> и <code>onTransfer</code>.{' '}
        <b>Тач не поддерживается</b> — HTML5 DnD там не существует.
      </p>

      <div class="mb-3 min-h-[18px] text-[13px]"><span class="text-base-content">{log()}</span></div>

      <div class="grid grid-cols-2 items-start gap-3">
        <Board side="left" title="Продажи" />
        <Board side="right" title="Операционка" />
      </div>

    </div>
  )
}
