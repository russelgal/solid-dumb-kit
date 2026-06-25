// ResizableGrid — 3 resizable columns + a resizable second row.
// Drag the gaps between panels; sizes persist to localStorage (reload to see).
// NOTE: the grid fills its parent — give the PARENT a height.
import { For } from 'solid-js'
import { ResizableGrid } from 'solid-dumb-kit'

const Panel = (p: { title: string; bg?: string; fg?: string; children?: any }) => (
  <div style={{ height: '100%', padding: '12px 14px', 'box-sizing': 'border-box',
                background: p.bg ?? '#fff', color: p.fg ?? '#0f172a' }}>
    <div style={{ 'font-size': '12px', 'text-transform': 'uppercase', 'letter-spacing': '.04em',
                  opacity: '.6', 'margin-bottom': '8px' }}>{p.title}</div>
    {p.children}
  </div>
)

const list = (n: number, label: string) => (
  <For each={Array.from({ length: n }, (_, i) => i)}>
    {(i) => <div style={{ padding: '4px 6px', 'border-radius': '6px', 'font-size': '13px',
                          background: i % 2 ? 'transparent' : 'rgba(148,163,184,.12)' }}>{label} {i + 1}</div>}
  </For>
)

export default function ResizableGridExample() {
  return (
    <div style={{ padding: '16px', 'max-width': '980px', margin: '0 auto' }}>
      <h3 style={{ margin: '0 0 4px' }}>ResizableGrid</h3>
      <p style={{ margin: '0 0 10px', 'font-size': '13px', color: '#64748b' }}>
        Drag the gaps ↔ between columns and ↕ between rows. Sizes are saved to <code>localStorage</code> — reload and they stick.
      </p>

      <div style={{ height: '70vh', border: '1px solid #e2e8f0', 'border-radius': '12px', overflow: 'hidden' }}>
        <ResizableGrid
          storageKey="example:resizable-grid"
          rowInitial={2}
          row2Initial={1}
          rowMin={120}
          cols={[
            { id: 'tree', min: 160, initial: 1, content: () => <Panel title="Sidebar" bg="#f1f5f9">{list(20, 'Item')}</Panel> },
            { id: 'main', min: 320, initial: 3, content: () => (
              <Panel title="Editor">
                <p style={{ margin: '0 0 8px' }}>Main panel — grab a divider and drag.</p>
                {list(12, 'Line')}
              </Panel>
            ) },
            { id: 'aside', min: 180, initial: 1, content: () => <Panel title="Outline" bg="#f8fafc">{list(14, 'Heading')}</Panel> },
          ]}
          rows={[
            { id: 'console', min: 140, initial: 2, content: () => <Panel title="Console" bg="#0f172a" fg="#e2e8f0">{list(10, 'log')}</Panel> },
            { id: 'inspect', min: 140, initial: 1, content: () => <Panel title="Inspector" bg="#1e293b" fg="#e2e8f0">{list(8, 'prop')}</Panel> },
          ]}
        />
      </div>
    </div>
  )
}
