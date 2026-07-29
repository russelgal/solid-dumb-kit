// createSortableGroup — перетаскивание МЕЖДУ контейнерами (канбан).
// Оригинал карточки остаётся в потоке своей колонки (просто прячется), поэтому
// колонки не схлопываются и высота не скачет. За курсором летит клон в top layer
// (Popover API) — его не режет overflow, так что колонки могут скроллиться.
import { createSignal, For, Show } from 'solid-js'
import { createSortableGroup } from 'solid-dumb-kit'

type Card = { id: string; title: string; tag: string; hue: number }

const COLUMNS = ['todo', 'doing', 'review', 'done'] as const
type ColumnId = (typeof COLUMNS)[number]

const TITLES: Record<ColumnId, string> = {
  todo: 'Бэклог', doing: 'В работе', review: 'На ревью', done: 'Готово',
}

// перемешивание Фишера–Йетса: копия, не мутируем исходный массив
function shuffle<T>(list: Array<T>): Array<T> {
  const out = list.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// Перемешивание — дискретное изменение, а значит подходящий случай для
// View Transitions: браузер сам снимет «до», применит новое состояние и
// анимирует переезд карточек. Драг так делать нельзя (снимок всей страницы
// на каждый кадр), а вот такие переходы — ровно его ниша.
const withViewTransition = (fn: () => void) => {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  if (typeof doc.startViewTransition === 'function') doc.startViewTransition(fn)
  else fn()
}

const card = (id: string, title: string, tag: string, hue: number): Card => ({ id, title, tag, hue })

const INITIAL: Record<ColumnId, Card[]> = {
  todo: [
    card('t1', 'Кросс-контейнерный драг', 'core', 265),
    card('t2', 'Клавиатурная доступность', 'a11y', 200),
    card('t3', 'Виртуализованные списки', 'perf', 30),
    card('t4', 'Мультидраг', 'core', 265),
    card('t5', 'Индикатор вставки на anchor positioning', 'ui', 150),
  ],
  doing: [
    card('d1', 'Убрать forced layout из кадра', 'perf', 30),
    card('d2', 'Канбан-пример', 'docs', 90),
  ],
  review: [
    card('r1', 'DumbTable на TanStack', 'core', 265),
  ],
  done: [
    card('n1', 'Раскладка по папкам', 'chore', 220),
    card('n2', 'Русские доки', 'docs', 90),
  ],
}

export default function KanbanExample() {
  const [board, setBoard] = createSignal<Record<ColumnId, Card[]>>(INITIAL)
  const [log, setLog] = createSignal('перетащи карточку между колонками →')

  // раскидываем все карточки заново, сохраняя размеры колонок
  const shuffleBoard = () => {
    const all = shuffle(COLUMNS.flatMap((c) => board()[c]))
    withViewTransition(() => {
      const next = {} as Record<ColumnId, Card[]>
      let i = 0
      for (const c of COLUMNS) {
        const n = board()[c].length
        next[c] = all.slice(i, i + n)
        i += n
      }
      setBoard(next)
      setLog('перемешали — переезд анимирует браузер через View Transitions')
    })
  }

  const group = createSortableGroup({
    onEnd: (from, to) => {
      const next = { ...board() }
      const src = [...next[from.list as ColumnId]]
      const [moved] = src.splice(from.index, 1)
      if (!moved) return

      if (from.list === to.list) {
        src.splice(to.index, 0, moved)
        next[from.list as ColumnId] = src
      } else {
        const dst = [...next[to.list as ColumnId]]
        dst.splice(to.index, 0, moved)
        next[from.list as ColumnId] = src
        next[to.list as ColumnId] = dst
      }
      setBoard(next)
      setLog(`«${moved.title}»: ${TITLES[from.list as ColumnId]} #${from.index} → ${TITLES[to.list as ColumnId]} #${to.index}`)
    },
  })

  // «Готово» ничего не отдаёт обратно? Наоборот: покажем accepts — в «Бэклог»
  // нельзя вернуть карточку из «Готово».
  const lists = Object.fromEntries(
    COLUMNS.map((id) => [
      id,
      group.list(id, {
        order: () => board()[id].map((c) => c.id),
        accepts: (from) => !(id === 'todo' && from === 'done'),
      }),
    ]),
  ) as Record<ColumnId, ReturnType<typeof group.list>>

  return (
    <div style={{ padding: '16px', 'max-width': '1100px', margin: '0 auto', color: '#0f172a' }}>
      <p style={{ margin: '0 0 8px', 'font-size': '13px', color: '#64748b', 'max-width': '76ch' }}>
        Тащи карточку за <b>⠿</b> в любую колонку. Оригинал остаётся в потоке (прячется),
        поэтому колонки не схлопываются и высота не скачет, а за курсором летит клон
        в <b>top layer</b> — его не режет <code>overflow</code>, так что колонки спокойно
        скроллятся. Место, откуда карточку взяли, держится до дропа, колонка-приёмник
        раздвигается под вставку. <b>Esc</b> отменяет перенос. Из «Готово» в «Бэклог»
        перенести нельзя — это <code>accepts</code>.
      </p>

      <div style={{ display: 'flex', 'align-items': 'center', gap: '12px', 'margin-bottom': '12px',
                    'font-size': '13px', 'min-height': '20px', color: '#0f172a' }}>
        <span>{log()}</span>
        <button
          onClick={shuffleBoard}
          style={{ 'margin-left': 'auto', padding: '3px 10px', 'border-radius': '6px',
                   border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer',
                   font: 'inherit', 'font-size': '12px' }}
        >
          перемешать
        </button>
      </div>

      <div style={{ display: 'grid', 'grid-template-columns': 'repeat(4, 1fr)', gap: '12px', 'align-items': 'start' }}>
        <For each={COLUMNS}>
          {(colId) => {
            const isActive = () => group.activeList() === colId && !!group.draggingId()
            return (
              <section
                style={{
                  display: 'flex', 'flex-direction': 'column', 'min-width': '0',
                  border: '1px solid ' + (isActive() ? '#6366f1' : '#e2e8f0'),
                  'border-radius': '12px', background: isActive() ? '#eef2ff' : '#f8fafc',
                  transition: 'background .15s, border-color .15s',
                }}
              >
                <header style={{ padding: '10px 12px 6px', display: 'flex', 'align-items': 'center', gap: '6px' }}>
                  <strong style={{ 'font-size': '13px' }}>{TITLES[colId]}</strong>
                  <span style={{ 'font-size': '12px', color: '#94a3b8' }}>{board()[colId].length}</span>
                </header>

                {/* сам скроллящийся контейнер зоны */}
                <div
                  ref={lists[colId].container}
                  style={{
                    display: 'flex', 'flex-direction': 'column', gap: '8px',
                    padding: '8px', 'min-height': '120px', 'max-height': '46vh',
                    'overflow-y': 'auto', 'overflow-x': 'hidden',
                  }}
                >
                  <For each={board()[colId]}>
                    {(c) => (
                      <article
                        ref={lists[colId].bind(c.id)}
                        style={{
                          display: 'flex', 'align-items': 'flex-start', gap: '8px',
                          padding: '10px', 'border-radius': '10px', background: '#fff',
                          'box-shadow': 'inset 0 0 0 1px #e2e8f0', 'font-size': '13px',
                          // имя нужно, чтобы браузер анимировал КАЖДУЮ карточку отдельно,
                          // а не делал кроссфейд всей доски
                          'view-transition-name': `kanban-${c.id}`,
                        }}
                      >
                        <button
                          data-drag-handle
                          style={{
                            cursor: 'grab', border: 'none', background: 'none', padding: '0',
                            color: '#94a3b8', 'font-size': '16px', 'line-height': '1', 'touch-action': 'none',
                          }}
                          title="перетащить"
                        >
                          ⠿
                        </button>
                        <div style={{ 'min-width': '0' }}>
                          <div style={{ 'font-weight': '500' }}>{c.title}</div>
                          <span
                            style={{
                              display: 'inline-block', 'margin-top': '4px', padding: '1px 7px',
                              'border-radius': '999px', 'font-size': '11px',
                              background: `oklch(0.93 0.05 ${c.hue})`, color: `oklch(0.42 0.13 ${c.hue})`,
                            }}
                          >
                            {c.tag}
                          </span>
                        </div>
                      </article>
                    )}
                  </For>

                  <Show when={!board()[colId].length}>
                    <div style={{ padding: '18px 8px', 'text-align': 'center', color: '#cbd5e1', 'font-size': '12px' }}>
                      перетащи сюда
                    </div>
                  </Show>
                </div>
              </section>
            )
          }}
        </For>
      </div>
    </div>
  )
}
