// ResizableGrid — 3 resizable columns + a resizable second row.
// Drag the gaps between panels; sizes persist to localStorage (reload to see).
// NOTE: the grid fills its parent — give the PARENT a height.
import { For } from 'solid-js'
import { ResizableGrid } from '@solid-dumb-kit/resizable-grid'

// цвета приходят пропсами — единственное, что остаётся инлайном; по умолчанию
// берём токены темы, иначе панель светится белым в тёмной
const Panel = (p: { title: string; bg?: string; fg?: string; children?: any }) => (
  <div
    class="box-border h-full overflow-auto px-3.5 py-3"
    style={{ background: p.bg ?? 'var(--color-base-100)', color: p.fg ?? 'var(--color-base-content)' }}
  >
    <div class="mb-2 text-xs uppercase tracking-wide opacity-60">{p.title}</div>
    {p.children}
  </div>
)

const list = (n: number, label: string) => (
  <For each={Array.from({ length: n }, (_, i) => i)}>
    {(i) => <div class="rounded px-1.5 py-1 text-[13px]" classList={{ 'bg-base-content/10': i % 2 === 0 }}>{label} {i + 1}</div>}
  </For>
)

export default function ResizableGridExample() {
  return (
    <div class="p-5">
      <h3 class="mb-1 text-lg font-semibold">ResizableGrid</h3>
      <p class="mb-2.5 text-[13px] text-base-content">
        Drag the gaps ↔ between columns and ↕ between rows. Sizes are saved to <code>localStorage</code> — reload and they stick.
      </p>

      {/* грид растягивается на родителя — высоту задаём ЕМУ */}
      <div class="h-[70vh] overflow-hidden rounded-xl border border-base-300">
        <ResizableGrid
          storageKey="example:resizable-grid"
          rowInitial={2}
          row2Initial={1}
          rowMin={120}
          cols={[
            { id: 'tree', min: 160, initial: 1, content: () => <Panel title="Sidebar" bg="var(--color-base-200)">{list(20, 'Item')}</Panel> },
            { id: 'main', min: 320, initial: 3, content: () => (
              <Panel title="Editor">
                <p class="mb-2">Main panel — grab a divider and drag.</p>
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

    </div>
  )
}
