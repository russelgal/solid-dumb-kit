// SelectionArea — Finder-style rubber-band selection over 100 file tiles.
// Drag an empty area to draw a box; Shift / Cmd / Ctrl to add to the selection.
import { createSignal, For } from 'solid-js'
import { SelectionArea } from 'solid-dumb-kit'
import 'solid-dumb-kit/dist/index.css'

const ICONS = ['🗂️', '🖼️', '🎵', '🎬', '📄', '📦', '🧩', '🗒️']
const FILES = Array.from({ length: 100 }, (_, i) => ({
  id: `f${i}`,
  name: `file-${String(i + 1).padStart(3, '0')}`,
  icon: ICONS[i % ICONS.length],
}))

export default function SelectionAreaExample() {
  const [selected, setSelected] = createSignal<Set<string>>(new Set())

  return (
    <div style={{ padding: '16px', color: '#0f172a', 'max-width': '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', 'align-items': 'center', gap: '12px', 'margin-bottom': '10px' }}>
        <h3 style={{ margin: '0' }}>SelectionArea</h3>
        <span style={{ 'font-size': '13px', color: '#64748b' }}>
          drag to select · hold <kbd>Shift</kbd>/<kbd>⌘</kbd> to add
        </span>
        <span style={{ 'margin-left': 'auto', 'font-size': '14px' }}>
          selected <b>{selected().size}</b> / {FILES.length}
        </span>
        <button
          onClick={() => setSelected(new Set())}
          disabled={!selected().size}
          style={{ padding: '4px 10px', 'border-radius': '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
        >
          clear
        </button>
      </div>

      <SelectionArea
        class="sa-board"
        selectables=".sa-card"
        onSelect={({ store }) =>
          setSelected(new Set(
            [...store.stored, ...store.selected].map(el => (el as HTMLElement).dataset.key!),
          ))
        }
      >
        <div
          style={{
            display: 'grid',
            'grid-template-columns': 'repeat(auto-fill, minmax(92px, 1fr))',
            gap: '10px',
            'max-height': '60vh',
            overflow: 'auto',
            padding: '12px',
            border: '1px solid #e2e8f0',
            'border-radius': '12px',
            background: '#f8fafc',
          }}
        >
          <For each={FILES}>
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
    </div>
  )
}
