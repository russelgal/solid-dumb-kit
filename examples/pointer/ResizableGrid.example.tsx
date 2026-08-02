// ResizableGrid — 3 resizable columns + a resizable second row.
// Drag the gaps between panels; sizes persist to localStorage (reload to see).
// NOTE: the grid fills its parent — give the PARENT a height.
import { For } from 'solid-js'
import { ResizableGrid } from '@solid-dumb-kit/resizable-grid'

// цвета приходят пропсами — единственное, что остаётся инлайном; по умолчанию
// берём токены темы, иначе панель светится белым в тёмной
const Panel = (p: { title: string; bg?: string; fg?: string; children?: any }) => (
  <div
    class="panel"
    style={{ background: p.bg ?? 'var(--color-base-100)', color: p.fg ?? 'var(--color-base-content)' }}
  >
    <div class="panel-title">{p.title}</div>
    {p.children}
  </div>
)

const list = (n: number, label: string) => (
  <For each={Array.from({ length: n }, (_, i) => i)}>
    {(i) => <div class="line" classList={{ odd: i % 2 === 0 }}>{label} {i + 1}</div>}
  </For>
)

export default function ResizableGridExample() {
  return (
    <div class="rg-example">
      <h3>ResizableGrid</h3>
      <p class="note">
        Drag the gaps ↔ between columns and ↕ between rows. Sizes are saved to <code>localStorage</code> — reload and they stick.
      </p>

      {/* грид растягивается на родителя — высоту задаём ЕМУ */}
      <div class="frame">
        <ResizableGrid
          storageKey="example:resizable-grid"
          rowInitial={2}
          row2Initial={1}
          rowMin={120}
          cols={[
            { id: 'tree', min: 160, initial: 1, content: () => <Panel title="Sidebar" bg="var(--color-base-200)">{list(20, 'Item')}</Panel> },
            { id: 'main', min: 320, initial: 3, content: () => (
              <Panel title="Editor">
                <p class="lead">Main panel — grab a divider and drag.</p>
                {list(12, 'Line')}
              </Panel>
            ) },
            { id: 'aside', min: 180, initial: 1, content: () => <Panel title="Outline" bg="var(--color-base-200)">{list(14, 'Heading')}</Panel> },
          ]}
          rows={[
            { id: 'console', min: 140, initial: 2, content: () => <Panel title="Console" bg="var(--color-neutral)" fg="var(--color-neutral-content)">{list(10, 'log')}</Panel> },
            { id: 'inspect', min: 140, initial: 1, content: () => <Panel title="Inspector" bg="color-mix(in oklch, var(--color-neutral) 85%, var(--color-base-100))" fg="var(--color-neutral-content)">{list(8, 'prop')}</Panel> },
          ]}
        />
      </div>

      <style>{`
        .rg-example { padding: 16px 20px }
        .rg-example h3 { margin: 0 0 4px }
        .rg-example .note { margin: 0 0 10px; font-size: 13px; color: var(--color-base-content) }
        .rg-example .frame { height: 70vh; border: 1px solid var(--color-base-300);
                             border-radius: 12px; overflow: hidden }

        .rg-example .panel { height: 100%; padding: 12px 14px; box-sizing: border-box; overflow: auto }
        .rg-example .panel-title { font-size: 12px; text-transform: uppercase;
                                   letter-spacing: .04em; opacity: .6; margin-bottom: 8px }
        .rg-example .lead { margin: 0 0 8px }
        .rg-example .line { padding: 4px 6px; border-radius: 6px; font-size: 13px }
        .rg-example .line.odd { background: color-mix(in oklch, var(--color-base-content) 12%, transparent) }
      `}</style>
    </div>
  )
}
