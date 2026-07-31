import { JSX } from 'solid-js';

type Box = {
    left: number;
    top: number;
    width: number;
    height: number;
};
/** Как элемент попадает в выделение */
type IntersectMode = 
/** рамка коснулась элемента */
'touch'
/** рамка накрыла элемент целиком */
 | 'cover'
/** рамка накрыла центр элемента */
 | 'center';
/** Прямоугольник по двум точкам — в любом порядке (тянуть можно в любую сторону). */
declare function areaFrom(x1: number, y1: number, x2: number, y2: number): Box;
/** границы, за которые рамка не выезжает (координаты контента) */
type Bounds = {
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
declare function clampPoint(x: number, y: number, b: Bounds): {
    x: number;
    y: number;
};
declare function hits(area: Box, cell: Box, mode: IntersectMode): boolean;
/** Индексы ячеек, попавших в рамку. */
declare function pickHits(area: Box, cells: Array<Box>, mode: IntersectMode): Array<number>;
/**
 * Итоговое выделение при протяжке рамкой.
 *
 * `additive` — зажат Shift/Cmd/Ctrl: рамка только ДОБАВЛЯЕТ к тому, что было
 * (ничего не снимает — иначе, ведя рамку по уже выделенному, пользователь
 * случайно бы его гасил). Без модификатора прежнее выделение заменяется.
 */
declare function resolveSelection<T>(args: {
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
declare function tapSelection<T>(args: {
    current: Set<T>;
    key: T | null;
    additive: boolean;
}): Set<T>;
/** Что изменилось между двумя выделениями — чтобы не трогать лишние классы. */
declare function diffSelection<T>(prev: Set<T>, next: Set<T>): {
    added: T[];
    removed: T[];
};

type SelectionAreaProps = {
    /** CSS-селектор выбираемых элементов */
    selectables: string;
    /** текущее выделение (ключи элементов) — состояние держит потребитель */
    selected: () => Set<string>;
    /** выделение изменилось */
    onChange: (selected: Set<string>) => void;
    /** жест завершён */
    onStop?: (selected: Set<string>) => void;
    /** старт запрещён — вернуть false */
    onBeforeStart?: (ev: PointerEvent) => boolean | void;
    /** атрибут-ключ элемента. По умолчанию `data-key` */
    keyAttr?: string;
    /** режим попадания: касание рамкой / полное покрытие / центр */
    intersect?: IntersectMode;
    /** сколько px пройти до появления рамки. По умолчанию 10 */
    threshold?: number;
    /** класс прямоугольника рамки (структурные стили и так инлайном) */
    areaClass?: string;
    /** доп. класс контейнера */
    class?: string;
    /** стили контейнера: если список прокручивается — overflow вешать сюда */
    style?: JSX.CSSProperties;
    children: JSX.Element;
};
/**
 * Выделение рамкой «как в Finder»: тянешь мышью — выделяется всё, чего коснулась
 * рамка. Shift/Cmd/Ctrl — добавить к выделению (повторное касание снимает).
 *
 * Без зависимостей и без reflow: позиции элементов снимаются один раз на старте
 * жеста через IntersectionObserver, дальше в кадре только арифметика.
 *
 * @example
 * ```tsx
 * const [sel, setSel] = createSignal<Set<string>>(new Set())
 *
 * <SelectionArea selectables=".card" selected={sel} onChange={setSel}
 *                style={{ 'max-height': '60vh', 'overflow-y': 'auto' }}>
 *   <For each={files()}>
 *     {(f) => <div class="card" data-key={f.id} classList={{ on: sel().has(f.id) }} />}
 *   </For>
 * </SelectionArea>
 * ```
 */
declare function SelectionArea(props: SelectionAreaProps): JSX.Element;

/**
 * Движок выделения рамкой. Без привязки к фреймворку: принимает контейнер и
 * возвращает функцию отписки; Solid-обёртка (createSelectionArea) — в ./solid.ts.
 */
type SelectionEngine = {
    /** повесить жест на контейнер; вернёт отписку */
    attach: (el: HTMLElement) => () => void;
    /** снять всё */
    destroy: () => void;
};
type SelectionCoreOptions = {
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
declare function createSelectionEngine(opts: SelectionCoreOptions): SelectionEngine;

declare function createSelectionArea(opts: SelectionCoreOptions): {
    /** повесить жест на контейнер */
    attach(el: HTMLElement): void;
};

export { type Bounds, type Box, type IntersectMode, SelectionArea, type SelectionAreaProps, type SelectionCoreOptions, type SelectionEngine, areaFrom, clampPoint, createSelectionArea, createSelectionEngine, diffSelection, hits, pickHits, resolveSelection, tapSelection };
