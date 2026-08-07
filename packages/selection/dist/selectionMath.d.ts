export type Box = {
    left: number;
    top: number;
    width: number;
    height: number;
};
/** Как элемент попадает в выделение */
export type IntersectMode = 
/** рамка коснулась элемента */
'touch'
/** рамка накрыла элемент целиком */
 | 'cover'
/** рамка накрыла центр элемента */
 | 'center';
/** Прямоугольник по двум точкам — в любом порядке (тянуть можно в любую сторону). */
export declare function areaFrom(x1: number, y1: number, x2: number, y2: number): Box;
/** границы, за которые рамка не выезжает (координаты контента) */
export type Bounds = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
};
/**
 * Прижать точку к границам контейнера.
 *
 * Нужно не только ради вида: рамка — absolute внутри контейнера, и уехав за
 * его пределы она растянула бы scrollWidth/scrollHeight, то есть добавила бы
 * полосы прокрутки прямо во время выделения.
 */
export declare function clampPoint(x: number, y: number, b: Bounds): {
    x: number;
    y: number;
};
export declare function hits(area: Box, cell: Box, mode: IntersectMode): boolean;
/** Индексы ячеек, попавших в рамку. */
export declare function pickHits(area: Box, cells: Array<Box>, mode: IntersectMode): Array<number>;
/**
 * Итоговое выделение при протяжке рамкой.
 *
 * `additive` — зажат Shift/Cmd/Ctrl: рамка только ДОБАВЛЯЕТ к тому, что было
 * (ничего не снимает — иначе, ведя рамку по уже выделенному, пользователь
 * случайно бы его гасил). Без модификатора прежнее выделение заменяется.
 */
export declare function resolveSelection<T>(args: {
    /** выделение на момент начала жеста */
    base: Set<T>;
    /** что сейчас под рамкой */
    touched: Array<T>;
    additive: boolean;
}): Set<T>;
/**
 * Одиночный клик (без протяжки).
 *
 * `key === null` — попали в пустое место: без модификатора выделение сбрасывается,
 * с модификатором не трогаем (иначе Cmd+клик мимо стирал бы набранное).
 * С модификатором клик по элементу переключает его, без — выделяет только его.
 */
export declare function tapSelection<T>(args: {
    current: Set<T>;
    key: T | null;
    additive: boolean;
}): Set<T>;
/** Что изменилось между двумя выделениями — чтобы не трогать лишние классы. */
export declare function diffSelection<T>(prev: Set<T>, next: Set<T>): {
    added: T[];
    removed: T[];
};
