// DumbSortable — drag-reorder at scale: a 100-row list (drag by handle, auto-scrolls)
// and a 100-tile grid (drag the whole tile). No CSS needed.
import { createSignal, For } from 'solid-js'
import { DumbSortable } from 'solid-dumb-kit'

type Row = { id: string; label: string }
const rows = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: `r${i}`, label: `Track ${String(i + 1).padStart(3, '0')}` }))

const HUE = (i: number) => `oklch(0.75 0.13 ${(i * 37) % 360})`

export default function DumbSortableExample() {
  const [list, setList] = createSignal<Row[]>(rows(100))
  const [tiles, setTiles] = createSignal<Row[]>(rows(100))

  return (
    <div style={{ padding: '16px', display: 'grid', gap: '28px', 'max-width': '900px', margin: '0 auto', color: '#0f172a' }}>
      {/* ── Vertical list: drag by the ⠿ handle; container scrolls while dragging ── */}
      <section>
        <h3 style={{ margin: '0 0 4px' }}>List — drag by the handle</h3>
        <p style={{ margin: '0 0 10px', 'font-size': '13px', color: '#64748b' }}>
          100 rows, fixed-height scroll area — drag near an edge and it auto-scrolls.
        </p>
        <div style={{ display: 'grid', gap: '6px', 'max-height': '52vh', overflow: 'auto',
                      padding: '10px', border: '1px solid #e2e8f0', 'border-radius': '12px', background: '#f8fafc' }}>
          <DumbSortable items={list()} setItems={setList} id={(x) => x.id}>
            {(item, i) => (
              <div style={{ display: 'flex', 'align-items': 'center', gap: '10px',
                            padding: '10px 12px', 'border-radius': '10px', background: '#fff',
                            'box-shadow': 'inset 0 0 0 1px #e2e8f0' }}>
                <button data-drag-handle
                  style={{ cursor: 'grab', border: 'none', background: 'none', 'font-size': '18px', color: '#94a3b8', padding: '0 2px', 'touch-action': 'none' }}
                  title="drag">⠿</button>
                <span style={{ width: '34px', 'font-variant-numeric': 'tabular-nums', color: '#94a3b8', 'font-size': '13px' }}>
                  {i() + 1}
                </span>
                <span style={{ width: '14px', height: '14px', 'border-radius': '4px', background: HUE(Number(item.id.slice(1))) }} />
                <span>{item.label}</span>
              </div>
            )}
          </DumbSortable>
        </div>
      </section>

      {/* ── Grid: axis="grid", drag the whole tile (no handle) ── */}
      <section>
        <h3 style={{ margin: '0 0 4px' }}>Grid — drag the tile</h3>
        <p style={{ margin: '0 0 10px', 'font-size': '13px', color: '#64748b' }}>
          100 tiles, <code>axis="grid"</code> — items reflow in 2D and jump across rows.
        </p>
        <div style={{ display: 'grid', 'grid-template-columns': 'repeat(auto-fill, minmax(64px, 1fr))', gap: '8px',
                      'max-height': '52vh', overflow: 'auto', padding: '10px',
                      border: '1px solid #e2e8f0', 'border-radius': '12px', background: '#f8fafc' }}>
          <DumbSortable items={tiles()} setItems={setTiles} id={(x) => x.id} axis="grid">
            {(item, i) => (
              <div style={{ 'aspect-ratio': '1', display: 'grid', 'place-items': 'center',
                            'border-radius': '10px', cursor: 'grab', 'user-select': 'none',
                            'font-weight': '600', color: '#1e293b',
                            background: HUE(Number(item.id.slice(1))) }}>
                {i() + 1}
              </div>
            )}
          </DumbSortable>
        </div>
      </section>
    </div>
  )
}
