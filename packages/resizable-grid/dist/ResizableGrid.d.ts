import { type JSX } from 'solid-js';
export type GridPanel = {
    /** Уникальный id панели */
    id: string;
    /** Содержимое — render prop */
    content: () => JSX.Element;
    /** Минимальный размер в px */
    min?: number;
    /** Начальный размер в fr (по умолчанию 1) */
    initial?: number;
};
export type ResizableGridProps = {
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
export declare function ResizableGrid(props: ResizableGridProps): JSX.Element;
