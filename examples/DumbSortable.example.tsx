// DumbSortable — drag-reorder a list (by handle) and a grid. Toggle axis.
// Drop into any Solid + Vite app. No CSS needed.
import { createSignal, For } from 'solid-js'
import { DumbSortable } from 'solid-dumb-kit'

type Item = { id: string; label: string }
const seed = (n: number): Item[] => Array.from({ length: n }, (_, i) => ({ id: `i${i}`, label: `Item ${i + 1}` }))

export default function DumbSortableExample() {
  const [list, setList] = createSignal<Item[]>(seed(8))
  const [cards, setCards] = createSignal<Item[]>(seed(9))

  return (
    <div style={{ padding: '16px', display: 'grid', gap: '32px', 'max-width': '720px' }}>
      {/* ── Vertical list, drag by the ⠿ handle ── */}
      <section>
        <h3>List (drag by handle)</h3>
        <div style={{ display: 'grid', gap: '8px', 'max-height': '50vh', overflow: 'auto' }}>
          <DumbSortable items={list()} setItems={setList} id={(x) => x.id}>
            {(item) => (
              <div style={{ display: 'flex', 'align-items': 'center', gap: '10px',
                            border: '1px solid #cbd5e1', 'border-radius': '8px', padding: '10px 12px', background: '#fff' }}>
                <button data-drag-handle style={{ cursor: 'grab', border: 'none', background: 'none', 'font-size': '18px' }}>⠿</button>
                <span>{item.label}</span>
              </div>
            )}
          </DumbSortable>
        </div>
      </section>

      {/* ── Grid, drag the whole card (no handle) ── */}
      <section>
        <h3>Grid (drag the card)</h3>
        <div style={{ display: 'grid', 'grid-template-columns': 'repeat(3, 1fr)', gap: '8px' }}>
          <DumbSortable items={cards()} setItems={setCards} id={(x) => x.id} axis="grid">
            {(item) => (
              <div style={{ border: '1px solid #cbd5e1', 'border-radius': '8px', padding: '24px 12px',
                            'text-align': 'center', background: '#fff', cursor: 'grab', 'user-select': 'none' }}>
                {item.label}
              </div>
            )}
          </DumbSortable>
        </div>
      </section>
    </div>
  )
}
