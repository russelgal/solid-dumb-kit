// DumbGrid + createSortableGroup — сетка, чьи блоки САМИ являются контейнерами.
//
// Два жеста живут друг в друге и не дерутся:
//   • блок-колонка двигается и ресайзится сеткой — за ⠿ в своей шапке;
//   • карточки внутри перетаскиваются между блоками — за своё ⠿.
// Разводятся они по двум правилам кита: у блока есть [data-drag-handle], поэтому
// с остального его тела драг не стартует, а карточки помечены [data-flip-id], и
// нажатие по ним DumbGrid пропускает мимо себя.
//
// Переключатель edit mode гасит только сетку: карточки продолжают ездить.
import { createMemo, createSignal, For, Show } from 'solid-js'
import { createSortableGroup, DumbGrid, type DumbGridItem } from 'solid-dumb-kit'

type Card = { id: string; title: string; tag: string; hue: number }
type Column = { id: string; title: string; w: DumbGridItem['w']; h: number }

const STORAGE_KEY = 'example:board-grid'

const card = (id: string, title: string, tag: string, hue: number): Card => ({ id, title, tag, hue })

const COLUMNS: Array<Column> = [
  { id: 'todo', title: 'Бэклог', w: 'third', h: 4 },
  { id: 'doing', title: 'В работе', w: 'third', h: 4 },
  { id: 'done', title: 'Готово', w: 'third', h: 4 },
]

const CARDS: Record<string, Array<Card>> = {
  todo: [
    card('t1', 'Кросс-контейнерный драг', 'core', 265),
    card('t2', 'Клавиатурная доступность', 'a11y', 200),
    card('t3', 'Виртуализованные списки', 'perf', 30),
  ],
  doing: [
    card('d1', 'Убрать forced layout из кадра', 'perf', 30),
    card('d2', 'Пример «сетка + канбан»', 'docs', 90),
  ],
  done: [card('n1', 'Раскладка по папкам', 'chore', 220)],
}

export default function BoardExample() {
  const [columns, setColumns] = createSignal<Array<Column>>(COLUMNS)
  const [cards, setCards] = createSignal<Record<string, Array<Card>>>(CARDS)
  const [edit, setEdit] = createSignal(true)
  const [log, setLog] = createSignal('тащи карточку между блоками, а блок — за ⠿ в шапке')
  const [seq, setSeq] = createSignal(0)

  const group = createSortableGroup({
    onEnd: (from, to) => {
      const next = { ...cards() }
      const src = [...(next[from.list] ?? [])]
      const [moved] = src.splice(from.index, 1)
      if (!moved) return

      if (from.list === to.list) {
        src.splice(to.index, 0, moved)
        next[from.list] = src
      } else {
        const dst = [...(next[to.list] ?? [])]
        dst.splice(to.index, 0, moved)
        next[from.list] = src
        next[to.list] = dst
      }
      setCards(next)
      setLog(`«${moved.title}»: ${from.list} #${from.index} → ${to.list} #${to.index}`)
    },
  })

  // Зоны регистрируем по одной на колонку и кэшируем: список колонок меняется
  // (их добавляют и удаляют), а зона должна пережить перерисовку.
  const zones = new Map<string, ReturnType<typeof group.list>>()
  const zoneOf = (id: string) => {
    let zone = zones.get(id)
    if (!zone) {
      zone = group.list(id, { order: () => (cards()[id] ?? []).map((c) => c.id) })
      zones.set(id, zone)
    }
    return zone
  }

  const addColumn = () => {
    const n = seq() + 1
    setSeq(n)
    const id = `col-${n}`
    setCards((c) => ({ ...c, [id]: [] }))
    setColumns((list) => [...list, { id, title: `Колонка ${n}`, w: 'third', h: 4 }])
  }

  const removeColumn = (id: string) => {
    // карточки удалённой колонки не бросаем — возвращаем в первую
    const rest = columns().filter((c) => c.id !== id)
    const home = rest[0]?.id
    setCards((c) => {
      const next = { ...c }
      const orphans = next[id] ?? []
      delete next[id]
      if (home && orphans.length) next[home] = [...(next[home] ?? []), ...orphans]
      return next
    })
    zones.delete(id)
    setColumns(rest)
    setLog(home ? `колонку убрали, карточки уехали в «${rest[0].title}»` : 'колонку убрали')
  }

  // items зависит ТОЛЬКО от набора колонок: перетаскивание карточки не должно
  // трогать раскладку сетки, иначе блоки перерисуются посреди чужого жеста
  const items = createMemo<Array<DumbGridItem>>(() =>
    columns().map((col) => ({
      id: col.id,
      w: col.w,
      h: col.h,
      minW: 'quarter',
      minH: 2,
      content: () => <ColumnBody col={col} />,
    })),
  )

  const ColumnBody = (p: { col: Column }) => {
    const zone = zoneOf(p.col.id)
    const list = () => cards()[p.col.id] ?? []
    const active = () => group.activeList() === p.col.id && !!group.draggingId()

    return (
      <section class="col" classList={{ active: active() }}>
        {/* ручка блока: за неё сетка двигает всю колонку */}
        <header data-drag-handle>
          <span class="grip">⠿</span>
          <strong>{p.col.title}</strong>
          <span class="count">{list().length}</span>
        </header>

        <div class="cards" ref={zone.container}>
          <For each={list()}>
            {(c) => (
              <article class="card" ref={zone.bind(c.id)}>
                <button class="handle" data-drag-handle type="button" title="перетащить карточку">⠿</button>
                <div class="body">
                  <div class="title">{c.title}</div>
                  <span
                    class="tag"
                    style={{
                      background: `oklch(0.93 0.05 ${c.hue})`,
                      color: `oklch(0.42 0.13 ${c.hue})`,
                    }}
                  >
                    {c.tag}
                  </span>
                </div>
              </article>
            )}
          </For>
          <Show when={!list().length}>
            <div class="empty">перетащи сюда</div>
          </Show>
        </div>
      </section>
    )
  }

  return (
    <div class="bd-example">
      <h3>DumbGrid × Kanban</h3>
      <p class="note">
        Блоки сетки здесь — <b>контейнеры</b>. Колонку двигаешь и ресайзишь как блок дашборда (за <b>⠿</b> в
        её шапке), карточки внутри переносишь между колонками. Жесты не путаются: у блока есть ручка, а
        карточки помечены <code>data-flip-id</code>, и сетка нажатия по ним пропускает. Выключи{' '}
        <b>edit mode</b> — сетка застынет, а канбан останется живым.
      </p>

      <div class="bar">
        <label class="switch">
          <input type="checkbox" checked={edit()} onChange={(e) => setEdit(e.currentTarget.checked)} />
          <b>edit mode</b>
        </label>
        <button onClick={addColumn}>+ колонка</button>
        <span class="log">{log()}</span>
      </div>

      <DumbGrid
        storageKey={STORAGE_KEY}
        cols={12}
        rowHeight={92}
        gap={12}
        editable={edit()}
        items={items()}
        onRemove={removeColumn}
        labels={{ remove: 'Убрать колонку' }}
        blockStyle={{ cursor: 'default' }}
      />

      <style>{`
        .bd-example { padding: 16px; max-width: 1100px; margin: 0 auto; color: #0f172a }
        .bd-example h3 { margin: 0 0 4px }
        .bd-example .note { margin: 0 0 10px; font-size: 13px; color: #64748b; max-width: 82ch }
        .bd-example .bar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
                           margin: 0 0 12px; font-size: 13px }
        .bd-example .switch { display: inline-flex; gap: 6px; align-items: center;
                              padding: 4px 10px; border: 1px solid #cbd5e1;
                              border-radius: 999px; background: #fff }
        .bd-example .bar button { font: inherit; padding: 4px 10px; border: 1px solid #cbd5e1;
                                  border-radius: 8px; background: #fff; cursor: pointer }
        .bd-example .log { color: #64748b }

        .bd-example .col { height: 100%; display: flex; flex-direction: column; min-width: 0;
                           box-sizing: border-box; border-radius: 12px; border: 1px solid #e2e8f0;
                           background: #f8fafc; transition: background .15s, border-color .15s }
        .bd-example .col.active { border-color: #6366f1; background: #eef2ff }
        .bd-example .col header { display: flex; align-items: center; gap: 8px; padding: 8px 10px;
                                  cursor: grab; user-select: none; font-size: 13px;
                                  border-bottom: 1px solid #e9eef5 }
        .bd-example .col header:active { cursor: grabbing }
        .bd-example .grip { color: #94a3b8; line-height: 1 }
        .bd-example .count { margin-left: auto; margin-right: 18px; font-size: 12px; color: #94a3b8 }

        .bd-example .cards { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 8px;
                             padding: 8px; overflow-y: auto; scrollbar-gutter: stable }
        .bd-example .empty { padding: 16px 8px; text-align: center; color: #cbd5e1; font-size: 12px }

        .bd-example .card { display: flex; align-items: flex-start; gap: 8px; padding: 10px;
                            border-radius: 10px; background: #fff; font-size: 13px;
                            box-shadow: inset 0 0 0 1px #e2e8f0 }
        .bd-example .card .handle { cursor: grab; border: none; background: none; padding: 0;
                                    color: #94a3b8; font-size: 16px; line-height: 1; touch-action: none }
        .bd-example .card .title { font-weight: 500 }
        .bd-example .card .tag { display: inline-block; margin-top: 4px; padding: 1px 7px;
                                 border-radius: 999px; font-size: 11px }
      `}</style>
    </div>
  )
}
