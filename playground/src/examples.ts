// Реестр примеров витрины: путь к исходнику → ленивый загрузчик.
//
// Отдельный МОДУЛЬ, и обязательно `.ts`, а не `.tsx`: сканер зависимостей
// Vite 8 спотыкается о файл, где динамические импорты соседствуют с JSX, —
// парсит его без JSX и валится с `Unexpected JSX expression` на первом же
// `return <div>`, а дев поднимается без пре-бандлинга. Здесь JSX нет вовсе.
import { lazy, type JSX } from "solid-js";

/** Модуль примера: дефолтный экспорт — компонент без пропсов. */
type ExampleModule = { default: () => JSX.Element };
type Loader = () => Promise<ExampleModule>;

/**
 * Загрузчик на каждый пример: ключ — путь ОТ КОРНЯ РЕПЫ, значение — ленивый
 * импорт того же файла. Ключ ходит по вкладкам (поле `file`) и превращается в
 * ссылку «исходник» в навбаре, так что разъехаться пути негде — они рядом, в
 * одной строке.
 *
 * Тут напрашивался `import.meta.glob`, и он даже работал в дев-сервере, но
 * ронял сканер зависимостей Vite 8: тот разворачивает шаблон и парсит выданные
 * `.tsx` без JSX — `Unexpected JSX expression` на первом же `return <div>`,
 * а следом «Failed to run dependency scan» и дев без пре-бандлинга.
 *
 * Примеры грузятся по требованию: отдельный чанк на каждый, и в стартовый
 * бандл витрины не тащатся все три десятка разом (там и таблица TanStack, и
 * распаковка zip, и клиент хранилища). Чанк подгружается при первом показе, а
 * `preload` дёргается ещё на наведении мыши в меню.
 */
const MODULES: Record<string, Loader> = {
  "examples/pointer/SelectionArea.example.tsx": () =>
    import("../../examples/pointer/SelectionArea.example"),
  "examples/pointer/DumbSortable.example.tsx": () =>
    import("../../examples/pointer/DumbSortable.example"),
  "examples/pointer/Kanban.example.tsx": () => import("../../examples/pointer/Kanban.example"),
  "examples/pointer/DumbGallery.example.tsx": () =>
    import("../../examples/pointer/DumbGallery.example"),
  "examples/pointer/DumbLightbox.example.tsx": () =>
    import("../../examples/pointer/DumbLightbox.example"),
  "examples/pointer/ContextMenu.example.tsx": () =>
    import("../../examples/pointer/ContextMenu.example"),
  "examples/pointer/DumbModal.example.tsx": () =>
    import("../../examples/pointer/DumbModal.example"),
  "examples/pointer/DumbToast.example.tsx": () =>
    import("../../examples/pointer/DumbToast.example"),
  "examples/pointer/DumbDateRange.example.tsx": () =>
    import("../../examples/pointer/DumbDateRange.example"),
  "examples/pointer/DumbDateTimeRange.example.tsx": () =>
    import("../../examples/pointer/DumbDateTimeRange.example"),
  "examples/pointer/DumbTimeline.example.tsx": () =>
    import("../../examples/pointer/DumbTimeline.example"),
  "examples/pointer/ResizableGrid.example.tsx": () =>
    import("../../examples/pointer/ResizableGrid.example"),
  "examples/pointer/DumbGrid.example.tsx": () => import("../../examples/pointer/DumbGrid.example"),
  "examples/pointer/Board.example.tsx": () => import("../../examples/pointer/Board.example"),
  "examples/dnd/DumbGridDnd.example.tsx": () => import("../../examples/dnd/DumbGridDnd.example"),
  "examples/dnd/DumbSortableDnd.example.tsx": () =>
    import("../../examples/dnd/DumbSortableDnd.example"),
  "examples/dnd/DumbBoard.example.tsx": () => import("../../examples/dnd/DumbBoard.example"),
  "examples/dnd/DumbBoardEven.example.tsx": () =>
    import("../../examples/dnd/DumbBoardEven.example"),
  "examples/data/DumbTree.example.tsx": () => import("../../examples/data/DumbTree.example"),
  "examples/data/DumbTable.example.tsx": () => import("../../examples/data/DumbTable.example"),
  "examples/data/DumbFinder.example.tsx": () => import("../../examples/data/DumbFinder.example"),
  "examples/data/virtual.example.tsx": () => import("../../examples/data/virtual.example"),
  "examples/data/DumbUserManager.example.tsx": () =>
    import("../../examples/data/DumbUserManager.example"),
  "examples/data/DumbPropsTable.example.tsx": () =>
    import("../../examples/data/DumbPropsTable.example"),
  "examples/data/primitives.example.tsx": () => import("../../examples/data/primitives.example"),
  "examples/data/Odata1C.example.tsx": () => import("../../examples/data/Odata1C.example"),
  "examples/data/utils.example.tsx": () => import("../../examples/data/utils.example"),
  "examples/lab/RawDnd.example.tsx": () => import("../../examples/lab/RawDnd.example"),
  "examples/lab/CssOrder.example.tsx": () => import("../../examples/lab/CssOrder.example"),
  "examples/lab/FlipBench.example.tsx": () => import("../../examples/lab/FlipBench.example"),
  "examples/lab/OrderKanban.example.tsx": () => import("../../examples/lab/OrderKanban.example"),
  "examples/lab/OrderBoard.example.tsx": () => import("../../examples/lab/OrderBoard.example"),
  "examples/lab/OrderTable.example.tsx": () => import("../../examples/lab/OrderTable.example"),
  "examples/lab/OrderTree.example.tsx": () => import("../../examples/lab/OrderTree.example"),
  // вкладка «Тема» — часть самой витрины, а не пример
  "playground/src/ThemeShowcase.tsx": () => import("./ThemeShowcase"),
};

export type LazyComp = (() => JSX.Element) & { preload?: () => Promise<unknown> };

// Кеш обязателен: `lazy()` на каждый вызов создавал бы НОВЫЙ компонент, и
// `preload` на наведении грел бы чанк не тому, кого потом отрисует роутер.
const COMPS = new Map<string, LazyComp>();

/** Ленивый компонент примера по пути к его исходнику. */
export const compOf = (file: string): LazyComp => {
  let comp = COMPS.get(file);
  if (!comp) {
    const load = MODULES[file];
    if (!load) throw new Error(`Витрина: нет такого исходника — ${file}`);
    comp = lazy(load) as LazyComp;
    COMPS.set(file, comp);
  }
  return comp;
};
