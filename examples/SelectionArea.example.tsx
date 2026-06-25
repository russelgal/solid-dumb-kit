// SelectionArea — rubber-band selection over a grid of cards.
// Drag to select; Shift/Cmd/Ctrl to add. Drop into any Solid + Vite app.
import { createSignal, For } from 'solid-js'
import { SelectionArea } from 'solid-dumb-kit'
import 'solid-dumb-kit/dist/index.css'

const FILES = Array.from({ length: 24 }, (_, i) => ({ id: `f${i}`, name: `file-${i + 1}.png` }))

export default function SelectionAreaExample() {
  const [selected, setSelected] = createSignal<Set<string>>(new Set())

  return (
    <div style={{ padding: '16px', color: '#334155' }}>
      <p>
        Selected: <b>{selected().size}</b>{' '}
        <button onClick={() => setSelected(new Set())} disabled={!selected().size}>clear</button>
      </p>

      <SelectionArea
        selectables=".sa-card"
        intersect="touch"
        onSelect={({ store }) =>
          setSelected(new Set(
            [...store.stored, ...store.selected].map(el => (el as HTMLElement).dataset.key!),
          ))
        }
      >
        <div style={{ display: 'grid', 'grid-template-columns': 'repeat(6, 1fr)', gap: '8px' }}>
          <For each={FILES}>
            {(f) => (
              <div
                class="sa-card"
                data-key={f.id}
                style={{
                  border: '1px solid #cbd5e1',
                  'border-radius': '8px',
                  padding: '12px',
                  'text-align': 'center',
                  'font-size': '13px',
                  background: selected().has(f.id) ? '#dbeafe' : '#fff',
                  'border-color': selected().has(f.id) ? '#3b82f6' : '#cbd5e1',
                  'user-select': 'none',
                }}
              >
                {f.name}
              </div>
            )}
          </For>
        </div>
      </SelectionArea>

      {/* Or style the auto-applied class instead of deriving state:
          .sa-card.viselect-selected { outline: 2px solid #3b82f6; } */}
    </div>
  )
}
