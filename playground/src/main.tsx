import "./app.css";
import { render } from "solid-js/web";
import { createEffect, createSignal, For, Show, onCleanup, type JSX } from "solid-js";

import SelectionAreaExample from "../../examples/pointer/SelectionArea.example";
import DumbSortableExample from "../../examples/pointer/DumbSortable.example";
import KanbanExample from "../../examples/pointer/Kanban.example";
import ResizableGridExample from "../../examples/pointer/ResizableGrid.example";
import DumbGalleryExample from "../../examples/pointer/DumbGallery.example";
import DumbLightboxExample from "../../examples/pointer/DumbLightbox.example";
import ContextMenuExample from "../../examples/pointer/ContextMenu.example";
import DumbTimelineExample from "../../examples/pointer/DumbTimeline.example";
import DumbGridExample from "../../examples/pointer/DumbGrid.example";
import BoardExample from "../../examples/pointer/Board.example";

import DumbGridDndExample from "../../examples/dnd/DumbGridDnd.example";
import DumbSortableDndExample from "../../examples/dnd/DumbSortableDnd.example";
import DumbBoardExample from "../../examples/dnd/DumbBoard.example";
import DumbBoardEvenExample from "../../examples/dnd/DumbBoardEven.example";

import DumbTreeExample from "../../examples/data/DumbTree.example";
import DumbTableExample from "../../examples/data/DumbTable.example";
import DumbFinderExample from "../../examples/data/DumbFinder.example";
import VirtualExample from "../../examples/data/virtual.example";
import DumbPropsTableExample from "../../examples/data/DumbPropsTable.example";
import PrimitivesExample from "../../examples/data/primitives.example";
import Odata1CExample from "../../examples/data/Odata1C.example";
import UtilsExample from "../../examples/data/utils.example";

import RawDndExample from "../../examples/lab/RawDnd.example";
import CssOrderExample from "../../examples/lab/CssOrder.example";
import FlipBenchExample from "../../examples/lab/FlipBench.example";
import OrderKanbanExample from "../../examples/lab/OrderKanban.example";
import OrderBoardExample from "../../examples/lab/OrderBoard.example";
import OrderTableExample from "../../examples/lab/OrderTable.example";
import OrderTreeExample from "../../examples/lab/OrderTree.example";

/** Вкладка витрины. `pkg` — какой пакет ставить, чтобы пример заработал. */
type Tab = {
  id: string;
  label: string;
  hint: string;
  pkg?: string;
  Comp: () => JSX.Element;
};

type Group = { title: string; note: string; items: Array<Tab> };

// Разложено по тому, ЧЕМ ведётся жест, а не по алфавиту и не по виду виджета.
// Это главное деление в ките: указательные события и нативный drag-and-drop —
// две несмешиваемые механики, и половина компонентов существует в обеих. У
// каждого примера подписан пакет, который надо поставить, чтобы он заработал.
//
// Папки в `examples/` названы так же: pointer, dnd, data, lab.
const GROUPS: Array<Group> = [
  {
    title: "Указатель",
    note: "pointer events: работает пальцем, зону под курсором считаем сами",
    items: [
      {
        id: "selection",
        label: "SelectionArea",
        pkg: "selection",
        hint: "рамка выделения",
        Comp: SelectionAreaExample,
      },
      {
        id: "sortable",
        label: "DumbSortable",
        pkg: "sortable",
        hint: "список и сетка",
        Comp: DumbSortableExample,
      },
      {
        id: "kanban",
        label: "Kanban",
        pkg: "sortable",
        hint: "между колонками",
        Comp: KanbanExample,
      },
      {
        id: "gallery",
        label: "DumbGallery",
        pkg: "gallery",
        hint: "картинки: выбор, порядок, заливка",
        Comp: DumbGalleryExample,
      },
      {
        id: "lightbox",
        label: "DumbLightbox",
        pkg: "lightbox",
        hint: "просмотр во весь экран",
        Comp: DumbLightboxExample,
      },
      {
        id: "menu",
        label: "DumbContextMenu",
        pkg: "context-menu",
        hint: "правый клик + тосты",
        Comp: ContextMenuExample,
      },
      {
        id: "timeline",
        label: "DumbTimeline",
        pkg: "timeline",
        hint: "шахматка: брони по дням",
        Comp: DumbTimelineExample,
      },
      {
        id: "grid",
        label: "ResizableGrid",
        pkg: "resizable-grid",
        hint: "панели с ресайзом",
        Comp: ResizableGridExample,
      },
      {
        id: "dashboard",
        label: "DumbGrid",
        pkg: "grid",
        hint: "дашборд",
        Comp: DumbGridExample,
      },
      {
        id: "board",
        label: "Вложенные сетки",
        pkg: "grid",
        hint: "сетка в сетке",
        Comp: BoardExample,
      },
    ],
  },
  {
    title: "Нативный DnD",
    note: "HTML5 drag-and-drop: зону решает браузер, тач не поддерживается",
    items: [
      {
        id: "dnd",
        label: "DumbGridDnd",
        pkg: "grid-dnd",
        hint: "сетка на HTML5 DnD",
        Comp: DumbGridDndExample,
      },
      {
        id: "sortdnd",
        label: "DumbSortableDnd",
        pkg: "sortable-dnd",
        hint: "список и сетка плиток",
        Comp: DumbSortableDndExample,
      },
      {
        id: "board2",
        label: "DumbBoard",
        pkg: "board",
        hint: "секции, блоки, ресайз",
        Comp: DumbBoardExample,
      },
      {
        id: "dashboard2",
        label: "Дашборд на DumbBoard",
        pkg: "board",
        hint: "карточки одной высоты",
        Comp: DumbBoardEvenExample,
      },
    ],
  },
  {
    title: "Данные",
    note: "таблицы, деревья и утилиты — жест тут не главное",
    items: [
      {
        id: "tree",
        label: "DumbTree",
        pkg: "tree",
        hint: "дерево и плоский список",
        Comp: DumbTreeExample,
      },
      {
        id: "table",
        label: "DumbTable",
        pkg: "table",
        hint: "TanStack + драг строк",
        Comp: DumbTableExample,
      },
      {
        id: "finder",
        label: "DumbFinder",
        pkg: "finder",
        hint: "файлы в хранилище",
        Comp: DumbFinderExample,
      },
      {
        id: "virtual",
        label: "createVirtualizer",
        pkg: "shared",
        hint: "миллион строк, пул узлов, воркер",
        Comp: VirtualExample,
      },
      {
        id: "props-table",
        label: "DumbPropsTable",
        pkg: "props-table",
        hint: "что пришло в пропсах",
        Comp: DumbPropsTableExample,
      },
      {
        id: "primitives",
        label: "Примитивы",
        pkg: "shared",
        hint: "отмена, клавиатура, правка",
        Comp: PrimitivesExample,
      },
      {
        id: "odata1c",
        label: "Odata1C",
        pkg: "odata-1c",
        hint: "клиент 1С, без Solid",
        Comp: Odata1CExample,
      },
      {
        id: "utils",
        label: "utils",
        pkg: "utils",
        hint: "формат, slug, zip",
        Comp: UtilsExample,
      },
    ],
  },
  {
    title: "Лаборатория",
    note: "без кита вообще — проверяем идеи на голых событиях браузера",
    items: [
      {
        id: "rawdnd",
        label: "Нативный DnD с нуля",
        hint: "три обработчика, без анимаций",
        Comp: RawDndExample,
      },
      {
        id: "cssorder",
        label: "CSS order + FLIP",
        pkg: "shared",
        hint: "сортировка без перестановки DOM",
        Comp: CssOrderExample,
      },
      {
        id: "flipbench",
        label: "Замер vs снимок",
        pkg: "shared",
        hint: "сколько стоит померить",
        Comp: FlipBenchExample,
      },
      {
        id: "orderkanban",
        label: "Канбан на order",
        pkg: "shared",
        hint: "колонки и переезды",
        Comp: OrderKanbanExample,
      },
      {
        id: "orderboard",
        label: "Доска на order",
        pkg: "shared",
        hint: "вложенные сетки и ресайз",
        Comp: OrderBoardExample,
      },
      {
        id: "ordertable",
        label: "Таблица на order",
        pkg: "shared",
        hint: "subgrid + сортировка",
        Comp: OrderTableExample,
      },
      {
        id: "ordertree",
        label: "Дерево на order",
        pkg: "shared",
        hint: "перенос между уровнями",
        Comp: OrderTreeExample,
      },
    ],
  },
];

const TABS = GROUPS.flatMap((g) => g.items);

// Навигация по hash: вкладка живёт в URL (#kanban), поэтому на конкретный
// пример можно дать прямую ссылку, а F5 не сбрасывает выбор. Hash, а не
// history API — демо стоит на GitHub Pages, где /solid-dumb-kit/kanban отдал бы 404.
const fromHash = (): string => {
  const id = location.hash.replace(/^#/, "");
  return TABS.some((t) => t.id === id) ? id : TABS[0].id;
};

/**
 * Тема витрины. Две штуки нарочно: светлая `nord` и `dark` — на второй сразу
 * видно захардкоженный светлый цвет, если он куда-то пролез.
 *
 * Пишем в `data-theme` на `<html>` (так daisyUI и переключает темы) и помним
 * выбор в `localStorage`. Начальное значение читаем ДО первого рендера, иначе
 * страница успевает моргнуть светлой.
 */
const THEMES = ["nord", "dark"] as const;
type Theme = (typeof THEMES)[number];

const readTheme = (): Theme => {
  const saved = localStorage.getItem("sd-theme");
  if (saved && THEMES.includes(saved as Theme)) return saved as Theme;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "nord";
};

function App() {
  const [tab, setTab] = createSignal(fromHash());
  const [theme, setTheme] = createSignal<Theme>(readTheme());

  createEffect(() => {
    document.documentElement.dataset.theme = theme();
    localStorage.setItem("sd-theme", theme());
  });

  const onHash = () => setTab(fromHash());
  window.addEventListener("hashchange", onHash);
  onCleanup(() => window.removeEventListener("hashchange", onHash));

  return (
    <div class="flex min-h-screen items-start">
      <aside class="sticky top-0 h-screen w-60 shrink-0 overflow-y-auto border-r border-base-300 bg-base-200 [scrollbar-gutter:stable]">
        <div class="flex items-center gap-2 px-4 pt-4 pb-2">
          <a
            class="min-w-0 flex-1 truncate text-base font-semibold no-underline"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              location.hash = TABS[0].id;
            }}
          >
            solid-dumb-kit
          </a>

          {/* Переключатель темы. Кнопка, а не `swap`: тем ровно две, и подпись
              «что включится» понятнее иконки-состояния. */}
          <button
            type="button"
            class="btn btn-ghost btn-xs"
            title={`Тема: ${theme()} — переключить`}
            aria-label={`Тема ${theme()}, переключить`}
            onClick={() => setTheme(theme() === "nord" ? "dark" : "nord")}
          >
            {theme() === "nord" ? "☀ nord" : "☾ dark"}
          </button>
        </div>

        <ul class="menu w-full gap-0.5 p-2">
          <For each={GROUPS}>
            {(group) => (
              <>
                <li class="menu-title text-primary text-xl" title={group.note}>
                  {group.title}
                </li>
                <For each={group.items}>
                  {(t) => (
                    <li>
                      <a
                        class="py-2"
                        classList={{ "menu-active": tab() === t.id }}
                        href={`#${t.id}`}
                        aria-current={tab() === t.id ? "page" : undefined}
                      >
                        {/* Пункт меню у daisyUI — grid в СТРОКУ: без обёртки
                            подпись, описание и имя пакета встали бы рядом и
                            налезли друг на друга. Оборачиваем в один блок. */}
                        <span class="flex min-w-0 flex-col">
                          <span class="font-medium">{t.label}</span>
                          <span class="text-xs opacity-80">{t.hint}</span>
                          {/* какой пакет ставить — видно прямо в меню, чтобы не искать по докам */}
                          <Show when={t.pkg}>
                            <span class="truncate font-mono text-[10.5px] opacity-60">
                              @solid-dumb-kit/{t.pkg}
                            </span>
                          </Show>
                        </span>
                      </a>
                    </li>
                  )}
                </For>
              </>
            )}
          </For>
        </ul>

        <a
          class="link link-primary block px-4 pt-1 pb-4 text-sm"
          href="https://github.com/russelgal/solid-dumb-kit"
        >
          GitHub ↗
        </a>
      </aside>

      <main class="min-w-0 flex-1">
        <For each={TABS}>
          {(t) => (
            <Show when={tab() === t.id}>
              <t.Comp />
            </Show>
          )}
        </For>
      </main>
    </div>
  );
}

render(() => <App />, document.getElementById("root")!);
