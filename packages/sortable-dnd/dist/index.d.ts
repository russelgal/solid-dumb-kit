import { JSX } from 'solid-js';

type DumbSortableDndProps<T> = {
    items: Array<T>;
    /**
     * Позвать с новым порядком. Зовётся ПО ХОДУ жеста, на каждом шаге, — так же,
     * как у `DumbBoard`: данные всё время совпадают с тем, что на экране, и ничего
     * не теряется, если браузер не доставит `drop`.
     */
    setItems: (next: Array<T>) => void;
    /** стабильный id элемента */
    id: (item: T) => string;
    /** `y` — вертикальный список (по умолчанию), `grid` — сетка плиток */
    axis?: 'y' | 'grid';
    disabled?: boolean;
    /** жест закончен: откуда и куда переехал элемент — удобно для сохранения */
    onEnd?: (fromIndex: number, toIndex: number) => void;
    /** анимировать расступание; по умолчанию да, но не при prefers-reduced-motion */
    animate?: boolean;
    class?: string;
    style?: JSX.CSSProperties;
    /** ВЕРНИ один корневой элемент — компонент привяжется прямо к нему */
    children: (item: T, index: () => number) => JSX.Element;
};
declare function DumbSortableDnd<T>(props: DumbSortableDndProps<T>): JSX.Element;

type SortDndOptions = {
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
type SortDndEngine = {
    /** ref на контейнер */
    attachContainer: (el: HTMLElement) => () => void;
    /** ref на элемент; ручка — дочка с [data-drag-handle] */
    attach: (el: HTMLElement, id: string) => () => void;
    active: () => string | null;
    destroy: () => void;
};
declare function createSortDndEngine(opts: SortDndOptions): SortDndEngine;

type DumbSortableDndHandle = {
    /** ref на контейнер списка */
    container: (el: HTMLElement) => void;
    /** ref на строку (ручка — дочка с [data-drag-handle]) */
    bind: (id: string) => (el: HTMLElement) => void;
    /** id строки, которую тащат */
    active: () => string | null;
};
declare function createDumbSortableDnd(opts: SortDndOptions): DumbSortableDndHandle;

export { DumbSortableDnd, type DumbSortableDndHandle, type DumbSortableDndProps, type SortDndEngine, type SortDndOptions, createDumbSortableDnd, createSortDndEngine };
