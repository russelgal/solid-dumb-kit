import { JSX } from 'solid-js';

type BoardSection<T = unknown> = {
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
type DumbBoardProps<T> = {
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
     * Сколько колонок зоны занимает блок; по умолчанию одну. Высоту не
     * спрашиваем — её задаёт содержимое, доска её замеряет (тем же снимком через
     * `IntersectionObserver`, что и список в `sortable-dnd`).
     */
    blockSpan?: (item: T) => number;
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
    sectionActions?: (section: BoardSection<T>) => JSX.Element;
    class?: string;
    style?: JSX.CSSProperties;
    /** ВЕРНИ один корневой элемент — компонент привяжется прямо к нему */
    children: (item: T, section: BoardSection<T>) => JSX.Element;
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
 * Геометрия зоны с РАЗНЫМИ блоками: шага по вертикали тут нет вовсе — высота
 * строки это максимум высот тех, кто в ней стоит, а значит зависит от порядка.
 * Позиции считает `panelFlow` по снятым размерам, ровно как список в
 * `sortable-dnd` считает свои места по снятым высотам строк.
 */
type ZoneFlow = {
    left: number;
    top: number;
    colW: number;
    gap: number;
    cols: number;
};
/**
 * Где лежит k-е место в секции с ОДИНАКОВЫМИ блоками. Шаг известен — значит
 * позиция это арифметика, а не замер, и состав секции на неё не влияет.
 *
 * Для блоков разного размера не годится: там строка тем выше, чем выше самый
 * высокий в ней, то есть место зависит от того, кто перед ним стоит. Считай
 * такие зоны через `panelFlow`, как считаются секции.
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
 * Куда лягут коробки при заданном порядке — поток, как `grid-auto-flow: row`.
 * Коробка занимает `span` колонок; не влезла в остаток строки — переносится на
 * следующую, а высота строки это максимум высот тех, кто в ней стоит.
 *
 * Этим считаются И секции доски, И блоки внутри секции: задача одна и та же.
 * Позиции НЕ снимаются заранее, а считаются вот этим, потому что коробки разной
 * ширины: обмен местами «половина» ↔ «во всю ширину» перекладывает всю сетку.
 * Снятые заранее места после первой же перестановки врут, а FLIP по ним дёргается.
 *
 * Требование к разметке: элементы не должны растягиваться на высоту строки
 * (`align-self: start`), иначе замеренная высота у всех в строке одинаковая, и
 * переехавший в другую строку блок посчитается не по своей.
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

export { type BoardSection, DumbBoard, type DumbBoardProps, type PanelBox, type Slot, type ZoneFlow, type ZoneGeom, moveAt, panelFlow, rowsFor, slotAt };
