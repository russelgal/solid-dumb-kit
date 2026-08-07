import { type JSX } from 'solid-js';
export type DumbSortableDndProps<T> = {
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
export declare function DumbSortableDnd<T>(props: DumbSortableDndProps<T>): JSX.Element;
