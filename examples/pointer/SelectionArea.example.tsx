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
    <section class="mb-7">
      <div class="mb-2 flex flex-wrap items-center gap-3 [&_h3]:text-[15px]">
        <h3>{props.title}</h3>
        <span class="text-[13px] text-base-content">{props.hint}</span>
        <span class="ml-auto text-sm">выделено <b>{selected().size}</b> / {items().length}</span>
        <button class="btn btn-sm" onClick={() => setSelected(new Set())} disabled={!selected().size}>
          сбросить
        </button>
        <button class="btn btn-sm btn-error" onClick={removeSelected} disabled={!selected().size}>
          удалить выделенное
        </button>
      </div>

      <SelectionArea
        // Прокрутка вешается на САМ контейнер выделения — иначе рамка не
        // поедет вместе со списком. Классом, а не `classList`: компонент
        // принимает только `class` и `style`, остальное до элемента не дойдёт.
        // `surface-scroll` — метка без стилей, за неё держится смоук-тест.
        class={
          'surface rounded-xl border border-base-300 bg-base-200 p-3' +
          (props.scroll ? ' surface-scroll max-h-[60vh] overflow-x-hidden overflow-y-auto' : '')
        }
        selectables=".card"
        selected={selected}
        onChange={setSelected}
      >
        <div class="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2.5">
          <For each={items()}>
            {(f) => (
              <div
                class="card flex cursor-default flex-col items-center gap-1 rounded-box bg-base-100 px-1.5 py-3 ring-1 ring-base-300 transition-colors select-none"
                classList={{ 'bg-primary/15 ring-2 ring-primary': selected().has(f.id) }}
                data-key={f.id}
              >
                <span class="text-[26px]">{f.icon}</span>
                <span class="text-[11px] text-base-content">{f.name}</span>
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
    <div class="p-5 text-base-content">
      <p class="mb-4 text-[13px] text-base-content">
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

    </div>
  )
}
