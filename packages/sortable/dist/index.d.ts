import { JSX } from 'solid-js';

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
    /** анимировать перестановку; по умолчанию да, но не при prefers-reduced-motion */
    animate?: boolean;
    /** ВЕРНИ один корневой элемент — компонент привяжется прямо к нему */
    children: (item: T, index: () => number) => JSX.Element;
};
declare function DumbSortable<T>(props: DumbSortableProps<T>): JSX.Element;

/**
 * Движок сортировки. Ничего не знает про фреймворк: принимает элементы и
 * возвращает функции отписки — привязку к жизненному циклу делает обёртка
 * (для Solid — ./solid.ts, там onCleanup).
 */
type SortableEngine = {
    /** зарегистрировать элемент И повесить старт драга (ручка = дочка с [data-drag-handle]) */
    attach: (el: HTMLElement, id: string) => () => void;
    /** только зарегистрировать элемент-ячейку */
    attachRow: (el: HTMLElement, id: string) => () => void;
    /** только повесить старт драга на отдельную ручку */
    attachHandle: (el: HTMLElement, id: string) => () => void;
    /** снять слушатели и прибрать стили */
    destroy: () => void;
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
    /**
     * Анимировать расступание соседей и приземление на дропе.
     * По умолчанию да, но при системном `prefers-reduced-motion: reduce` —
     * нет. Явное `true` перебивает и системную настройку.
     */
    animate?: boolean;
    /** на дропе: переставить из fromIndex в toIndex (индексы в order()) */
    onEnd: (fromIndex: number, toIndex: number) => void;
};
declare function createSortableEngine(opts: DumbSortableOptions): SortableEngine;

type SortableGroupOptions = {
    /** перенос завершён: откуда (зона+индекс) и куда */
    onEnd: (from: {
        list: string;
        index: number;
    }, to: {
        list: string;
        index: number;
    }) => void;
    /** запретить драг целиком */
    disabled?: () => boolean;
    /** тач: удержание до старта драга, мс. По умолчанию 350 */
    pressDelay?: number;
    /** мышь: long-press до старта, мс (0 = выкл) */
    mousePressDelay?: number;
    /** мышь: дистанция до старта драга, px (0 = сразу) */
    mouseThreshold?: number;
    /**
     * Анимировать расступание карточек и приземление клона.
     * По умолчанию да, но при системном `prefers-reduced-motion: reduce` — нет.
     */
    animate?: boolean;
};
type SortableListOptions = {
    /** визуальный порядок id внутри этой зоны */
    order: () => string[];
    /** принимать ли элемент из зоны `from` (по умолчанию принимает всех) */
    accepts?: (from: string) => boolean;
};
/** зона в движке: элементы принимаются напрямую, обратно идут функции отписки */
type SortableListEngine = {
    attachContainer: (el: HTMLElement) => () => void;
    attach: (el: HTMLElement, id: string) => () => void;
};
/**
 * Движок кросс-контейнерного драга. Без привязки к фреймворку —
 * Solid-обёртка (createSortableGroup) живёт в ./solid.ts.
 */
type SortableGroupEngine = {
    list: (name: string, opts: SortableListOptions) => SortableListEngine;
    /** имя зоны под указателем во время драга (для подсветки), иначе null */
    activeList: () => string | null;
    /** id перетаскиваемого элемента, иначе null */
    draggingId: () => string | null;
    destroy: () => void;
};
declare function createSortableGroupEngine(opts: SortableGroupOptions): SortableGroupEngine;

type DumbSortableHandle = {
    /** самодостаточный ref на элемент (ручка = дочка с [data-drag-handle]) */
    bind: (id: string) => (el: HTMLElement) => void;
    /** низкоуровневый ref на элемент-ячейку */
    row: (id: string) => (el: HTMLElement) => void;
    /** низкоуровневый ref на ручку-хендл */
    handle: (id: string) => (el: HTMLElement) => void;
};
declare function createDumbSortable(opts: DumbSortableOptions): DumbSortableHandle;
type SortableListHandle = {
    /** ref на контейнер зоны */
    container: (el: HTMLElement) => void;
    /** ref на элемент зоны (ручка = дочка с [data-drag-handle]) */
    bind: (id: string) => (el: HTMLElement) => void;
};
type SortableGroupHandle = {
    /** зарегистрировать зону */
    list: (name: string, opts: SortableListOptions) => SortableListHandle;
    /** имя зоны под указателем во время драга (для подсветки), иначе null */
    activeList: () => string | null;
    /** id перетаскиваемого элемента, иначе null */
    draggingId: () => string | null;
};
declare function createSortableGroup(opts: SortableGroupOptions): SortableGroupHandle;

export { DumbSortable, type DumbSortableHandle, type DumbSortableOptions, type DumbSortableProps, type SortableEngine, type SortableGroupEngine, type SortableGroupHandle, type SortableGroupOptions, type SortableListEngine, type SortableListHandle, type SortableListOptions, createDumbSortable, createSortableEngine, createSortableGroup, createSortableGroupEngine };
