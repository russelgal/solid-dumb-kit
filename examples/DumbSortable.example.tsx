// DumbSortable — drag-reorder at scale: a 100-row list (drag by handle, auto-scrolls)
// and a 100-tile grid (drag the whole tile). No CSS needed.
import { createSignal, For } from 'solid-js'
import { DumbSortable } from 'solid-dumb-kit'

type Row = { id: string; label: string }
const rows = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: `r${i}`, label: `Track ${String(i + 1).padStart(3, '0')}` }))

const HUE = (i: number) => `oklch(0.75 0.13 ${(i * 37) % 360})`

const PILLS = [
  '⚡ 60fps @ 100s of items',
  '🛰️ IntersectionObserver bounds',
  '🧵 off-main-thread · 0 reflow',
  '🎮 GPU transforms',
  '🪶 zero deps',
  '📜 list + 🔲 grid',
  '🟰 variable row heights',
  '✋ drag-handle',
  '📱 touch long-press',
  '🧲 edge auto-scroll',
]

// рекламный сайдбар (справа) — фичи + перф-понты
function Promo() {
  return (
    <aside
      style={{
        width: '260px', 'flex-shrink': '0', position: 'sticky', top: '64px',
        padding: '18px', 'border-radius': '14px', color: '#fff',
        background: 'linear-gradient(160deg, #4f46e5, #7c3aed 55%, #db2777)',
        'box-shadow': '0 12px 28px -10px rgba(79,70,229,.55)',
      }}
    >
      <div style={{ 'font-size': '18px', 'font-weight': '700', 'margin-bottom': '6px' }}>
        DumbSortable ✨
      </div>
      <div style={{ 'font-size': '13px', opacity: '.92', 'margin-bottom': '12px', 'line-height': '1.5' }}>
        Blazing-fast, zero-dep FLIP reorder for SolidJS. Cell bounds read <b>once</b> via
        <b> IntersectionObserver</b> (off the main thread, <b>zero reflow</b>), then only GPU
        <code> transform</code>s — stays at 60fps with hundreds of rows. No per-frame
        <code> getBoundingClientRect</code> like dnd-kit.
      </div>
      <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '6px', 'margin-bottom': '14px' }}>
        <For each={PILLS}>
          {(t) => (
            <span style={{ 'font-size': '12px', padding: '4px 9px', 'border-radius': '999px',
                           background: 'rgba(255,255,255,.18)' }}>{t}</span>
          )}
        </For>
      </div>
      <code style={{ display: 'block', 'font-size': '13px', background: 'rgba(0,0,0,.25)',
                     padding: '8px 10px', 'border-radius': '8px', 'text-align': 'center' }}>
        npm i solid-dumb-kit
      </code>
    </aside>
  )
}

export default function DumbSortableExample() {
  const [list, setList] = createSignal<Row[]>(rows(100))
  const [tiles, setTiles] = createSignal<Row[]>(rows(100))

  return (
    <div style={{ padding: '16px', 'max-width': '1040px', margin: '0 auto', color: '#0f172a',
                  display: 'flex', gap: '20px', 'align-items': 'flex-start', 'flex-wrap': 'wrap' }}>
      {/* ── демки (основная колонка) ── */}
      <div style={{ flex: '1', 'min-width': '320px', display: 'grid', gap: '28px' }}>
        {/* Vertical list: drag by the ⠿ handle; container scrolls while dragging */}
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

        {/* Grid: axis="grid", drag the whole tile (no handle) */}
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

      {/* ── реклама (сайдбар справа) ── */}
      <Promo />
    </div>
  )
}
