// ResizableGrid — 3 resizable columns + a resizable second row.
// Sizes persist to localStorage under storageKey. Drop into any Solid + Vite app.
// NOTE: give the PARENT a height — the grid fills it (h-full w-full).
import { ResizableGrid } from 'solid-dumb-kit'

const panel = (bg: string) =>
  ({ padding: '12px', height: '100%', background: bg, 'box-sizing': 'border-box' }) as const

export default function ResizableGridExample() {
  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <ResizableGrid
        storageKey="example:resizable-grid"
        rowInitial={2}
        row2Initial={1}
        rowMin={120}
        cols={[
          { id: 'tree', min: 160, initial: 1, content: () => <div style={panel('#f1f5f9')}>Sidebar</div> },
          { id: 'main', min: 320, initial: 3, content: () => <div style={panel('#fff')}>Main — drag the gaps to resize</div> },
          { id: 'aside', min: 180, initial: 1, content: () => <div style={panel('#f8fafc')}>Aside</div> },
        ]}
        rows={[
          { id: 'log', min: 140, initial: 2, content: () => <div style={panel('#0f172a')}><span style={{ color: '#e2e8f0' }}>Console</span></div> },
          { id: 'meta', min: 140, initial: 1, content: () => <div style={panel('#1e293b')}><span style={{ color: '#e2e8f0' }}>Inspector</span></div> },
        ]}
      />
    </div>
  )
}
