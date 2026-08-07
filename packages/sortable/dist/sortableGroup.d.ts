export type SortableGroupOptions = {
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
export type SortableListOptions = {
    /** визуальный порядок id внутри этой зоны */
    order: () => string[];
    /** принимать ли элемент из зоны `from` (по умолчанию принимает всех) */
    accepts?: (from: string) => boolean;
};
/** зона в движке: элементы принимаются напрямую, обратно идут функции отписки */
export type SortableListEngine = {
    attachContainer: (el: HTMLElement) => () => void;
    attach: (el: HTMLElement, id: string) => () => void;
};
/**
 * Движок кросс-контейнерного драга. Без привязки к фреймворку —
 * Solid-обёртка (createSortableGroup) живёт в ./solid.ts.
 */
export type SortableGroupEngine = {
    list: (name: string, opts: SortableListOptions) => SortableListEngine;
    /** имя зоны под указателем во время драга (для подсветки), иначе null */
    activeList: () => string | null;
    /** id перетаскиваемого элемента, иначе null */
    draggingId: () => string | null;
    destroy: () => void;
};
export declare function createSortableGroupEngine(opts: SortableGroupOptions): SortableGroupEngine;
