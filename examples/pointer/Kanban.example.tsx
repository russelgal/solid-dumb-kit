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
    <div class="p-5 text-base-content">
      <p class="mb-2 text-[13px] text-base-content">
        Тащи карточку за <b>⠿</b> в любую колонку. Оригинал остаётся в потоке (прячется),
        поэтому колонки не схлопываются и высота не скачет, а за курсором летит клон
        в <b>top layer</b> — его не режет <code>overflow</code>, так что колонки спокойно
        скроллятся. Место, откуда карточку взяли, держится до дропа, колонка-приёмник
        раздвигается под вставку. <b>Esc</b> отменяет перенос. Из «Готово» в «Бэклог»
        перенести нельзя — это <code>accepts</code>.
      </p>

      <div class="mb-3 flex min-h-5 items-center gap-3 text-[13px]">
        <span>{log()}</span>
        <button class="btn btn-xs ml-auto" onClick={shuffleBoard}>перемешать</button>
      </div>

      <div class="grid grid-cols-4 items-start gap-3">
        <For each={COLUMNS}>
          {(colId) => {
            const isActive = () => group.activeList() === colId && !!group.draggingId()
            return (
              <section
                class="flex min-w-0 flex-col rounded-xl border border-base-300 bg-base-200 transition-colors [&>header]:flex [&>header]:items-center [&>header]:gap-1.5 [&>header]:px-3 [&>header]:pt-2.5 [&>header]:pb-1.5 [&>header]:text-[13px]"
                classList={{ 'border-primary bg-primary/15': isActive() }}
              >
                <header>
                  <strong>{TITLES[colId]}</strong>
                  <span class="text-xs text-base-content">{board()[colId].length}</span>
                </header>

                {/* сам скроллящийся контейнер зоны */}
                <div class="flex max-h-[46vh] min-h-30 flex-col gap-2 overflow-x-hidden overflow-y-auto p-2" ref={lists[colId].container}>
                  <For each={board()[colId]}>
                    {(c) => (
                      <article
                        class="flex items-start gap-2 rounded-box bg-base-100 p-2.5 text-[13px] ring-1 ring-base-300"
                        ref={lists[colId].bind(c.id)}
                        // имя нужно, чтобы браузер анимировал КАЖДУЮ карточку отдельно,
                        // а не делал кроссфейд всей доски
                        style={{ 'view-transition-name': `kanban-${c.id}` }}
                      >
                        <button class="cursor-grab border-none bg-none p-0 text-base/none text-base-content [touch-action:none]" data-drag-handle type="button" title="перетащить">⠿</button>
                        <div class="min-w-0">
                          <div class="font-medium">{c.title}</div>
                          {/* Цвет из данных — единственное, что остаётся инлайном.
                              Не готовая светлая плашка, а подмешивание оттенка в
                              фон темы: тогда метка живёт и в тёмной теме. */}
                          <span
                            class="mt-1 inline-block rounded-full px-1.5 py-px text-[11px]"
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
                    <div class="px-2 py-4.5 text-center text-xs text-base-content">перетащи сюда</div>
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
