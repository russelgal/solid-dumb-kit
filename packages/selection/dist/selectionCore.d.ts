import { type IntersectMode } from './selectionMath';
/**
 * Движок выделения рамкой. Без привязки к фреймворку: принимает контейнер и
 * возвращает функцию отписки; Solid-обёртка (createSelectionArea) — в ./solid.ts.
 */
export type SelectionEngine = {
    /** повесить жест на контейнер; вернёт отписку */
    attach: (el: HTMLElement) => () => void;
    /** снять всё */
    destroy: () => void;
};
export type SelectionCoreOptions = {
    /** контейнер: и область жеста, и (обычно) скроллер */
    container: () => HTMLElement | null;
    /** CSS-селектор выбираемых элементов */
    selectables: string;
    /** атрибут-ключ элемента (по умолчанию data-key) */
    keyAttr?: string;
    /** режим попадания в рамку */
    intersect?: () => IntersectMode;
    /** выделение изменилось (в процессе жеста и по его окончании) */
    onChange: (selected: Set<string>, info: {
        added: string[];
        removed: string[];
    }) => void;
    /** жест завершён */
    onStop?: (selected: Set<string>) => void;
    /** старт запрещён (вернуть false) */
    onBeforeStart?: (ev: PointerEvent) => boolean | void;
    /** выделение на момент старта жеста */
    current: () => Set<string>;
    /** сколько px пройти до старта рамки */
    threshold?: number;
    /** класс на прямоугольник рамки */
    areaClass?: string;
};
export declare function createSelectionEngine(opts: SelectionCoreOptions): SelectionEngine;
