import "./app.css";
import { render } from "solid-js/web";
import { createEffect, createMemo, createSignal, For, Show, onCleanup, type JSX } from "solid-js";

import ThemeShowcase from "./ThemeShowcase";

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
import DumbUserManagerExample from "../../examples/data/DumbUserManager.example";
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
        id: "user-manager",
        label: "DumbUserManager",
        pkg: "user-manager",
        hint: "доступ сотрудников",
        Comp: DumbUserManagerExample,
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
    title: "Витрина",
    note: "оформление самой демо-страницы: тема, токены, органы управления",
    items: [
      {
        id: "theme",
        label: "Тема",
        hint: "палитра, кнопки, формы, декор",
        Comp: ThemeShowcase,
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
 * Тема витрины. Светлая `nord`, `dark` — на ней сразу видно захардкоженный
 * светлый цвет, если он куда-то пролез, — и своя `scifi` (описана в `app.css`):
 * она ловит второй сорт хардкода, серый из палитры Tailwind вместо токена темы.
 *
 * Пишем в `data-theme` на `<html>` (так daisyUI и переключает темы) и помним
 * выбор в `localStorage`. Начальное значение читаем ДО первого рендера, иначе
 * страница успевает моргнуть светлой.
 */
const THEMES = ["nord", "dark", "scifi", "scifi-light"] as const;
type Theme = (typeof THEMES)[number];

const THEME_LABEL: Record<Theme, string> = {
  nord: "☀ nord",
  dark: "☾ dark",
  scifi: "⬡ scifi",
  "scifi-light": "⬡ scifi·день",
};

const readTheme = (): Theme => {
  const saved = localStorage.getItem("sd-theme");
  if (saved && THEMES.includes(saved as Theme)) return saved as Theme;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "nord";
};

/** Совпадение по названию, подсказке и имени пакета — регистр не важен. */
const matches = (t: Tab, q: string): boolean => {
  const hay = `${t.label} ${t.hint} ${t.pkg ?? ""} ${t.id}`.toLowerCase();
  return q.split(/\s+/).every((w) => hay.includes(w));
};

function App() {
  const [tab, setTab] = createSignal(fromHash());
  const [theme, setTheme] = createSignal<Theme>(readTheme());

  // Поиск по меню. Тридцать примеров в четырёх группах — это два экрана
  // прокрутки, и глазами искать дольше, чем набрать три буквы.
  const [query, setQuery] = createSignal("");
  const searching = () => query().trim().length > 0;

  // Свёрнутые группы. Храним именно СВЁРНУТЫЕ, а не открытые: новая группа в
  // `GROUPS` тогда появляется раскрытой, без правки сохранённого состояния.
  const [folded, setFolded] = createSignal<string[]>(
    JSON.parse(localStorage.getItem("sd-folded") ?? "[]"),
  );
  const isOpen = (title: string) => searching() || !folded().includes(title);
  const toggleGroup = (title: string) =>
    setFolded((cur) => {
      const next = cur.includes(title) ? cur.filter((t) => t !== title) : [...cur, title];
      localStorage.setItem("sd-folded", JSON.stringify(next));
      return next;
    });

  // Сайдбар целиком — примеру с широкой сеткой лишние 16rem не лишние.
  const [hidden, setHidden] = createSignal(localStorage.getItem("sd-nav-hidden") === "1");
  const toggleNav = () => {
    const next = !hidden();
    setHidden(next);
    localStorage.setItem("sd-nav-hidden", next ? "1" : "0");
  };

  const groups = createMemo(() => {
    const q = query().trim().toLowerCase();
    if (!q) return GROUPS;
    return GROUPS.map((g) => ({ ...g, items: g.items.filter((t) => matches(t, q)) })).filter(
      (g) => g.items.length > 0,
    );
  });
  /** Плоский список видимого — по нему ходят стрелки в поле поиска. */
  const visible = createMemo(() => groups().flatMap((g) => g.items));

  // Курсор клавиатуры. Отдельный от выбранной вкладки: стрелками бегаем по
  // списку, а переход делает Enter — так поиск не дёргает тяжёлые примеры.
  const [cursor, setCursor] = createSignal(0);
  const cursorId = () => visible()[cursor()]?.id;

  createEffect(() => {
    document.documentElement.dataset.theme = theme();
    localStorage.setItem("sd-theme", theme());
  });

  const onHash = () => setTab(fromHash());
  window.addEventListener("hashchange", onHash);
  onCleanup(() => window.removeEventListener("hashchange", onHash));

  let searchEl: HTMLInputElement | undefined;

  // Глобальные хоткеи: `/` и ⌘K/Ctrl+K — в поиск. Проверка на поле ввода
  // обязательна, иначе слэш перестанет печататься в примерах с инпутами.
  const onKey = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    const typing =
      !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    const hotK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
    if (hotK || (e.key === "/" && !typing)) {
      e.preventDefault();
      setHidden(false);
      searchEl?.focus();
      searchEl?.select();
    }
  };
  window.addEventListener("keydown", onKey);
  onCleanup(() => window.removeEventListener("keydown", onKey));

  const onSearchKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setQuery("");
      searchEl?.blur();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = visible().length;
      if (!n) return;
      setCursor((c) => (e.key === "ArrowDown" ? (c + 1) % n : (c - 1 + n) % n));
      return;
    }
    if (e.key === "Enter") {
      const id = cursorId();
      if (id) {
        location.hash = id;
        searchEl?.blur();
      }
    }
  };

  return (
    <div class="flex min-h-screen items-start">
      {/* Свёрнутый сайдбар — узкая полоса с одной кнопкой: навигация никогда не
          пропадает совсем, иначе на GitHub Pages из примера некуда вернуться. */}
      <Show when={hidden()}>
        <div class="sticky top-0 flex h-screen w-10 shrink-0 flex-col items-center gap-2 border-r border-base-300 bg-base-200 py-3">
          <button
            type="button"
            class="btn btn-ghost btn-xs"
            title="Показать навигацию (⌘K)"
            aria-label="Показать навигацию"
            onClick={toggleNav}
          >
            ☰
          </button>
        </div>
      </Show>

      <Show when={!hidden()}>
        <aside class="sticky top-0 flex h-screen w-68 shrink-0 flex-col border-r border-base-300 bg-base-200">
          <div class="flex items-center gap-1 px-3 pt-3">
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

            {/* Переключатель темы. Кнопка, а не `swap`: тем больше двух, и подпись
                с названием понятнее иконки-состояния. Клик — следующая по кругу. */}
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              title={`Тема: ${theme()} — переключить`}
              aria-label={`Тема ${theme()}, переключить`}
              onClick={() => setTheme(THEMES[(THEMES.indexOf(theme()) + 1) % THEMES.length])}
            >
              {THEME_LABEL[theme()]}
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              title="Скрыть навигацию"
              aria-label="Скрыть навигацию"
              onClick={toggleNav}
            >
              ⇤
            </button>
          </div>

          <div class="px-3 pt-2 pb-1">
            <label class="input input-sm w-full">
              <span aria-hidden="true">⌕</span>
              <input
                ref={searchEl}
                type="search"
                value={query()}
                placeholder="поиск примера"
                aria-label="Поиск примера"
                onInput={(e) => {
                  setQuery(e.currentTarget.value);
                  setCursor(0);
                }}
                onKeyDown={onSearchKey}
              />
              <kbd class="kbd kbd-xs">/</kbd>
            </label>
            <Show when={searching()}>
              <div class="px-1 pt-1 text-xs">
                {visible().length === 0
                  ? "ничего не найдено"
                  : `найдено: ${visible().length} · ↑↓ выбрать, Enter открыть`}
              </div>
            </Show>
          </div>

          {/* `flex-nowrap` обязателен: у daisyUI `.menu` — это flex-колонка с
              `flex-wrap: wrap`, и при ограниченной высоте (тут `flex-1`) она
              переносит группы во ВТОРУЮ колонку вместо прокрутки — половина
              меню уезжает за край сайдбара. */}
          <ul class="menu min-h-0 w-full flex-1 flex-nowrap gap-0.5 overflow-x-hidden overflow-y-auto p-2 [scrollbar-gutter:stable]">
            <For each={groups()}>
              {(group) => (
                <li>
                  {/* Аккордеон на `details` — разметка daisyUI для вложенного
                      меню: раскрытие держит браузер, нам остаётся состояние. */}
                  <details open={isOpen(group.title)}>
                    <summary
                      class="text-primary text-base font-semibold"
                      title={group.note}
                      onClick={(e) => {
                        e.preventDefault();
                        if (!searching()) toggleGroup(group.title);
                      }}
                    >
                      <span class="flex-1">{group.title}</span>
                      <span class="badge badge-sm badge-ghost">{group.items.length}</span>
                    </summary>

                    <ul class="gap-0.5">
                      <For each={group.items}>
                        {(t) => (
                          <li>
                            <a
                              class="py-1.5"
                              classList={{
                                "menu-active": tab() === t.id,
                                // курсор поиска: рамкой, а не фоном — фон уже
                                // занят активной вкладкой, и они бы спорили
                                "outline outline-primary": searching() && cursorId() === t.id,
                              }}
                              href={`#${t.id}`}
                              aria-current={tab() === t.id ? "page" : undefined}
                              title={t.pkg ? `${t.hint} · @solid-dumb-kit/${t.pkg}` : t.hint}
                            >
                              {/* Пункт меню у daisyUI — grid в СТРОКУ: без обёртки
                                  подпись, описание и имя пакета встали бы рядом и
                                  налезли друг на друга. Оборачиваем в один блок. */}
                              <span class="flex min-w-0 flex-col leading-snug">
                                <span class="truncate font-medium">{t.label}</span>
                                {/* Подсказка и пакет — только у текущего пункта и
                                    в поиске: тридцать пунктов по три строки и
                                    делали из меню простыню. Остальным хватает
                                    подсказки в `title`. */}
                                <Show when={tab() === t.id || searching()}>
                                  <span class="truncate text-xs">{t.hint}</span>
                                </Show>
                                <Show when={tab() === t.id && t.pkg}>
                                  <span class="truncate font-mono text-[10.5px]">
                                    @solid-dumb-kit/{t.pkg}
                                  </span>
                                </Show>
                              </span>
                            </a>
                          </li>
                        )}
                      </For>
                    </ul>
                  </details>
                </li>
              )}
            </For>
          </ul>

          <a
            class="link link-primary block shrink-0 border-t border-base-300 px-4 py-2 text-sm"
            href="https://github.com/russelgal/solid-dumb-kit"
          >
            GitHub ↗
          </a>
        </aside>
      </Show>

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
