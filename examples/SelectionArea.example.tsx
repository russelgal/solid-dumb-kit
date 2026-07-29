// SelectionArea — Finder-style rubber-band selection.
// Two setups on purpose: a scrolling container, and a long grid with no
// overflow at all (the page scrolls). The engine handles both — in the second
// case the band is clamped to the container and auto-scroll drives the window.
import { createSignal, For, type JSX } from 'solid-js'
import { SelectionArea } from 'solid-dumb-kit'

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
    <section style={{ 'margin-bottom': '28px' }}>
      <div style={{ display: 'flex', 'align-items': 'center', gap: '12px', 'margin-bottom': '8px', 'flex-wrap': 'wrap' }}>
        <h3 style={{ margin: '0', 'font-size': '15px' }}>{props.title}</h3>
        <span style={{ 'font-size': '13px', color: '#64748b' }}>{props.hint}</span>
        <span style={{ 'margin-left': 'auto', 'font-size': '14px' }}>
          выделено <b>{selected().size}</b> / {items().length}
        </span>
        <button
          onClick={() => setSelected(new Set())}
          disabled={!selected().size}
          style={{ padding: '4px 10px', 'border-radius': '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
        >
          сбросить
        </button>
        <button
          onClick={removeSelected}
          disabled={!selected().size}
          style={{ padding: '4px 10px', 'border-radius': '6px', cursor: 'pointer',
                   border: '1px solid ' + (selected().size ? '#dc2626' : '#cbd5e1'),
                   background: selected().size ? '#dc2626' : '#fff',
                   color: selected().size ? '#fff' : '#94a3b8' }}
        >
          удалить выделенное
        </button>
      </div>

      <SelectionArea
        selectables=".sa-card"
        selected={selected}
        onChange={setSelected}
        style={{
          padding: '12px',
          border: '1px solid #e2e8f0',
          'border-radius': '12px',
          background: '#f8fafc',
          ...(props.scroll
            ? { 'max-height': '60vh', 'overflow-y': 'auto', 'overflow-x': 'hidden' }
            : {}),
        }}
      >
        <div
          style={{
            display: 'grid',
            'grid-template-columns': 'repeat(auto-fill, minmax(92px, 1fr))',
            gap: '10px',
          }}
        >
          <For each={items()}>
            {(f) => {
              const on = () => selected().has(f.id)
              return (
                <div
                  class="sa-card"
                  data-key={f.id}
                  style={{
                    display: 'flex', 'flex-direction': 'column', 'align-items': 'center', gap: '4px',
                    padding: '12px 6px', 'border-radius': '10px', 'user-select': 'none', cursor: 'default',
                    background: on() ? '#dbeafe' : '#fff',
                    'box-shadow': on() ? 'inset 0 0 0 2px #3b82f6' : 'inset 0 0 0 1px #e2e8f0',
                    transition: 'background .1s, box-shadow .1s',
                  }}
                >
                  <div style={{ 'font-size': '26px' }}>{f.icon}</div>
                  <div style={{ 'font-size': '11px', color: '#475569' }}>{f.name}</div>
                </div>
              )
            }}
          </For>
        </div>
      </SelectionArea>
    </section>
  )
}

export default function SelectionAreaExample() {
  return (
    <div style={{ padding: '16px', color: '#0f172a', 'max-width': '900px', margin: '0 auto' }}>
      <p style={{ margin: '0 0 16px', 'font-size': '13px', color: '#64748b', 'max-width': '76ch' }}>
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
