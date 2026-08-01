import { render } from 'solid-js/web'
import { createSignal, For, Show, onCleanup, type JSX } from 'solid-js'

import SelectionAreaExample from '../../examples/pointer/SelectionArea.example'
import DumbSortableExample from '../../examples/pointer/DumbSortable.example'
import KanbanExample from '../../examples/pointer/Kanban.example'
import ResizableGridExample from '../../examples/pointer/ResizableGrid.example'
import DumbGridExample from '../../examples/pointer/DumbGrid.example'
import BoardExample from '../../examples/pointer/Board.example'

import DumbGridDndExample from '../../examples/dnd/DumbGridDnd.example'
import DumbSortableDndExample from '../../examples/dnd/DumbSortableDnd.example'
import DumbBoardExample from '../../examples/dnd/DumbBoard.example'

import DumbTreeExample from '../../examples/data/DumbTree.example'
import DumbTableExample from '../../examples/data/DumbTable.example'
import Odata1CExample from '../../examples/data/Odata1C.example'
import UtilsExample from '../../examples/data/utils.example'

import RawDndExample from '../../examples/lab/RawDnd.example'
import CssOrderExample from '../../examples/lab/CssOrder.example'
import FlipBenchExample from '../../examples/lab/FlipBench.example'
import OrderKanbanExample from '../../examples/lab/OrderKanban.example'
import OrderBoardExample from '../../examples/lab/OrderBoard.example'
import OrderTableExample from '../../examples/lab/OrderTable.example'
import OrderTreeExample from '../../examples/lab/OrderTree.example'

/** Вкладка витрины. `pkg` — какой пакет ставить, чтобы пример заработал. */
type Tab = {
  id: string
  label: string
  hint: string
  pkg?: string
  Comp: () => JSX.Element
}

type Group = { title: string; note: string; items: Array<Tab> }

// Разложено по тому, ЧЕМ ведётся жест, а не по алфавиту и не по виду виджета.
// Это главное деление в ките: указательные события и нативный drag-and-drop —
// две несмешиваемые механики, и половина компонентов существует в обеих. У
// каждого примера подписан пакет, который надо поставить, чтобы он заработал.
//
// Папки в `examples/` названы так же: pointer, dnd, data, lab.
const GROUPS: Array<Group> = [
  {
    title: 'Указатель',
    note: 'pointer events: работает пальцем, зону под курсором считаем сами',
    items: [
      { id: 'selection', label: 'SelectionArea', pkg: 'selection', hint: 'рамка выделения', Comp: SelectionAreaExample },
      { id: 'sortable', label: 'DumbSortable', pkg: 'sortable', hint: 'список и сетка', Comp: DumbSortableExample },
      { id: 'kanban', label: 'Kanban', pkg: 'sortable', hint: 'между колонками', Comp: KanbanExample },
      { id: 'grid', label: 'ResizableGrid', pkg: 'resizable-grid', hint: 'панели с ресайзом', Comp: ResizableGridExample },
      { id: 'dashboard', label: 'DumbGrid', pkg: 'grid', hint: 'дашборд', Comp: DumbGridExample },
      { id: 'board', label: 'Вложенные сетки', pkg: 'grid', hint: 'сетка в сетке', Comp: BoardExample },
    ],
  },
  {
    title: 'Нативный DnD',
    note: 'HTML5 drag-and-drop: зону решает браузер, тач не поддерживается',
    items: [
      { id: 'dnd', label: 'DumbGridDnd', pkg: 'grid-dnd', hint: 'сетка на HTML5 DnD', Comp: DumbGridDndExample },
      { id: 'sortdnd', label: 'DumbSortableDnd', pkg: 'sortable-dnd', hint: 'список и сетка плиток', Comp: DumbSortableDndExample },
      { id: 'board2', label: 'DumbBoard', pkg: 'board', hint: 'секции, блоки, ресайз', Comp: DumbBoardExample },
    ],
  },
  {
    title: 'Данные',
    note: 'таблицы, деревья и утилиты — жест тут не главное',
    items: [
      { id: 'tree', label: 'DumbTree', pkg: 'tree', hint: 'дерево и плоский список', Comp: DumbTreeExample },
      { id: 'table', label: 'DumbTable', pkg: 'table', hint: 'TanStack + драг строк', Comp: DumbTableExample },
      { id: 'odata1c', label: 'Odata1C', pkg: 'odata-1c', hint: 'клиент 1С, без Solid', Comp: Odata1CExample },
      { id: 'utils', label: 'utils', pkg: 'utils', hint: 'формат, slug, zip', Comp: UtilsExample },
    ],
  },
  {
    title: 'Лаборатория',
    note: 'без кита вообще — проверяем идеи на голых событиях браузера',
    items: [
      { id: 'rawdnd', label: 'Нативный DnD с нуля', hint: 'три обработчика, без анимаций', Comp: RawDndExample },
      { id: 'cssorder', label: 'CSS order + FLIP', pkg: 'shared', hint: 'сортировка без перестановки DOM', Comp: CssOrderExample },
      { id: 'flipbench', label: 'Замер vs снимок', pkg: 'shared', hint: 'сколько стоит померить', Comp: FlipBenchExample },
      { id: 'orderkanban', label: 'Канбан на order', pkg: 'shared', hint: 'колонки и переезды', Comp: OrderKanbanExample },
      { id: 'orderboard', label: 'Доска на order', pkg: 'shared', hint: 'вложенные сетки и ресайз', Comp: OrderBoardExample },
      { id: 'ordertable', label: 'Таблица на order', pkg: 'shared', hint: 'subgrid + сортировка', Comp: OrderTableExample },
      { id: 'ordertree', label: 'Дерево на order', pkg: 'shared', hint: 'перенос между уровнями', Comp: OrderTreeExample },
    ],
  },
]

const TABS = GROUPS.flatMap((g) => g.items)

// Навигация по hash: вкладка живёт в URL (#kanban), поэтому на конкретный
// пример можно дать прямую ссылку, а F5 не сбрасывает выбор. Hash, а не
// history API — демо стоит на GitHub Pages, где /solid-dumb-kit/kanban отдал бы 404.
const fromHash = (): string => {
  const id = location.hash.replace(/^#/, '')
  return TABS.some((t) => t.id === id) ? id : TABS[0].id
}

function App() {
  const [tab, setTab] = createSignal(fromHash())

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
                <div class="pg-group-title" title={group.note}>{group.title}</div>
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
                      <Show when={t.pkg}>
                        <span class="pg-pkg">@solid-dumb-kit/{t.pkg}</span>
                      </Show>
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
        /* какой пакет ставить — видно прямо в меню, чтобы не искать по докам */
        .pg-pkg { display: block; margin-top: 2px; font-size: 10.5px; color: #cbd5e1;
                  font-family: ui-monospace, SFMono-Regular, monospace }
        .pg-link.active .pg-pkg { color: #a5b4fc }

        .pg-gh { margin-top: auto; padding: 8px; font-size: 13px; color: #3b82f6; text-decoration: none }

        .pg-main { flex: 1; min-width: 0 }

      `}</style>
    </div>
  )
}

render(() => <App />, document.getElementById('root')!)
