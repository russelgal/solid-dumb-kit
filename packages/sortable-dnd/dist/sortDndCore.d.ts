export type SortDndOptions = {
    /** текущий порядок id — совпадает с порядком данных */
    order: () => Array<string>;
    /** `y` — вертикальный список (по умолчанию), `grid` — двумерная сетка плиток */
    axis?: () => 'y' | 'grid';
    /** перетаскивание запрещено */
    disabled?: () => boolean;
    /** анимировать расступание; по умолчанию да, но не при prefers-reduced-motion */
    animate?: boolean;
    /**
     * Переставить ПРЯМО СЕЙЧАС, посреди жеста. Источник истины — данные
     * потребителя, поэтому движок ничего не переставляет сам.
     */
    onMove?: (fromIndex: number, toIndex: number) => void;
    /** жест закончен: откуда и куда переехал элемент — для персиста */
    onEnd?: (fromIndex: number, toIndex: number) => void;
    /** id элемента, который тащат (null — жеста нет) */
    onActive?: (id: string | null) => void;
};
export type SortDndEngine = {
    /** ref на контейнер */
    attachContainer: (el: HTMLElement) => () => void;
    /** ref на элемент; ручка — дочка с [data-drag-handle] */
    attach: (el: HTMLElement, id: string) => () => void;
    active: () => string | null;
    destroy: () => void;
};
export declare function createSortDndEngine(opts: SortDndOptions): SortDndEngine;
