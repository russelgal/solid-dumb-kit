import { JSX } from 'solid-js';
import { PressGateOptions } from '@solid-dumb-kit/shared';

/** блок в единицах сетки */
type GridSpan = {
    id: string;
    /** ширина в колонках */
    w: number;
    /** высота в строках */
    h: number;
};
/** блок, которому нашлось место: колонка и строка — нулевые индексы */
type Placed = GridSpan & {
    col: number;
    row: number;
};
/** блок со своей позицией — для свободного режима */
type FreeSpan = GridSpan & {
    x?: number;
    y?: number;
};
/**
 * Как раскладывать:
 *  • `flow`  — по порядку, курсор назад не возвращается (CSS без `dense`);
 *  • `dense` — по порядку, но дырки затыкаются следующими блоками;
 *  • `free`  — каждый блок стоит по своим `x`/`y`, дырки остаются.
 */
type LayoutMode = 'flow' | 'dense' | 'free';
/** режимы, у которых позиция выводится из порядка массива */
type FlowMode = 'flow' | 'dense';
/** метрики сетки в px (colW приходит из ResizeObserver, остальное — пропы) */
type Metrics = {
    cols: number;
    colW: number;
    rowH: number;
    gapX: number;
    gapY: number;
};
/** прямоугольник блока в координатах контента контейнера */
type Rect = {
    x: number;
    y: number;
    width: number;
    height: number;
};
/**
 * Ширина «по-человечески»: доля сетки вместо счёта колонок.
 * Числа тоже принимаются — пресет это удобство, а не замена.
 */
type SpanPreset = 'full' | 'half' | 'third' | 'quarter' | 'two-thirds' | 'three-quarters' | `${number}/${number}`;
type SpanValue = number | SpanPreset;
/**
 * Пресет → колонки. Доля округляется ВНИЗ: так N блоков ширины `1/N` всегда
 * влезают в строку, даже когда сетка на доли не делится (`half` при 5 колонках —
 * это 2, а не 3, иначе два таких блока в строку уже не встанут).
 *
 * Неизвестная строка даёт 1 колонку: опечатка в пресете должна бросаться в
 * глаза сразу, а не тихо растягивать блок на всю сетку.
 */
declare function resolveSpan(value: SpanValue | undefined, cols: number): number;
/** Ширина колонки при заданной ширине контента: остаток после всех зазоров. */
declare function colWidth(contentW: number, cols: number, gapX: number): number;
/** Размер блока шириной n единиц: сами единицы плюс зазоры между ними. */
declare function spanSize(n: number, unit: number, gap: number): number;
/**
 * Раскладка порядка в сетку — та же схема, что у CSS `grid-auto-flow: row`
 * (без `dense`): курсор идёт слева-вниз и назад не возвращается, поэтому
 * порядок блоков виден глазами и совпадает с порядком массива.
 *
 * Результат отдаётся блокам как ЯВНЫЕ `grid-column-start`/`grid-row-start`, а не
 * как auto-flow: браузер тогда не «домысливает» раскладку, и наша арифметика для
 * FLIP гарантированно описывает то, что нарисовано.
 *
 * У блока может быть `minW` — ширина, до которой он согласен ужаться, чтобы
 * влезть в остаток строки вместо переноса вниз. Фактическая ширина при этом
 * НИГДЕ не хранится: она заново выводится из раскладки, поэтому на просторном
 * месте блок сам разворачивается обратно до желаемой.
 */
declare function packFlow(items: Array<GridSpan & {
    minW?: number;
}>, cols: number, mode?: FlowMode): Array<Placed>;
/**
 * Свободная раскладка: блок стоит там, где ему сказано (`x`/`y`), а не там, куда
 * его вынес поток. Это режим «двигай куда хочешь, в том числе вниз, в пустоту» —
 * дырки между блоками остаются дырками.
 *
 * Координаты приходят от потребителя (и из localStorage), поэтому им нельзя
 * доверять: `x` зажимается в сетку, а место, которое уже занято (набор блоков
 * поменялся, `cols` уменьшился, стор вчерашний), разруливается поиском ближайшего
 * свободного НИЖЕ — так блок не исчезает под соседом.
 * Блоки без координат укладываются как в dense-потоке.
 */
declare function placeFree(items: Array<FreeSpan>, cols: number): Array<Placed>;
/** Сколько строк занимает раскладка — нужно для min-height контейнера. */
declare function rowCount(placed: Array<Placed>): number;
/** Прямоугольник блока в px. */
declare function cellRect(p: Placed, m: Metrics): Rect;
/** Переставить элемент массива, не мутируя исходный. */
declare function reorder<T>(list: Array<T>, from: number, to: number): Array<T>;
/**
 * Позиция вставки по указателю — индекс в списке БЕЗ перетаскиваемого.
 *
 * Считаем по ИСХОДНОЙ раскладке (той, что была на старте жеста), а не по
 * разъехавшейся: пороги тогда стоят на месте и дырка не дребезжит на границе.
 * Логика чтения та же, что у сортировщика-сетки: блок «раньше» указателя, если
 * он целиком выше него либо в той же полосе и левее его центра.
 */
declare function insertIndex(args: {
    /** исходная раскладка всех блоков, в порядке массива */
    base: Array<Placed>;
    dragId: string;
    m: Metrics;
    pointerX: number;
    pointerY: number;
}): number;
/**
 * Насколько каждый блок уезжает от своего места — вычитанием двух раскладок.
 * Перетаскиваемый исключён: он следует за курсором и своим transform живёт сам.
 */
declare function moveDeltas(args: {
    base: Array<Placed>;
    next: Array<Placed>;
    m: Metrics;
    skipId?: string;
}): Array<{
    id: string;
    dx: number;
    dy: number;
}>;
/**
 * Ячейка под блоком в свободном режиме: пиксельную позицию его левого верхнего
 * угла округляем до ближайшей ячейки и зажимаем в сетку.
 *
 * Считаем по УГЛУ блока, а не по курсору: пользователь тащит блок, значит
 * прилипать должен блок, а не точка захвата — иначе за курсор блок «убегает»
 * на половину своей ширины.
 */
declare function pointToCell(args: {
    x: number;
    y: number;
    w: number;
    m: Metrics;
}): {
    col: number;
    row: number;
};
/**
 * Первое свободное место под блок заданного размера — куда положить НОВЫЙ блок.
 *
 * В потоковых режимах координаты не нужны (новый блок дописывается в конец
 * массива), а вот в свободном месте его надо выбрать осознанно: иначе добавленный
 * блок либо накрывает соседа, либо уезжает в конец пустоты. Ищем сверху вниз,
 * поэтому «добавить виджет» кладёт его в первую же дырку.
 */
declare function firstFreeCell(args: {
    placed: Array<Placed>;
    cols: number;
    w: number;
    h: number;
}): {
    x: number;
    y: number;
};
/** Пересекается ли прямоугольник с кем-то, кроме себя. */
declare function overlaps(args: {
    placed: Array<Placed>;
    id: string;
    col: number;
    row: number;
    w: number;
    h: number;
}): boolean;
/** пределы размера блока в единицах сетки */
type SpanLimits = {
    minW?: number;
    maxW?: number;
    minH?: number;
    maxH?: number;
};
/**
 * Новый размер блока при ресайзе: пиксельную дельту переводим в единицы сетки и
 * округляем к ближайшей. Никаких замеров — только start-размер и dx/dy курсора.
 */
declare function snapSpan(args: {
    start: {
        w: number;
        h: number;
    };
    dx: number;
    dy: number;
    m: Metrics;
    limits?: SpanLimits;
}): {
    w: number;
    h: number;
};
/**
 * Свободный режим: обрезать желаемый размер до того, что реально свободно.
 *
 * В потоке растущий блок просто расталкивает соседей дальше по порядку, а здесь
 * толкать некого — каждый стоит на своём месте. Поэтому упираемся: сначала
 * отдаём ширину, потом высоту (ширина важнее — сетка колоночная). Если места нет
 * даже под минимум, отдаём минимум: пусть лучше рамка честно перекроет соседа и
 * дроп будет отклонён, чем блок молча схлопнется.
 */
declare function fitSpan(args: {
    placed: Array<Placed>;
    id: string;
    col: number;
    row: number;
    want: {
        w: number;
        h: number;
    };
    limits?: SpanLimits;
}): {
    w: number;
    h: number;
};

/** блок сетки: размеры в единицах + пределы ресайза (+ позиция в режиме free) */
type DumbGridBlock = GridSpan & FreeSpan & SpanLimits & {
    /** ни двигать, ни ресайзить (двигаться от соседей всё равно может) */
    locked?: boolean;
};
type DumbGridOptions = PressGateOptions & {
    /** текущий порядок и размеры блоков — источник истины у потребителя */
    blocks: () => Array<DumbGridBlock>;
    /** как раскладывать: поток, плотный поток или свободные позиции */
    mode?: () => LayoutMode;
    /** число колонок сетки */
    cols: () => number;
    /** высота строки, px */
    rowHeight: () => number;
    gapX: () => number;
    gapY: () => number;
    /** жесты запрещены целиком */
    disabled?: () => boolean;
    /** ресайз разрешён (драг остаётся) */
    resizable?: () => boolean;
    /**
     * Анимировать расступание соседей и приземление. По умолчанию да, но при
     * системном `prefers-reduced-motion: reduce` — нет; явное `true` перебивает.
     */
    animate?: boolean;
    /** поток: на дропе переставить блок из fromIndex в toIndex (индексы в blocks()) */
    onReorder: (fromIndex: number, toIndex: number) => void;
    /** free: на дропе поставить блок в ячейку (x — колонка, y — строка) */
    onMove?: (id: string, x: number, y: number) => void;
    /** на отпускании ручки ресайза: новый размер блока в единицах сетки */
    onResize: (id: string, w: number, h: number) => void;
    /**
     * Жест начался/закончился. Движку нельзя знать про сигналы, поэтому
     * реактивность строит обёртка: ./solid.ts пишет отсюда в createSignal.
     */
    onActive?: (state: {
        id: string;
        kind: 'move' | 'resize';
    } | null) => void;
};
type GridEngine = {
    /** ref на контейнер сетки: с него берутся ширина колонки и система координат */
    attachContainer: (el: HTMLElement) => () => void;
    /** ref на блок: регистрация + старт драга (ручка = дочка с [data-drag-handle]) */
    attach: (el: HTMLElement, id: string) => () => void;
    /** ref на ручку ресайза внутри блока */
    attachResize: (el: HTMLElement, id: string) => () => void;
    /** ширина колонки в px по последнему ResizeObserver (0 — ещё не измерено) */
    colWidth: () => number;
    /** id блока под жестом и его вид — для подсветки в UI */
    active: () => {
        id: string;
        kind: 'move' | 'resize';
    } | null;
    destroy: () => void;
};
declare function createGridEngine(opts: DumbGridOptions): GridEngine;

/** куда блок уехал: сетка, индекс в потоке и ячейка для свободного режима */
type GridTransferTarget = {
    grid: string;
    index: number;
    x: number;
    y: number;
};
type GridTransferSource = {
    grid: string;
    id: string;
    index: number;
};
type GridGroupOptions = PressGateOptions & {
    animate?: boolean;
    /** блок переехал в ДРУГУЮ сетку — обе раскладки правит потребитель */
    onTransfer?: (from: GridTransferSource, to: GridTransferTarget) => void;
    /** идёт жест: имя сетки, блок и вид — для подсветки */
    onActive?: (state: {
        grid: string;
        id: string;
        kind: 'move' | 'resize';
    } | null) => void;
    /** над какой сеткой сейчас указатель (null — ни над какой) */
    onOver?: (grid: string | null) => void;
};
/** сетка внутри группы: те же опции, что у одиночной, плюс приём чужих блоков */
type GridZoneOptions = {
    blocks: () => Array<DumbGridBlock>;
    mode?: () => LayoutMode;
    cols: () => number;
    rowHeight: () => number;
    gapX: () => number;
    gapY: () => number;
    disabled?: () => boolean;
    resizable?: () => boolean;
    /** пускать ли к себе блок из сетки `from` (по умолчанию да) */
    accepts?: (from: string) => boolean;
    /** перестановка внутри этой сетки (потоковые режимы) */
    onReorder?: (from: number, to: number) => void;
    /** перемещение внутри этой сетки (режим free) */
    onMove?: (id: string, x: number, y: number) => void;
    /** ресайз внутри этой сетки */
    onResize?: (id: string, w: number, h: number) => void;
};
type GridZoneEngine = {
    attachContainer: (el: HTMLElement) => () => void;
    attach: (el: HTMLElement, id: string) => () => void;
    attachResize: (el: HTMLElement, id: string) => () => void;
};
type GridGroupEngine = {
    grid: (name: string, opts: GridZoneOptions) => GridZoneEngine;
    active: () => {
        grid: string;
        id: string;
        kind: 'move' | 'resize';
    } | null;
    over: () => string | null;
    destroy: () => void;
};
declare function createGridGroupEngine(opts: GridGroupOptions): GridGroupEngine;

type GridActive = {
    id: string;
    kind: 'move' | 'resize';
} | null;
type DumbGridHandle = {
    /** ref на контейнер сетки (обязателен: с него берётся ширина колонки) */
    container: (el: HTMLElement) => void;
    /** ref на блок (ручка = дочка с [data-drag-handle]) */
    bind: (id: string) => (el: HTMLElement) => void;
    /** ref на ручку ресайза внутри блока */
    resize: (id: string) => (el: HTMLElement) => void;
    /** блок под жестом и вид жеста, реактивно */
    active: () => GridActive;
};
declare function createDumbGrid(opts: DumbGridOptions): DumbGridHandle;
type GridGroupActive = {
    grid: string;
    id: string;
    kind: 'move' | 'resize';
} | null;
type DumbGridGroupHandle = {
    /** зарегистрировать сетку; результат отдаётся компоненту как проп `group` */
    grid: (name: string, opts: GridZoneOptions) => DumbGridHandle;
    /** что сейчас тащат, реактивно */
    active: () => GridGroupActive;
    /** над какой сеткой указатель, реактивно (для подсветки приёмника) */
    over: () => string | null;
};
declare function createDumbGridGroup(opts: GridGroupOptions): DumbGridGroupHandle;

/** блок сетки */
type DumbGridItem = {
    id: string;
    /** содержимое — render prop */
    content: () => JSX.Element;
    /**
     * Ширина: число колонок ЛИБО доля сетки — `'full'`, `'half'`, `'third'`,
     * `'quarter'`, `'two-thirds'`, `'three-quarters'` или любая дробь `'5/12'`.
     * По умолчанию 1 колонка.
     */
    w?: SpanValue;
    /** высота в строках (по умолчанию 1) */
    h?: number;
    /** стартовая колонка в режиме free (иначе кладём потоком) */
    x?: number;
    /** стартовая строка в режиме free */
    y?: number;
    /** пределы ресайза — тоже числом или пресетом */
    minW?: SpanValue;
    maxW?: SpanValue;
    minH?: number;
    maxH?: number;
    /** ни двигать, ни ресайзить (от соседей всё равно может поехать) */
    locked?: boolean;
    /** показывать кнопку удаления (по умолчанию да, если задан onRemove) */
    removable?: boolean;
};
/** сохраняемая раскладка: порядок массива + размеры (+ позиции в режиме free) */
type DumbGridLayout = Array<{
    id: string;
    w: number;
    h: number;
    x?: number;
    y?: number;
}>;
type DumbGridProps = {
    items: Array<DumbGridItem>;
    /**
     * Как раскладывать (по умолчанию `flow`):
     *  • `flow`  — по порядку, дырки остаются;
     *  • `dense` — по порядку, дырки затыкаются следующими блоками;
     *  • `free`  — по своим {x,y}: двигай куда угодно, включая пустоту внизу.
     */
    mode?: LayoutMode;
    /** колонок в сетке (по умолчанию 12) */
    cols?: number;
    /** высота строки, px (по умолчанию 80) */
    rowHeight?: number;
    /** зазор, px (по умолчанию 12) */
    gap?: number;
    gapX?: number;
    gapY?: number;
    /** ключ localStorage; без него раскладка живёт только в памяти */
    storageKey?: string;
    /** внешнее управление раскладкой (тогда storageKey не нужен) */
    layout?: DumbGridLayout;
    /** раскладка изменилась — сохрани у себя */
    onLayout?: (layout: DumbGridLayout) => void;
    /**
     * Задан — на блоках появляется кнопка удаления, а по клику зовётся этот
     * колбэк. Набором блоков владеет потребитель, поэтому убрать элемент из
     * `items` он должен сам; кит только рисует кнопку и чистит за блоком раскладку.
     */
    onRemove?: (id: string) => void;
    /** подписи для кнопок (title/aria-label) */
    labels?: {
        remove?: string;
        resize?: string;
    };
    /**
     * Группа сеток (`createDumbGridGroup`) — с ней блок можно перетащить в другую
     * сетку той же группы. Локальные изменения (перестановка, ресайз, перенос
     * внутри) компонент по-прежнему применяет сам; наружу, в `onTransfer` группы,
     * уходит только переезд между сетками — он затрагивает две раскладки сразу.
     */
    group?: DumbGridGroupHandle;
    /** имя этой сетки в группе (обязательно, если задан `group`) */
    name?: string;
    /** ресайз разрешён (по умолчанию да) */
    resizable?: boolean;
    /**
     * Режим редактирования (по умолчанию `true`). `false` — готовая сетка и
     * ничего лишнего: ни ручек ресайза, ни кнопок удаления, ни разметки сетки, ни
     * единого обработчика на блоках. Ровно то, что нужно на «боевом» экране, где
     * дашборд просто показывают.
     *
     * Отличие от `disabled`: тот оставляет редакторскую разметку и лишь глушит
     * жесты (удобно, пока идёт сохранение), а `editable={false}` её не рендерит.
     */
    editable?: boolean;
    /** жесты запрещены целиком (разметка редактора остаётся) */
    disabled?: boolean;
    /** анимировать расступание и приземление; по умолчанию да, но не при prefers-reduced-motion */
    animate?: boolean;
    /** тач: удержание до старта драга, мс (по умолчанию 350) */
    pressDelay?: number;
    /** мышь: дистанция до старта драга, px */
    mouseThreshold?: number;
    /**
     * Показывать разметку сетки: `'drag'` (по умолчанию) — только во время жеста,
     * `true` — всегда, `false` — никогда. Рисуется CSS-градиентом на одном
     * элементе-подложке, поэтому ничего не меряет и не добавляет узлов на блок.
     */
    showGrid?: boolean | 'drag';
    /**
     * Сколько пустых строк держать под раскладкой, чтобы блок было куда увести
     * вниз. По умолчанию 2 в режиме `free` (там пустота осмысленна) и 0 в потоке.
     * Запас постоянный: расти во время жеста он не может, иначе появление полосы
     * прокрутки меняет ширину контента и сбивает шаг колонок.
     */
    spareRows?: number;
    class?: string;
    style?: JSX.CSSProperties;
    /** класс блока-обёртки */
    blockClass?: string;
    /** инлайн-стиль блока-обёртки */
    blockStyle?: JSX.CSSProperties;
};
/**
 * Слить сохранённую раскладку с текущим набором блоков.
 *
 * Набор блоков живёт своей жизнью (добавили виджет, убрали виджет,
 * переименовали id), а в localStorage лежит вчерашний снимок. Поэтому: чего нет
 * в items — выбрасываем, чего нет в сторе — дописываем в конец, размеры
 * прогоняем через пределы. Без этого устаревший стор рисует пустые дырки или
 * теряет новые блоки.
 */
declare function mergeLayout(saved: DumbGridLayout | null | undefined, items: Array<DumbGridItem>, cols: number, mode?: LayoutMode): DumbGridLayout;
/**
 * Разметка сетки — двумя CSS-градиентами на одном элементе-подложке.
 *
 * Ширина колонки НЕ меряется из JS: это `calc((100% - зазоры) / cols)`, браузер
 * считает её сам, поэтому линии верны с первого кадра и при любом ресайзе окна.
 *
 * Грабля, из-за которой вертикальных линий сначала не было видно: проценты в
 * стопах градиента считаются от размера ТАЙЛА (`background-size`), а не от
 * ширины элемента. Поэтому тайлить по X нельзя — рисуем все границы колонок
 * явными стопами на всю ширину (`background-size: 100%`), и тогда `100%` внутри
 * calc означает именно ширину подложки. По Y тайлить можно: там всё в px.
 */
declare function gridLinesBackground(args: {
    cols: number;
    gapX: number;
    rowH: number;
    gapY: number;
    /**
     * Толщина линии, px. Не задана — линия во весь зазор (так подложка читается
     * как «здесь дырка между блоками»). Доска просит волосяную: ей нужна
     * разметка ячеек, а не заливка промежутков.
     */
    line?: number;
}): {
    image: string;
    size: string;
};
declare function DumbGrid(props: DumbGridProps): JSX.Element;

export { DumbGrid, type DumbGridBlock, type DumbGridGroupHandle, type DumbGridHandle, type DumbGridItem, type DumbGridLayout, type DumbGridOptions, type DumbGridProps, type FlowMode, type FreeSpan, type GridActive, type GridEngine, type GridGroupActive, type GridGroupEngine, type GridGroupOptions, type GridSpan, type GridTransferSource, type GridTransferTarget, type GridZoneEngine, type GridZoneOptions, type LayoutMode, type Metrics, type Placed, type Rect, type SpanLimits, type SpanPreset, type SpanValue, cellRect, colWidth, createDumbGrid, createDumbGridGroup, createGridEngine, createGridGroupEngine, firstFreeCell, fitSpan, gridLinesBackground, insertIndex, mergeLayout, moveDeltas, overlaps, packFlow, placeFree, pointToCell, reorder, resolveSpan, rowCount, snapSpan, spanSize };
