import { render } from 'solid-js/web'
import { createSignal, For, Show } from 'solid-js'
import SelectionAreaExample from '../../examples/SelectionArea.example'
import DumbSortableExample from '../../examples/DumbSortable.example'
import ResizableGridExample from '../../examples/ResizableGrid.example'

const TABS = [
  { id: 'selection', label: 'SelectionArea', Comp: SelectionAreaExample },
  { id: 'sortable', label: 'DumbSortable', Comp: DumbSortableExample },
  { id: 'grid', label: 'ResizableGrid', Comp: ResizableGridExample },
] as const

function App() {
  const [tab, setTab] = createSignal<(typeof TABS)[number]['id']>('selection')

  return (
    <div style={{ font: '15px/1.5 system-ui, sans-serif', color: '#0f172a' }}>
      <header
        style={{
          display: 'flex', 'align-items': 'center', gap: '8px', 'flex-wrap': 'wrap',
          padding: '10px 16px', 'border-bottom': '1px solid #e2e8f0',
          position: 'sticky', top: '0', background: '#fff', 'z-index': '10',
        }}
      >
        <strong style={{ 'margin-right': '8px' }}>solid-dumb-kit</strong>
        <For each={TABS}>
          {(t) => (
            <button
              onClick={() => setTab(t.id)}
              style={{
                padding: '6px 12px', 'border-radius': '8px', cursor: 'pointer',
                border: '1px solid ' + (tab() === t.id ? '#3b82f6' : '#cbd5e1'),
                background: tab() === t.id ? '#3b82f6' : '#fff',
                color: tab() === t.id ? '#fff' : '#0f172a',
              }}
            >
              {t.label}
            </button>
          )}
        </For>
        <a href="https://github.com/russelgal/solid-dumb-kit" style={{ 'margin-left': 'auto', color: '#3b82f6' }}>
          GitHub ↗
        </a>
      </header>

      <main>
        <For each={TABS}>
          {(t) => (
            <Show when={tab() === t.id}>
              <t.Comp />
            </Show>
          )}
        </For>
      </main>
    </div>
  )
}

render(() => <App />, document.getElementById('root')!)
