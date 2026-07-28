import { render } from 'solid-js/web'
import { createSignal, For, Show, onCleanup } from 'solid-js'
import SelectionAreaExample from '../../examples/SelectionArea.example'
import DumbSortableExample from '../../examples/DumbSortable.example'
import ResizableGridExample from '../../examples/ResizableGrid.example'
import DumbTreeExample from '../../examples/DumbTree.example'
import DumbTableExample from '../../examples/DumbTable.example'
import KanbanExample from '../../examples/Kanban.example'
import UtilsExample from '../../examples/utils.example'

const TABS = [
  { id: 'selection', label: 'SelectionArea', Comp: SelectionAreaExample },
  { id: 'sortable', label: 'DumbSortable', Comp: DumbSortableExample },
  { id: 'kanban', label: 'Kanban (cross-list)', Comp: KanbanExample },
  { id: 'grid', label: 'ResizableGrid', Comp: ResizableGridExample },
  { id: 'tree', label: 'DumbTree', Comp: DumbTreeExample },
  { id: 'table', label: 'DumbTable', Comp: DumbTableExample },
  { id: 'utils', label: 'utils', Comp: UtilsExample },
] as const

type TabId = (typeof TABS)[number]['id']

// Навигация по hash: вкладка живёт в URL (#kanban), поэтому на конкретный
// пример можно дать прямую ссылку, а F5 не сбрасывает выбор. Hash, а не
// history API — демо стоит на GitHub Pages, где /solid-dumb-kit/kanban отдал бы 404.
const fromHash = (): TabId => {
  const id = location.hash.replace(/^#/, '')
  return TABS.some((t) => t.id === id) ? (id as TabId) : TABS[0].id
}

function App() {
  const [tab, setTab] = createSignal<TabId>(fromHash())

  const onHash = () => setTab(fromHash())
  window.addEventListener('hashchange', onHash)
  onCleanup(() => window.removeEventListener('hashchange', onHash))

  const go = (id: TabId) => {
    location.hash = id          // hashchange сам обновит сигнал
  }

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
            <a
              href={`#${t.id}`}
              onClick={(e) => { e.preventDefault(); go(t.id) }}
              style={{
                padding: '6px 12px', 'border-radius': '8px', cursor: 'pointer',
                'text-decoration': 'none', 'font-size': '14px',
                border: '1px solid ' + (tab() === t.id ? '#3b82f6' : '#cbd5e1'),
                background: tab() === t.id ? '#3b82f6' : '#fff',
                color: tab() === t.id ? '#fff' : '#0f172a',
              }}
            >
              {t.label}
            </a>
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
