import { type JSX } from 'solid-js';
import { type SpanValue } from '@solid-dumb-kit/grid';
/**
 * Пределы размера блока в ячейках. Ширины принимают долю (`'half'`, `'2/5'`) —
 * она разрешается по числу колонок ЗОНЫ, высоты только числами: строк у зоны
 * столько, сколько потребуется.
 */
export type BlockLimits = {
    minW?: SpanValue;
    maxW?: SpanValue;
    minH?: number;
    maxH?: number;
};
export type BoardSection<T = unknown> = {
    id: string;
    /** блоки этой секции; порядок в массиве = порядок на экране */
    items: Array<T>;
    /** заголовок; он же ручка переноса секции. Не задан — шапки нет вовсе */
    title?: JSX.Element;
    /** приписка мельче под заголовком */
    subtitle?: JSX.Element;
    /** колонок ВНУТРИ секции (сетка блоков); по умолчанию 3 */
    cols?: number;
    /** ширина секции в колонках доски; по умолчанию половина */
    span?: number;
    /** высота в строках сетки блоков; не задана — по содержимому */
    rows?: number;
    /** пускать ли сюда блоки из секции `from`; по умолчанию пускать всех */
    accepts?: (from: string) => boolean;
};
export type DumbBoardProps<T> = {
    /** секции вместе с их блоками — ОДИН массив, он же всё состояние доски */
    sections: Array<BoardSection<T>>;
    /**
     * Позвать с новой раскладкой. Зовётся ПО ХОДУ жеста, на каждом шаге: данные
     * всё время совпадают с тем, что на экране, и ничего не теряется, если
     * браузер не доставит `drop`. Секции доска не мутирует — отдаёт новый массив.
     */
    setSections: (next: Array<BoardSection<T>>) => void;
    /** стабильный id блока */
    id: (item: T) => string;
    /** блок переехал: в секцию `toSection`, на место `toIndex` среди её блоков */
    onMove?: (item: T, toSection: string, toIndex: number) => void;
    /** секцию перетащили за заголовок */
    onSectionMove?: (fromIndex: number, toIndex: number) => void;
    /** секции сменили размер: колонок доски и строк сетки блоков */
    onSectionResize?: (id: string, size: {
        span: number;
        rows: number;
    }) => void;
    /**
     * Сколько колонок зоны занимает блок; по умолчанию одну. Кроме числа
     * принимается доля (`'half'`, `'1/3'`) — она разрешается по числу колонок зоны.
     */
    blockSpan?: (item: T) => SpanValue;
    /**
     * Пределы размера блока в ячейках. `minW` работает дважды: до неё блок
     * согласен ужаться, чтобы влезть в остаток строки вместо переезда вниз, и
     * ниже неё его не пустит ресайз. Ужатая ширина не хранится нигде — на
     * свободном месте блок сам вернётся к `blockSpan`.
     */
    blockLimits?: (item: T) => BlockLimits;
    /** высота блока в строках сетки зоны; по умолчанию одна */
    blockRows?: (item: T) => number;
    /**
     * Блок сменил размер — сохрани его у себя. Пока проп не задан, у блоков нет
     * ни ручки, ни жеста: размер живёт в твоих данных, и менять его без спроса
     * доска не станет.
     */
    onBlockResize?: (item: T, size: {
        w: number;
        h: number;
    }) => void;
    /** колонок у самой доски; по умолчанию 12 */
    cols?: number;
    /** зазор сетки доски, px; по умолчанию 14 */
    gap?: number;
    /** шаг строки внутри секции, px — он же высота ячейки зоны; по умолчанию 76 */
    rowHeight?: number;
    /** зазор сетки ВНУТРИ секции, px; по умолчанию 8 */
    zoneGap?: number;
    /** минимальная ширина секции в колонках; по умолчанию 3 */
    minSpan?: number;
    /**
     * Показывать разметку сетки внутри секций: `true` — всегда, `'drag'` — только
     * пока тащат блок (по умолчанию), `false` — никогда.
     */
    showGrid?: boolean | 'drag';
    /** правка: без неё нет ни жестов, ни ручек, ни единого слушателя на блоках */
    editable?: boolean;
    /** анимировать; по умолчанию да, но не при prefers-reduced-motion */
    animate?: boolean;
    /** разрешить ресайз секций; по умолчанию да */
    resizable?: boolean;
    /** подписи для доступности — заголовки ручек */
    labels?: {
        resizeBlock?: string;
    };
    /** свои кнопки в правой части шапки секции */
    sectionActions?: (section: BoardSection<T>) => JSX.Element;
    class?: string;
    style?: JSX.CSSProperties;
    /** ВЕРНИ один корневой элемент — компонент привяжется прямо к нему */
    children: (item: T, section: BoardSection<T>) => JSX.Element;
};
export declare function DumbBoard<T>(props: DumbBoardProps<T>): JSX.Element;
