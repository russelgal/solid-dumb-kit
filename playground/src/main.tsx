import { render } from 'solid-js/web'
import { createSignal, For, Show, onCleanup } from 'solid-js'
import SelectionAreaExample from '../../examples/SelectionArea.example'
import DumbSortableExample from '../../examples/DumbSortable.example'
import ResizableGridExample from '../../examples/ResizableGrid.example'
import DumbTreeExample from '../../examples/DumbTree.example'
import DumbTableExample from '../../examples/DumbTable.example'
import DumbGridExample from '../../examples/DumbGrid.example'
import BoardExample from '../../examples/Board.example'
import DumbGridDndExample from '../../examples/DumbGridDnd.example'
import DumbSortableDndExample from '../../examples/DumbSortableDnd.example'
import CssOrderExample from '../../examples/CssOrder.example'
import RawDndExample from '../../examples/RawDnd.example'
import FlipBenchExample from '../../examples/FlipBench.example'
import OrderKanbanExample from '../../examples/OrderKanban.example'
import OrderBoardExample from '../../examples/OrderBoard.example'
import OrderTableExample from '../../examples/OrderTable.example'
import OrderTreeExample from '../../examples/OrderTree.example'
import KanbanExample from '../../examples/Kanban.example'
import UtilsExample from '../../examples/utils.example'
import Odata1CExample from '../../examples/Odata1C.example'

// Примеры сгруппированы по тому, ЧЕМ они являются, а не по алфавиту: сначала
// жесты на указателе, потом их нативные двойники, потом всё остальное. Так
// сразу видно, что у половины компонентов есть по две реализации.
const GROUPS = [
  {
    title: 'Жесты',
    items: [
      { id: 'selection', label: 'SelectionArea', hint: 'рамка выделения', Comp: SelectionAreaExample },
      { id: 'sortable', label: 'DumbSortable', hint: 'список и сетка', Comp: DumbSortableExample },
      { id: 'kanban', label: 'Kanban', hint: 'между колонками', Comp: KanbanExample },
    ],
  },
  {
    title: 'Сетки',
    items: [
      { id: 'grid', label: 'ResizableGrid', hint: 'панели с ресайзом', Comp: ResizableGridExample },
      { id: 'dashboard', label: 'DumbGrid', hint: 'дашборд', Comp: DumbGridExample },
      { id: 'board', label: 'Вложенные сетки', hint: 'сетка в сетке', Comp: BoardExample },
    ],
  },
  {
    title: 'Нативный DnD',
    items: [
      { id: 'dnd', label: 'DumbGridDnd', hint: 'сетка на HTML5 DnD', Comp: DumbGridDndExample },
      { id: 'sortdnd', label: 'DumbSortableDnd', hint: 'список на HTML5 DnD', Comp: DumbSortableDndExample },
    ],
  },
  {
    title: 'Пробы',
    items: [
      { id: 'rawdnd', label: 'Нативный DnD с нуля', hint: 'три обработчика, без анимаций', Comp: RawDndExample },
      { id: 'cssorder', label: 'CSS order + FLIP', hint: 'перемешивание без DOM', Comp: CssOrderExample },
      { id: 'flipbench', label: 'Замер vs снимок', hint: 'сколько стоит померить', Comp: FlipBenchExample },
      { id: 'orderkanban', label: 'Канбан на order', hint: 'колонки и переезды', Comp: OrderKanbanExample },
      { id: 'orderboard', label: 'Доска на order', hint: 'вложенные сетки', Comp: OrderBoardExample },
      { id: 'ordertable', label: 'Таблица на order', hint: 'subgrid + сортировка', Comp: OrderTableExample },
      { id: 'ordertree', label: 'Дерево на order', hint: 'перенос между уровнями', Comp: OrderTreeExample },
    ],
  },
  {
    title: 'Данные',
    items: [
      { id: 'tree', label: 'DumbTree', hint: 'дерево и плоский список', Comp: DumbTreeExample },
      { id: 'table', label: 'DumbTable', hint: 'TanStack + драг строк', Comp: DumbTableExample },
      { id: 'odata1c', label: 'Odata1C', hint: 'клиент 1С', Comp: Odata1CExample },
      { id: 'utils', label: 'utils', hint: 'формат, slug, zip', Comp: UtilsExample },
    ],
  },
] as const

const TABS = GROUPS.flatMap((g) => g.items)
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

  return (
    <div class="pg">
      <aside class="pg-side">
        <a class="pg-brand" href="#" onClick={(e) => { e.preventDefault(); location.hash = TABS[0].id }}>
          solid-dumb-kit
        </a>

        <nav>
          <For each={GROUPS}>
            {(group) => (
              <div class="pg-group">
                <div class="pg-group-title">{group.title}</div>
                <For each={group.items}>
                  {(t) => (
                    <a
                      class="pg-link"
                      classList={{ active: tab() === t.id }}
                      href={`#${t.id}`}
                      aria-current={tab() === t.id ? 'page' : undefined}
                    >
                      <span class="pg-label">{t.label}</span>
                      <span class="pg-hint">{t.hint}</span>
                    </a>
                  )}
                </For>
              </div>
            )}
          </For>
        </nav>

        <a class="pg-gh" href="https://github.com/russelgal/solid-dumb-kit">GitHub ↗</a>
      </aside>

      <main class="pg-main">
        <For each={TABS}>
          {(t) => (
            <Show when={tab() === t.id}>
              <t.Comp />
            </Show>
          )}
        </For>
      </main>

      <style>{`
        .pg { font: 15px/1.5 system-ui, sans-serif; color: #0f172a; display: flex;
              align-items: flex-start; min-height: 100vh }

        .pg-side { position: sticky; top: 0; flex: 0 0 232px; width: 232px; height: 100vh;
                   box-sizing: border-box; display: flex; flex-direction: column; gap: 4px;
                   padding: 16px 12px; overflow-y: auto; scrollbar-gutter: stable;
                   border-right: 1px solid #e2e8f0; background: #fbfcfe }
        .pg-brand { display: block; padding: 4px 8px 12px; font-weight: 600; font-size: 15px;
                    color: #0f172a; text-decoration: none }

        .pg-group { margin-bottom: 10px }
        .pg-group-title { padding: 6px 8px 4px; font-size: 11px; font-weight: 600;
                          letter-spacing: .06em; text-transform: uppercase; color: #94a3b8 }

        .pg-link { display: block; padding: 6px 8px; border-radius: 8px; text-decoration: none;
                   color: #0f172a; border-left: 2px solid transparent }
        .pg-link:hover { background: #f1f5f9 }
        .pg-link.active { background: #eef2ff; border-left-color: #6366f1 }
        .pg-label { display: block; font-size: 13.5px; font-weight: 500 }
        .pg-link.active .pg-label { color: #4338ca }
        .pg-hint { display: block; font-size: 11.5px; color: #94a3b8 }

        .pg-gh { margin-top: auto; padding: 8px; font-size: 13px; color: #3b82f6; text-decoration: none }

        .pg-main { flex: 1; min-width: 0 }

      `}</style>
    </div>
  )
}

render(() => <App />, document.getElementById('root')!)
