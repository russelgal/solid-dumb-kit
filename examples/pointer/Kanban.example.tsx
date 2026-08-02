// createSortableGroup — перетаскивание МЕЖДУ контейнерами (канбан).
// Оригинал карточки остаётся в потоке своей колонки (просто прячется), поэтому
// колонки не схлопываются и высота не скачет. За курсором летит клон в top layer
// (Popover API) — его не режет overflow, так что колонки могут скроллиться.
import { createSignal, For, Show } from 'solid-js'
import { createSortableGroup } from '@solid-dumb-kit/sortable'

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
    <div class="kb-example">
      <p class="intro">
        Тащи карточку за <b>⠿</b> в любую колонку. Оригинал остаётся в потоке (прячется),
        поэтому колонки не схлопываются и высота не скачет, а за курсором летит клон
        в <b>top layer</b> — его не режет <code>overflow</code>, так что колонки спокойно
        скроллятся. Место, откуда карточку взяли, держится до дропа, колонка-приёмник
        раздвигается под вставку. <b>Esc</b> отменяет перенос. Из «Готово» в «Бэклог»
        перенести нельзя — это <code>accepts</code>.
      </p>

      <div class="toolbar">
        <span>{log()}</span>
        <button class="btn" onClick={shuffleBoard}>перемешать</button>
      </div>

      <div class="columns">
        <For each={COLUMNS}>
          {(colId) => {
            const isActive = () => group.activeList() === colId && !!group.draggingId()
            return (
              <section class="column" classList={{ active: isActive() }}>
                <header>
                  <strong>{TITLES[colId]}</strong>
                  <span class="count">{board()[colId].length}</span>
                </header>

                {/* сам скроллящийся контейнер зоны */}
                <div class="cards" ref={lists[colId].container}>
                  <For each={board()[colId]}>
                    {(c) => (
                      <article
                        class="card"
                        ref={lists[colId].bind(c.id)}
                        // имя нужно, чтобы браузер анимировал КАЖДУЮ карточку отдельно,
                        // а не делал кроссфейд всей доски
                        style={{ 'view-transition-name': `kanban-${c.id}` }}
                      >
                        <button class="handle" data-drag-handle type="button" title="перетащить">⠿</button>
                        <div class="body">
                          <div class="title">{c.title}</div>
                          {/* Цвет из данных — единственное, что остаётся инлайном.
                              Не готовая светлая плашка, а подмешивание оттенка в
                              фон темы: тогда метка живёт и в тёмной теме. */}
                          <span
                            class="tag"
                            style={{
                              background: `color-mix(in oklch, oklch(0.7 0.13 ${c.hue}) 22%, var(--color-base-100))`,
                              color: `color-mix(in oklch, oklch(0.62 0.15 ${c.hue}) 65%, var(--color-base-content))`,
                            }}
                          >
                            {c.tag}
                          </span>
                        </div>
                      </article>
                    )}
                  </For>

                  <Show when={!board()[colId].length}>
                    <div class="empty">перетащи сюда</div>
                  </Show>
                </div>
              </section>
            )
          }}
        </For>
      </div>

      <style>{`
        .kb-example { padding: 16px 20px; color: var(--color-base-content) }
        .kb-example .intro { margin: 0 0 8px; font-size: 13px; color: var(--color-base-content) }

        .toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px;
                   font-size: 13px; min-height: 20px }
        .btn { margin-left: auto; padding: 3px 10px; border-radius: 6px; border: 1px solid var(--color-base-300);
               background: var(--color-base-100); color: inherit; font: inherit; font-size: 12px; cursor: pointer }

        .columns { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; align-items: start }
        .column { display: flex; flex-direction: column; min-width: 0; border-radius: 12px;
                  border: 1px solid var(--color-base-300); background: var(--color-base-200);
                  transition: background .15s, border-color .15s }
        .column.active { border-color: var(--color-primary); background: color-mix(in oklch, var(--color-primary) 18%, var(--color-base-100)) }
        .column header { padding: 10px 12px 6px; display: flex; align-items: center; gap: 6px;
                         font-size: 13px }
        .column .count { font-size: 12px; color: var(--color-base-content) }

        .cards { display: flex; flex-direction: column; gap: 8px; padding: 8px;
                 min-height: 120px; max-height: 46vh; overflow-y: auto; overflow-x: hidden }
        .empty { padding: 18px 8px; text-align: center; color: var(--color-base-content); font-size: 12px }

        .card { display: flex; align-items: flex-start; gap: 8px; padding: 10px;
                border-radius: 10px; background: var(--color-base-100); font-size: 13px;
                box-shadow: inset 0 0 0 1px var(--color-base-300) }
        .card .handle { cursor: grab; border: none; background: none; padding: 0;
                        color: var(--color-base-content); font-size: 16px; line-height: 1; touch-action: none }
        .card .body { min-width: 0 }
        .card .title { font-weight: 500 }
        .card .tag { display: inline-block; margin-top: 4px; padding: 1px 7px;
                     border-radius: 999px; font-size: 11px }
      `}</style>
    </div>
  )
}
