// SelectionArea — Finder-style rubber-band selection.
// Two setups on purpose: a scrolling container, and a long grid with no
// overflow at all (the page scrolls). The engine handles both — in the second
// case the band is clamped to the container and auto-scroll drives the window.
import { createSignal, For, type JSX } from 'solid-js'
import { SelectionArea } from '@solid-dumb-kit/selection'

const ICONS = ['🗂️', '🖼️', '🎵', '🎬', '📄', '📦', '🧩', '🗒️']
const files = (n: number, prefix: string) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i}`,
    name: `file-${String(i + 1).padStart(3, '0')}`,
    icon: ICONS[i % ICONS.length],
  }))

const SCROLLING = files(100, 's')
const LONG = files(240, 'l')

function Board(props: {
  title: string
  hint: JSX.Element
  items: { id: string; name: string; icon: string }[]
  /** контейнер прокручивается сам; иначе скроллится страница */
  scroll?: boolean
}) {
  const [selected, setSelected] = createSignal<Set<string>>(new Set())
  const [items, setItems] = createSignal(props.items)

  const removeSelected = () => {
    const kill = selected()
    if (!kill.size) return
    setItems((prev) => prev.filter((f) => !kill.has(f.id)))
    setSelected(new Set())
  }

  return (
    <section class="board">
      <div class="toolbar">
        <h3>{props.title}</h3>
        <span class="hint">{props.hint}</span>
        <span class="count">выделено <b>{selected().size}</b> / {items().length}</span>
        <button class="btn" onClick={() => setSelected(new Set())} disabled={!selected().size}>
          сбросить
        </button>
        <button class="btn btn-danger" onClick={removeSelected} disabled={!selected().size}>
          удалить выделенное
        </button>
      </div>

      <SelectionArea
        class={props.scroll ? 'surface surface-scroll' : 'surface'}
        selectables=".card"
        selected={selected}
        onChange={setSelected}
      >
        <div class="grid">
          <For each={items()}>
            {(f) => (
              <div class="card" classList={{ on: selected().has(f.id) }} data-key={f.id}>
                <span class="icon">{f.icon}</span>
                <span class="name">{f.name}</span>
              </div>
            )}
          </For>
        </div>
      </SelectionArea>
    </section>
  )
}

export default function SelectionAreaExample() {
  return (
    <div class="sa-example">
      <p class="intro">
        Тяни рамку по пустому месту. <kbd>Shift</kbd>/<kbd>⌘</kbd> — добавить к выделению
        (по уже выделенному рамка не гасит). Клик выделяет один элемент, с модификатором —
        переключает, клик мимо — сбрасывает. Позиции снимаются один раз за жест, в кадре
        только арифметика — ноль reflow даже на сотнях плиток.
      </p>

      <Board
        title="Прокручиваемый контейнер"
        hint={<>у контейнера <code>overflow: auto</code> — скроллится он сам</>}
        items={SCROLLING}
        scroll
      />

      <Board
        title="Длинный грид без overflow"
        hint={<>контейнер не обрезан — скроллится страница, автоскролл ведёт окно</>}
        items={LONG}
      />

      <style>{`
        .sa-example { padding: 16px 20px; color: var(--color-base-content) }
        .sa-example .intro { margin: 0 0 16px; font-size: 13px; color: var(--color-base-content) }

        .board { margin-bottom: 28px }
        .toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; flex-wrap: wrap }
        .toolbar h3 { margin: 0; font-size: 15px }
        .toolbar .hint { font-size: 13px; color: var(--color-base-content) }
        .toolbar .count { margin-left: auto; font-size: 14px }

        .btn { padding: 4px 10px; border-radius: 6px; border: 1px solid var(--color-base-300);
               background: var(--color-base-100); color: inherit; font: inherit; cursor: pointer }
        .btn:disabled { color: var(--color-base-content); cursor: default }
        .btn-danger:not(:disabled) { border-color: var(--color-error); background: var(--color-error); color: var(--color-base-100) }

        .surface { padding: 12px; border: 1px solid var(--color-base-300); border-radius: 12px; background: var(--color-base-200) }
        .surface-scroll { max-height: 60vh; overflow-y: auto; overflow-x: hidden }

        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 10px }

        .card { display: flex; flex-direction: column; align-items: center; gap: 4px;
                padding: 12px 6px; border-radius: 10px; background: var(--color-base-100); cursor: default;
                user-select: none; box-shadow: inset 0 0 0 1px var(--color-base-300);
                transition: background .1s, box-shadow .1s }
        .card.on { background: color-mix(in oklch, var(--color-primary) 18%, var(--color-base-100)); box-shadow: inset 0 0 0 2px var(--color-primary) }
        .card .icon { font-size: 26px }
        .card .name { font-size: 11px; color: var(--color-base-content) }
      `}</style>
    </div>
  )
}
