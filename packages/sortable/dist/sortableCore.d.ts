/**
 * Движок сортировки. Ничего не знает про фреймворк: принимает элементы и
 * возвращает функции отписки — привязку к жизненному циклу делает обёртка
 * (для Solid — ./solid.ts, там onCleanup).
 */
export type SortableEngine = {
    /** зарегистрировать элемент И повесить старт драга (ручка = дочка с [data-drag-handle]) */
    attach: (el: HTMLElement, id: string) => () => void;
    /** только зарегистрировать элемент-ячейку */
    attachRow: (el: HTMLElement, id: string) => () => void;
    /** только повесить старт драга на отдельную ручку */
    attachHandle: (el: HTMLElement, id: string) => () => void;
    /** снять слушатели и прибрать стили */
    destroy: () => void;
};
export type DumbSortableOptions = {
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
export declare function createSortableEngine(opts: DumbSortableOptions): SortableEngine;
