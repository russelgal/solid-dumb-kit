import { JSX } from 'solid-js';

type BoardSection = {
    id: string;
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
type DumbBoardProps<T> = {
    sections: Array<BoardSection>;
    /** порядок в массиве = порядок на экране */
    items: Array<T>;
    /** стабильный id блока */
    id: (item: T) => string;
    /** в какой секции блок */
    section: (item: T) => string;
    /** блок переехал: в секцию `toSection`, на место `toIndex` среди её блоков */
    onMove?: (item: T, toSection: string, toIndex: number) => void;
    /** секцию перетащили за заголовок */
    onSectionMove?: (fromIndex: number, toIndex: number) => void;
    /** секции сменили размер: колонок доски и строк сетки блоков */
    onSectionResize?: (id: string, size: {
        span: number;
        rows: number;
    }) => void;
    /** колонок у самой доски; по умолчанию 12 */
    cols?: number;
    /** зазор сетки, px; по умолчанию 14 */
    gap?: number;
    /** шаг строки внутри секции, px — им меряется высота при ресайзе; по умолчанию 76 */
    rowHeight?: number;
    /** минимальная ширина секции в колонках; по умолчанию 3 */
    minSpan?: number;
    /** правка: без неё нет ни жестов, ни ручек, ни единого слушателя на блоках */
    editable?: boolean;
    /** анимировать; по умолчанию да, но не при prefers-reduced-motion */
    animate?: boolean;
    /** разрешить ресайз секций; по умолчанию да */
    resizable?: boolean;
    /** свои кнопки в правой части шапки секции */
    sectionActions?: (section: BoardSection) => JSX.Element;
    class?: string;
    style?: JSX.CSSProperties;
    /** ВЕРНИ один корневой элемент — компонент привяжется прямо к нему */
    children: (item: T, section: BoardSection) => JSX.Element;
};
declare function DumbBoard<T>(props: DumbBoardProps<T>): JSX.Element;

/** место в сетке секции: колонка и строка выводятся из одного числа */
type Slot = {
    left: number;
    top: number;
};
/** три числа на секцию плюс число колонок — больше о её геометрии знать нечего */
type ZoneGeom = {
    left: number;
    top: number;
    stepX: number;
    stepY: number;
    cols: number;
};
/**
 * Где лежит k-е место в секции. Блоки одинаковые, шаг известен — значит позиция
 * это арифметика, а не замер. Состав секции на неё не влияет: блоки уезжают,
 * места остаются.
 */
declare function slotAt(g: ZoneGeom | undefined, k: number): Slot | null;
/** сколько строк занимает секция с `count` блоками при `cols` колонках */
declare const rowsFor: (count: number, cols: number) => number;
type PanelBox = {
    id: string;
    span: number;
    height: number;
};
/**
 * Куда лягут секции при заданном порядке — поток, как `grid-auto-flow: row`.
 * Секция занимает `span` колонок; не влезла в остаток строки — переносится на
 * следующую, а высота строки это максимум высот тех, кто в ней стоит.
 *
 * Позиции секций НЕ снимаются заранее, а считаются вот этим: секции разной
 * ширины, и обмен местами «половина» ↔ «во всю ширину» перекладывает всю сетку.
 * Снятые заранее места после первой же перестановки врут, а FLIP по ним дёргается.
 */
declare function panelFlow(order: Array<PanelBox>, opts: {
    cols: number;
    colW: number;
    gap: number;
    origin: Slot;
}): Record<string, Slot>;
/**
 * Переставить элемент массива на место `to`. Возвращает НОВЫЙ массив — источник
 * истины у потребителя, мы его массивы не трогаем.
 */
declare function moveAt<T>(list: Array<T>, from: number, to: number): Array<T>;

export { type BoardSection, DumbBoard, type DumbBoardProps, type PanelBox, type Slot, type ZoneGeom, moveAt, panelFlow, rowsFor, slotAt };
