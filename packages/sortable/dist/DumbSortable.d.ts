import { JSX } from 'solid-js';
export type DumbSortableProps<T> = {
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
export declare function DumbSortable<T>(props: DumbSortableProps<T>): JSX.Element;
