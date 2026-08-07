import "./app.css";
import { render } from "solid-js/web";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  lazy,
  Show,
  Suspense,
  onCleanup,
  type JSX,
} from "solid-js";
import { A, Navigate, Route, Router, useLocation, useNavigate } from "@solidjs/router";

import { compOf } from "./examples";
// Версии пакетов и даты их последней правки — посчитаны на сборке из
// package.json и git (см. playground/kitMeta.ts), в браузер приезжает таблица.
import KIT_META from "virtual:kit-meta";

/** Куда ведут все ссылки «исходник» — репозиторий кита на GitHub. */
const REPO = "https://github.com/russelgal/solid-dumb-kit";

/** Вкладка витрины. `pkg` — какой пакет ставить, чтобы пример заработал. */
type Tab = {
  id: string;
  label: string;
  hint: string;
  pkg?: string;
  /** Путь к исходнику от корня репы: и чанк, и ссылка «исходник» в навбаре. */
  file: string;
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
        file: "examples/pointer/SelectionArea.example.tsx",
      },
      {
        id: "sortable",
        label: "DumbSortable",
        pkg: "sortable",
        hint: "список и сетка",
        file: "examples/pointer/DumbSortable.example.tsx",
      },
      {
        id: "kanban",
        label: "Kanban",
        pkg: "sortable",
        hint: "между колонками",
        file: "examples/pointer/Kanban.example.tsx",
      },
      {
        id: "gallery",
        label: "DumbGallery",
        pkg: "gallery",
        hint: "картинки: выбор, порядок, заливка",
        file: "examples/pointer/DumbGallery.example.tsx",
      },
      {
        id: "lightbox",
        label: "DumbLightbox",
        pkg: "lightbox",
        hint: "просмотр во весь экран",
        file: "examples/pointer/DumbLightbox.example.tsx",
      },
      {
        id: "menu",
        label: "DumbContextMenu",
        pkg: "context-menu",
        hint: "правый клик + тосты",
        file: "examples/pointer/ContextMenu.example.tsx",
      },
      {
        id: "modal",
        label: "DumbModal",
        pkg: "modal",
        hint: "нативный dialog в top layer",
        file: "examples/pointer/DumbModal.example.tsx",
      },
      {
        id: "toast",
        label: "DumbToast",
        pkg: "toast",
        hint: "сообщения, вопрос и модалка",
        file: "examples/pointer/DumbToast.example.tsx",
      },
      {
        id: "daterange",
        label: "DumbDateRange",
        pkg: "date-range",
        hint: "период с занятостью",
        file: "examples/pointer/DumbDateRange.example.tsx",
      },
      {
        id: "datetime",
        label: "DumbDateTimeRange",
        pkg: "date-range",
        hint: "период с временем, слоты",
        file: "examples/pointer/DumbDateTimeRange.example.tsx",
      },
      {
        id: "timeline",
        label: "DumbTimeline",
        pkg: "timeline",
        hint: "шахматка: брони по дням",
        file: "examples/pointer/DumbTimeline.example.tsx",
      },
      {
        id: "grid",
        label: "ResizableGrid",
        pkg: "resizable-grid",
        hint: "панели с ресайзом",
        file: "examples/pointer/ResizableGrid.example.tsx",
      },
      {
        id: "dashboard",
        label: "DumbGrid",
        pkg: "grid",
        hint: "дашборд",
        file: "examples/pointer/DumbGrid.example.tsx",
      },
      {
        id: "board",
        label: "Вложенные сетки",
        pkg: "grid",
        hint: "сетка в сетке",
        file: "examples/pointer/Board.example.tsx",
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
        file: "examples/dnd/DumbGridDnd.example.tsx",
      },
      {
        id: "sortdnd",
        label: "DumbSortableDnd",
        pkg: "sortable-dnd",
        hint: "список и сетка плиток",
        file: "examples/dnd/DumbSortableDnd.example.tsx",
      },
      {
        id: "board2",
        label: "DumbBoard",
        pkg: "board",
        hint: "секции, блоки, ресайз",
        file: "examples/dnd/DumbBoard.example.tsx",
      },
      {
        id: "dashboard2",
        label: "Дашборд на DumbBoard",
        pkg: "board",
        hint: "карточки одной высоты",
        file: "examples/dnd/DumbBoardEven.example.tsx",
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
        file: "examples/data/DumbTree.example.tsx",
      },
      {
        id: "table",
        label: "DumbTable",
        pkg: "table",
        hint: "TanStack + драг строк",
        file: "examples/data/DumbTable.example.tsx",
      },
      {
        id: "finder",
        label: "DumbFinder",
        pkg: "finder",
        hint: "файлы в хранилище",
        file: "examples/data/DumbFinder.example.tsx",
      },
      {
        id: "virtual",
        label: "createVirtualizer",
        pkg: "shared",
        hint: "миллион строк, пул узлов, воркер",
        file: "examples/data/virtual.example.tsx",
      },
      {
        id: "user-manager",
        label: "DumbUserManager",
        pkg: "user-manager",
        hint: "доступ сотрудников",
        file: "examples/data/DumbUserManager.example.tsx",
      },
      {
        id: "props-table",
        label: "DumbPropsTable",
        pkg: "props-table",
        hint: "что пришло в пропсах",
        file: "examples/data/DumbPropsTable.example.tsx",
      },
      {
        id: "primitives",
        label: "Примитивы",
        pkg: "shared",
        hint: "отмена, клавиатура, правка",
        file: "examples/data/primitives.example.tsx",
      },
      {
        id: "odata1c",
        label: "Odata1C",
        pkg: "odata-1c",
        hint: "клиент 1С, без Solid",
        file: "examples/data/Odata1C.example.tsx",
      },
      {
        id: "utils",
        label: "utils",
        pkg: "utils",
        hint: "формат, slug, zip",
        file: "examples/data/utils.example.tsx",
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
        file: "playground/src/ThemeShowcase.tsx",
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
        file: "examples/lab/RawDnd.example.tsx",
      },
      {
        id: "cssorder",
        label: "CSS order + FLIP",
        pkg: "shared",
        hint: "сортировка без перестановки DOM",
        file: "examples/lab/CssOrder.example.tsx",
      },
      {
        id: "flipbench",
        label: "Замер vs снимок",
        pkg: "shared",
        hint: "сколько стоит померить",
        file: "examples/lab/FlipBench.example.tsx",
      },
      {
        id: "orderkanban",
        label: "Канбан на order",
        pkg: "shared",
        hint: "колонки и переезды",
        file: "examples/lab/OrderKanban.example.tsx",
      },
      {
        id: "orderboard",
        label: "Доска на order",
        pkg: "shared",
        hint: "вложенные сетки и ресайз",
        file: "examples/lab/OrderBoard.example.tsx",
      },
      {
        id: "ordertable",
        label: "Таблица на order",
        pkg: "shared",
        hint: "subgrid + сортировка",
        file: "examples/lab/OrderTable.example.tsx",
      },
      {
        id: "ordertree",
        label: "Дерево на order",
        pkg: "shared",
        hint: "перенос между уровнями",
        file: "examples/lab/OrderTree.example.tsx",
      },
    ],
  },
];

const TABS = GROUPS.flatMap((g) => g.items);

// Навигация — обычные пути (`/kanban`), `@solidjs/router` поверх history API.
// Раньше был самопис на hash: зеркало стояло на GitHub Pages, где `/kanban`
// отдавал 404. Зеркало выключено, витрина живёт на Vercel, а там прямой заход
// на любой путь заворачивается на `index.html` (см. `rewrites` в `vercel.json`).
//
// База берётся из Vite (`base` в `playground/vite.config.ts`): на Vercel это
// корень домена, локально — подпуть `/solid-dumb-kit/`. Роутеру нужен путь без
// завершающего слэша.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Путь примера. Слэш обязателен: без него `A` считает ссылку относительной. */
const hrefOf = (id: string) => `/${id}`;

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

/**
 * Подпись в меню. Префикс `Dumb` у половины пунктов одинаковый, глаз цепляется
 * за него вместо имени компонента — режем при отрисовке. В `matches` остаётся
 * полное имя, поэтому поиск по «dumbtable» продолжает находить.
 */
const short = (label: string) => label.replace(/^Dumb/, "");

/**
 * Меню: те же группы, но пункты внутри — по алфавиту ОТОБРАЖАЕМОЙ подписи
 * (то есть уже без `Dumb`). Подписи вперемешку латиница и кириллица, поэтому
 * `localeCompare`, а не сравнение строк.
 *
 * Отдельный список, а не сортировка `GROUPS` на месте: по исходному порядку
 * считается `TABS[0]` — вкладка по умолчанию, и менять её сортировкой меню
 * незачем.
 */
const MENU: Group[] = GROUPS.map((g) => ({
  ...g,
  items: [...g.items].sort((a, b) => short(a.label).localeCompare(short(b.label), "ru")),
}));

/**
 * Дата правки пакета — коротко: «7 авг 2026». Хвосты русской локали («г.» и
 * точку после месяца) срезаем: в строке шапки они только шумят.
 */
const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(iso))
    .replace(/\s*г\.$/, "")
    .replace(".", "");

/** В какой группе лежит пример — для крошек в навбаре. */
const groupOf = (id: string) => GROUPS.find((g) => g.items.some((t) => t.id === id))?.title ?? "";

/** Совпадение по названию, подсказке и имени пакета — регистр не важен. */
const matches = (t: Tab, q: string): boolean => {
  const hay = `${t.label} ${t.hint} ${t.pkg ?? ""} ${t.id}`.toLowerCase();
  return q.split(/\s+/).every((w) => hay.includes(w));
};

/**
 * Каркас витрины: сайдбар слева, пример справа. Роутер отдаёт его как layout,
 * поэтому при переходе перерисовывается только `props.children` — меню, поиск
 * и состояние свёрнутых групп переезд между примерами переживают.
 */
function App(props: { children?: JSX.Element }) {
  const location = useLocation();
  const navigate = useNavigate();
  /**
   * Id текущего примера. `location.pathname` приходит ВМЕСТЕ с базой: роутер
   * приклеивает её к паттернам роутов, а не срезает из адреса, — поэтому базу
   * снимаем сами. Локально витрина живёт на `/solid-dumb-kit/`, и без этого
   * текущей вкладкой оказывалась сама база: ни подсветки в меню, ни крошек,
   * ни ссылки на исходник.
   */
  const tab = () => {
    const path = location.pathname;
    const rel = BASE && path.startsWith(BASE) ? path.slice(BASE.length) : path;
    return rel.replace(/^\/+/, "").split("/")[0];
  };
  /** Описание открытой вкладки: крошки и ссылки на гит в навбаре берут его. */
  const current = () => TABS.find((t) => t.id === tab());
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
    if (!q) return MENU;
    return MENU.map((g) => ({
      ...g,
      items: g.items.filter((t) => matches(t, q)),
    })).filter((g) => g.items.length > 0);
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

  // Заголовок вкладки браузера — по текущему примеру: с настоящими путями
  // страницу кладут в закладки и ищут в истории, а «solid-dumb-kit» на всех
  // тридцати пунктах там неразличим.
  createEffect(() => {
    const t = TABS.find((x) => x.id === tab());
    document.title = t ? `${t.label} · solid-dumb-kit` : "solid-dumb-kit";
  });

  let searchEl: HTMLInputElement | undefined;

  // Глобальные хоткеи: `/` и ⌘K/Ctrl+K — в поиск. Проверка на поле ввода
  // обязательна, иначе слэш перестанет печататься в примерах с инпутами.
  const onKey = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    const typing = !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
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
        navigate(hrefOf(id));
        searchEl?.blur();
      }
    }
  };

  return (
    <div class="flex min-h-screen flex-col">
      {/* Навбар daisyUI — общая шапка витрины: где мы сейчас, выбор темы и
          ссылки в репозиторий. Высота 3.5rem зашита и здесь, и в `top`/`height`
          сайдбара ниже: он липнет ПОД навбаром, а не под ним. */}
      {/* Ширины блоков — `flex-1`/`w-auto`, а не дефолтные 50/50 от daisyUI:
          с ними сумма половин плюс отступы превышала строку, и навбар
          переносился в две. */}
      <header class="navbar sticky top-0 z-30 min-h-14 flex-nowrap gap-3 border-b border-base-300 bg-base-100 px-3">
        <div class="navbar-start w-auto min-w-0 flex-1 gap-2">
          <A class="text-base font-semibold no-underline" href={hrefOf(TABS[0].id)}>
            solid-dumb-kit
          </A>

          {/* Где мы сейчас. Хлебные крошки daisyUI: группа → пример, и в них же
              видно, что подпись в меню урезана (там без `Dumb`), а тут полная. */}
          <Show when={current()}>
            {(t) => (
              <div class="hidden min-w-0 sm:block">
                <div class="breadcrumbs min-w-0 py-0 text-sm">
                  <ul>
                    <li>{groupOf(t().id)}</li>
                    <li class="font-medium">{t().label}</li>
                  </ul>
                </div>
                {/* когда пакет правился в последний раз. Дата берётся из git по
                    КАТАЛОГУ пакета: правка витрины не должна выглядеть как
                    обновление всего кита. */}
                <Show when={t().pkg && KIT_META[t().pkg!]?.updated}>
                  {(iso) => (
                    <div class="text-xs leading-none">обновлён {fmtDate(iso())}</div>
                  )}
                </Show>
              </div>
            )}
          </Show>
        </div>

        <div class="navbar-end w-auto shrink-0 gap-2">
          {/* Тема — `join` из всех вариантов, а не кнопка «следующая по кругу»:
              видно и текущую, и куда можно переключиться, одним взглядом. */}
          <div class="join" role="group" aria-label="Тема витрины">
            <For each={THEMES}>
              {(th) => (
                <button
                  type="button"
                  class="btn join-item btn-sm"
                  classList={{ "btn-primary": theme() === th }}
                  aria-pressed={theme() === th}
                  title={`Тема ${th}`}
                  onClick={() => setTheme(th)}
                >
                  {THEME_LABEL[th]}
                </button>
              )}
            </For>
          </div>

          {/* Ссылки на гит: исходник открытого примера, пакет, из которого он
              собран, и репозиторий целиком. Пути к исходникам приходят из того
              же поля `file`, по которому грузится чанк. */}
          <div class="join" role="group" aria-label="Исходники на GitHub">
            <Show when={current()}>
              {(t) => (
                <a
                  class="btn join-item btn-sm"
                  href={`${REPO}/blob/main/${t().file}`}
                  target="_blank"
                  rel="noreferrer"
                  title={`Исходник примера: ${t().file}`}
                >
                  <span class="icon-[ph--file-code-bold] size-4" aria-hidden="true" />
                  исходник
                </a>
              )}
            </Show>
            <Show when={current()?.pkg}>
              {(pkg) => (
                <a
                  class="btn join-item btn-sm"
                  href={`${REPO}/tree/main/packages/${pkg()}`}
                  target="_blank"
                  rel="noreferrer"
                  title={
                    KIT_META[pkg()]?.updated
                      ? `Пакет @solid-dumb-kit/${pkg()} — правился ${fmtDate(KIT_META[pkg()]!.updated!)}`
                      : `Пакет @solid-dumb-kit/${pkg()}`
                  }
                >
                  <span class="icon-[ph--package-bold] size-4" aria-hidden="true" />
                  {pkg()}
                  {/* версия пакета рядом с именем: по ней сразу видно, что
                      именно ставить, а дата ниже говорит, насколько свежее */}
                  <Show when={KIT_META[pkg()]?.version}>
                    {(v) => <span class="badge badge-sm badge-ghost">{v()}</span>}
                  </Show>
                </a>
              )}
            </Show>
            <a
              class="btn join-item btn-sm"
              href={REPO}
              target="_blank"
              rel="noreferrer"
              title="Репозиторий кита"
            >
              <span class="icon-[ph--github-logo-bold] size-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </header>

      <div class="flex min-h-0 flex-1 items-start">
        {/* Сайдбар скрыт — остаётся узкая полоса с одной кнопкой: навигация
            никогда не пропадает совсем, иначе из примера некуда вернуться. */}
        <Show when={hidden()}>
          <div class="sticky top-14 flex h-[calc(100vh-3.5rem)] w-10 shrink-0 flex-col items-center border-r border-base-300 bg-base-200 py-3">
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              title="Показать навигацию (⌘K)"
              aria-label="Показать навигацию"
              onClick={toggleNav}
            >
              ☰
            </button>
          </div>
        </Show>

        <Show when={!hidden()}>
          <aside class="sticky top-14 flex h-[calc(100vh-3.5rem)] w-68 shrink-0 flex-col border-r border-base-300 bg-base-200">
            <div class="px-3 pt-3 pb-1">
              <div class="flex items-center gap-1">
                <label class="input input-sm min-w-0 flex-1">
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
                {/* Кнопка сворачивания живёт при самом меню, а не в общей шапке:
                    она управляет сайдбаром, и рядом с ним ей и место. */}
                <button
                  type="button"
                  class="btn btn-ghost btn-sm px-2"
                  title="Скрыть навигацию"
                  aria-label="Скрыть навигацию"
                  onClick={toggleNav}
                >
                  ⇤
                </button>
              </div>
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
                              {/* `A`, а не голый `<a>`: обычная ссылка перезагрузила
                                бы страницу целиком вместо перехода по роутеру. */}
                              <A
                                class="py-1.5"
                                classList={{
                                  "menu-active": tab() === t.id,
                                  // курсор поиска: рамкой, а не фоном — фон уже
                                  // занят активной вкладкой, и они бы спорили
                                  "outline outline-primary": searching() && cursorId() === t.id,
                                }}
                                href={hrefOf(t.id)}
                                aria-current={tab() === t.id ? "page" : undefined}
                                title={t.pkg ? `${t.hint} · @solid-dumb-kit/${t.pkg}` : t.hint}
                                // Чанк примера — уже на наведении и на фокусе с
                                // клавиатуры: между hover и кликом обычно хватает
                                // времени скачать его целиком.
                                onMouseEnter={() => compOf(t.file).preload?.()}
                                onFocus={() => compOf(t.file).preload?.()}
                              >
                                {/* Пункт меню у daisyUI — grid в СТРОКУ: без обёртки
                                  подпись, описание и имя пакета встали бы рядом и
                                  налезли друг на друга. Оборачиваем в один блок. */}
                                <span class="flex min-w-0 flex-col leading-snug">
                                  <span class="truncate font-medium">{short(t.label)}</span>
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
                              </A>
                            </li>
                          )}
                        </For>
                      </ul>
                    </details>
                  </li>
                )}
              </For>
            </ul>
          </aside>
        </Show>

        {/* Заглушка на время загрузки чанка. Видна редко: при переходе роутер
            держит навигацию в `startTransition`, поэтому предыдущий пример
            остаётся на экране, — реально она показывается на первом заходе. */}
        <main class="min-w-0 flex-1">
          <Suspense
            fallback={
              <div class="flex min-h-[60vh] items-center justify-center gap-3 text-base">
                <span class="loading loading-spinner loading-md" />
                загружаем пример…
              </div>
            }
          >
            {props.children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}

// Старые ссылки жили на hash (`#kanban`) — переводим их на путь ДО старта
// роутера, иначе закладка откроет корень и молча потеряет пример.
const legacy = location.hash.replace(/^#\/?/, "");
if (legacy && TABS.some((t) => t.id === legacy)) {
  history.replaceState(null, "", `${BASE}${hrefOf(legacy)}`);
}

render(
  () => (
    <Router base={BASE} root={App}>
      {/* Корень и любой мусорный путь — на первый пример. `Navigate`, а не
          рендер компонента: адрес в строке должен совпадать с тем, что показано,
          иначе кнопка «назад» ведёт себя непредсказуемо. */}
      <Route path="/" component={() => <Navigate href={hrefOf(TABS[0].id)} />} />
      {/* Обычный `map`, а не `For`: роутер читает описание роутов один раз при
          старте, реактивный список ему тут не нужен и только мешает. */}
      {TABS.map((t) => (
        <Route path={hrefOf(t.id)} component={compOf(t.file)} />
      ))}
      <Route path="*" component={() => <Navigate href={hrefOf(TABS[0].id)} />} />
    </Router>
  ),
  document.getElementById("root")!,
);
