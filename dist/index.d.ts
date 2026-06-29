import { JSX } from 'solid-js';
import { SelectionEvent, SelectionOptions } from '@viselect/vanilla';
export { SelectionEvent } from '@viselect/vanilla';

type SelectionAreaProps = {
    /** CSS-селектор выбираемых элементов */
    selectables: string;
    /** Вызывается при изменении выделения */
    onSelect?: (e: SelectionEvent) => void;
    /** Вызывается при завершении выделения */
    onStop?: (e: SelectionEvent) => void;
    /** Вызывается перед началом — return false чтобы отменить */
    onBeforeStart?: (e: SelectionEvent) => boolean | void;
    /** Доп. класс контейнера */
    class?: string;
    /** Класс для прямоугольника выделения */
    selectionAreaClass?: string;
    /** Режим пересечения: touch (касание), cover (полное покрытие), center */
    intersect?: 'touch' | 'cover' | 'center';
    /** Доп. настройки поведения */
    behaviour?: Partial<SelectionOptions['behaviour']>;
    /** Доп. настройки фич */
    features?: Partial<SelectionOptions['features']>;
    /** Boundaries — элементы-границы выделения (по умолчанию container) */
    boundaries?: (string | HTMLElement)[];
    /**
     * Автоскролл window при drag за край viewport.
     * Использует невидимый text selection для нативного скролла браузера.
     * Полезно когда контейнер не имеет overflow (скроллится страница).
     * Требует CSS: .viselect-window-scroll *::selection { background: inherit; color: inherit; }
     */
    windowScroll?: boolean;
    children: JSX.Element;
};
/**
 * Обёртка над @viselect/vanilla для SolidJS.
 * Рисует прямоугольник выделения при перетаскивании мыши (как в Finder).
 * Shift/Cmd — добавление к выделению.
 *
 * @example
 * ```tsx
 * <SelectionArea
 *   selectables=".file-card"
 *   onSelect={({ store }) => setSelected(new Set(
 *     [...store.stored, ...store.selected].map(el => el.dataset.key!)
 *   ))}
 * >
 *   <div class="grid">
 *     <For each={files()}>
 *       {(f) => <div class="file-card" data-key={f.id}>{f.name}</div>}
 *     </For>
 *   </div>
 * </SelectionArea>
 * ```
 */
declare function SelectionArea(props: SelectionAreaProps): JSX.Element;

type GridPanel = {
    /** Уникальный id панели */
    id: string;
    /** Содержимое — render prop */
    content: () => JSX.Element;
    /** Минимальный размер в px */
    min?: number;
    /** Начальный размер в fr (по умолчанию 1) */
    initial?: number;
};
type ResizableGridProps = {
    /** Колонки (2-3) */
    cols: GridPanel[];
    /** Второй ряд (опционально, 1-3 панелей) */
    rows?: GridPanel[];
    /** Высота первого ряда в fr (по умолчанию 1) */
    rowInitial?: number;
    /** Высота второго ряда в fr (по умолчанию 1) */
    row2Initial?: number;
    /** Мин. высота ряда в px */
    rowMin?: number;
    /** Ключ localStorage для сохранения размеров */
    storageKey: string;
    /** Доп. класс */
    class?: string;
};
declare function ResizableGrid(props: ResizableGridProps): JSX.Element;

type DumbSortableProps<T> = {
    items: Array<T>;
    /** позвать с новым порядком (на дропе) */
    setItems: (next: Array<T>) => void;
    /** стабильный id элемента */
    id: (item: T) => string;
    axis?: 'y' | 'grid';
    disabled?: () => boolean;
    pressDelay?: number;
    mousePressDelay?: number;
    mouseThreshold?: number;
    /** ВЕРНИ один корневой элемент — компонент привяжется прямо к нему */
    children: (item: T, index: () => number) => JSX.Element;
};
declare function DumbSortable<T>(props: DumbSortableProps<T>): JSX.Element;

type DumbSortableHandle = {
    /** самодостаточный ref на элемент (ручка = дочка с [data-drag-handle]) */
    bind: (id: string) => (el: HTMLElement) => void;
    /** низкоуровневый ref на элемент-ячейку */
    row: (id: string) => (el: HTMLElement) => void;
    /** низкоуровневый ref на ручку-хендл */
    handle: (id: string) => (el: HTMLElement) => void;
};
type DumbSortableOptions = {
    /** текущий визуальный порядок id (совпадает с порядком data) */
    order: () => string[];
    /** 'y' — вертикальный список (по умолчанию), 'grid' — двумерная сетка */
    axis?: 'y' | 'grid';
    /** drag запрещён (напр. активна сортировка колонки) */
    disabled?: () => boolean;
    /** тач: удержание до старта драга, мс (0 = сразу). По умолчанию 350 */
    pressDelay?: number;
    /** мышь: long-press до старта, мс (0 = выкл). Имеет приоритет над mouseThreshold */
    mousePressDelay?: number;
    /** мышь: дистанция до старта драга, px (0 = сразу, как было). По умолчанию 0 */
    mouseThreshold?: number;
    /** на дропе: переставить из fromIndex в toIndex (индексы в order()) */
    onEnd: (fromIndex: number, toIndex: number) => void;
};
declare function createDumbSortable(opts: DumbSortableOptions): DumbSortableHandle;

type DumbTreeNode = {
    id: number | string;
    parent: number | string;
    title: string;
    /** порядок среди соседей (для сортировки «по индексу») */
    index?: number;
    /** доп. строка для поиска/тултипа (бренд категории и т.п.) */
    meta?: string | null;
};
type Id = number | string;
type DumbTreeIcons = Partial<{
    /** папка свёрнута */
    folder: string;
    /** папка раскрыта */
    folderOpen: string;
    /** лист (flat-режим / узел без детей) */
    leaf: string;
    /** стрелка раскрытой папки */
    expanded: string;
    /** стрелка свёрнутой папки */
    collapsed: string;
    search: string;
    sortIndex: string;
    sortName: string;
    dragHandle: string;
}>;
type DumbTreeLabels = Partial<{
    search: string;
    sortIndex: string;
    sortName: string;
}>;
type DumbTreeProps<T extends DumbTreeNode> = {
    /** плоский массив узлов (иерархия по parent). undefined → спиннер загрузки */
    nodes?: Array<T>;
    /** заголовок сайдбара */
    title?: string;
    /** активный (выбранный) id — реактивный аксессор */
    activeId?: () => Id | null | undefined;
    /** клик по строке */
    onSelect?: (id: T['id'], node: T) => void;
    /** плоский список без иерархии/сворачивания */
    flat?: boolean;
    /** скрыть поле поиска */
    hideSearch?: boolean;
    placeholder?: string;
    /** свой матчер поиска (по умолчанию fuzzy по title/meta/id) */
    match?: (node: T, query: string) => boolean;
    /** скрыть тоггл сортировки и держать порядок строго по index */
    hideSort?: boolean;
    /** локаль для сравнения названий (по умолчанию — браузерная) */
    locale?: string;
    /** ключ localStorage для раскрытых папок и режима сортировки */
    storageKey?: string;
    /** drag-reorder flat-списка: переставить from→to в порядке отображения */
    sortable?: (from: number, to: number) => void;
    /** доп. контент справа в строке (бейджи/иконки статуса) */
    rowExtra?: (node: T) => JSX.Element;
    /** доп. класс на строку-ссылку (напр. opacity-50 для скрытых) */
    rowClass?: (node: T) => string | undefined;
    /** доп. класс на текст строки (напр. line-through) */
    titleClass?: (node: T) => string | undefined;
    /** свой tooltip строки (по умолчанию «title · meta · id N») */
    rowTitle?: (node: T) => string;
    /** доп. класс на корневой <aside> */
    class?: string;
    icons?: DumbTreeIcons;
    labels?: DumbTreeLabels;
};
declare function DumbTree<T extends DumbTreeNode>(props: DumbTreeProps<T>): JSX.Element;

export { DumbSortable, type DumbSortableHandle, type DumbSortableOptions, type DumbSortableProps, DumbTree, type DumbTreeIcons, type DumbTreeLabels, type DumbTreeNode, type DumbTreeProps, type GridPanel, ResizableGrid, type ResizableGridProps, SelectionArea, type SelectionAreaProps, createDumbSortable };
