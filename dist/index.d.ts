import * as solid_js from 'solid-js';
import { JSX } from 'solid-js';

/** Как элемент попадает в выделение */
type IntersectMode = 
/** рамка коснулась элемента */
'touch'
/** рамка накрыла элемент целиком */
 | 'cover'
/** рамка накрыла центр элемента */
 | 'center';

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

declare function createSelectionArea(opts: SelectionCoreOptions): {
    /** повесить жест на контейнер */
    attach(el: HTMLElement): void;
};

type GridPanel = {
    /** Уникальный id панели */
    id: string;
    /** Содержимое — render prop */
    content: () => JSX.Element;
    /** Минимальный размер в px */
    min?: number;
    /** Начальный размер в fr (по умолчанию 1) */
    initial?: number;
};
type ResizableGridProps = {
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
declare function ResizableGrid(props: ResizableGridProps): JSX.Element;

type DumbSortableProps<T> = {
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
declare function DumbSortable<T>(props: DumbSortableProps<T>): JSX.Element;

type DumbSortableOptions = {
    /** текущий визуальный порядок id (совпадает с порядком data) */
    order: () => string[];
    /** 'y' — вертикальный список (по умолчанию), 'grid' — двумерная сетка */
    axis?: 'y' | 'grid';
    /** drag запрещён (напр. активна сортировка колонки) */
    disabled?: () => boolean;
    /** тач: удержание до старта драга, мс (0 = сразу). По умолчанию 350 */
    pressDelay?: number;
    /** мышь: long-press до старта, мс (0 = выкл). Имеет приоритет над mouseThreshold */
    mousePressDelay?: number;
    /** мышь: дистанция до старта драга, px (0 = сразу, как было). По умолчанию 0 */
    mouseThreshold?: number;
    /**
     * Анимировать расступание соседей и приземление на дропе.
     * По умолчанию да, но при системном `prefers-reduced-motion: reduce` —
     * нет. Явное `true` перебивает и системную настройку.
     */
    animate?: boolean;
    /** на дропе: переставить из fromIndex в toIndex (индексы в order()) */
    onEnd: (fromIndex: number, toIndex: number) => void;
};

type SortableGroupOptions = {
    /** перенос завершён: откуда (зона+индекс) и куда */
    onEnd: (from: {
        list: string;
        index: number;
    }, to: {
        list: string;
        index: number;
    }) => void;
    /** запретить драг целиком */
    disabled?: () => boolean;
    /** тач: удержание до старта драга, мс. По умолчанию 350 */
    pressDelay?: number;
    /** мышь: long-press до старта, мс (0 = выкл) */
    mousePressDelay?: number;
    /** мышь: дистанция до старта драга, px (0 = сразу) */
    mouseThreshold?: number;
    /**
     * Анимировать расступание карточек и приземление клона.
     * По умолчанию да, но при системном `prefers-reduced-motion: reduce` — нет.
     */
    animate?: boolean;
};
type SortableListOptions = {
    /** визуальный порядок id внутри этой зоны */
    order: () => string[];
    /** принимать ли элемент из зоны `from` (по умолчанию принимает всех) */
    accepts?: (from: string) => boolean;
};

type DumbSortableHandle = {
    /** самодостаточный ref на элемент (ручка = дочка с [data-drag-handle]) */
    bind: (id: string) => (el: HTMLElement) => void;
    /** низкоуровневый ref на элемент-ячейку */
    row: (id: string) => (el: HTMLElement) => void;
    /** низкоуровневый ref на ручку-хендл */
    handle: (id: string) => (el: HTMLElement) => void;
};
declare function createDumbSortable(opts: DumbSortableOptions): DumbSortableHandle;
type SortableListHandle = {
    /** ref на контейнер зоны */
    container: (el: HTMLElement) => void;
    /** ref на элемент зоны (ручка = дочка с [data-drag-handle]) */
    bind: (id: string) => (el: HTMLElement) => void;
};
type SortableGroupHandle = {
    /** зарегистрировать зону */
    list: (name: string, opts: SortableListOptions) => SortableListHandle;
    /** имя зоны под указателем во время драга (для подсветки), иначе null */
    activeList: () => string | null;
    /** id перетаскиваемого элемента, иначе null */
    draggingId: () => string | null;
};
declare function createSortableGroup(opts: SortableGroupOptions): SortableGroupHandle;

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
 */
declare function packFlow(items: Array<GridSpan>, cols: number, mode?: FlowMode): Array<Placed>;
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

type PressGateOptions = {
    /** тач: удержание до старта, мс (0 = сразу). По умолчанию 350 */
    pressDelay?: number;
    /** мышь: long-press до старта, мс (0 = выкл). Приоритетнее mouseThreshold */
    mousePressDelay?: number;
    /** мышь: дистанция до старта, px (0 = сразу) */
    mouseThreshold?: number;
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
declare function DumbGrid(props: DumbGridProps): JSX.Element;

type DndDragging = {
    grid: string;
    id: string;
    w: number;
    h: number;
};
type DndTransferSource = {
    grid: string;
    id: string;
    index: number;
};
type DndTransferTarget = {
    grid: string;
    index: number;
};
type DndGroupOptions = {
    /** анимировать расступание; по умолчанию да, но не при prefers-reduced-motion */
    animate?: boolean;
    /** блок переехал в ДРУГУЮ сетку — обе раскладки правит потребитель */
    onTransfer?: (from: DndTransferSource, to: DndTransferTarget) => void;
    /** что тащат сейчас */
    onActive?: (state: DndDragging | null) => void;
    /** над какой сеткой указатель */
    onOver?: (grid: string | null) => void;
    /**
     * Сколько строк займёт сетка, если бросить блок прямо сейчас.
     *
     * Без этого контейнер остаётся прежней высоты: соседи разъезжаются
     * трансформом, а трансформ высоту не меняет. Нижние блоки тогда вылезают за
     * край — и, что хуже, курсор над ними оказывается ВНЕ зоны приёма, так что
     * дроп туда просто не проходит.
     */
    onRows?: (grid: string, rows: number) => void;
};
type DndZoneOptions = {
    order: () => Array<string>;
    spanOf: (id: string) => {
        w: number;
        h: number;
    };
    cols: () => number;
    rowHeight: () => number;
    gapX: () => number;
    gapY: () => number;
    disabled?: () => boolean;
    accepts?: (from: string) => boolean;
    onReorder?: (from: number, to: number) => void;
};
/**
 * Куда встанет блок и как для этого разъезжаются соседи — вся решающая часть,
 * без DOM и событий. Вынесена наружу, чтобы проверяться тестами напрямую:
 * жест руками не воспроизвести, а вот арифметику — сколько угодно.
 */
declare function planDrop(args: {
    /** порядок и размеры блоков сетки-приёмника */
    spans: Array<{
        id: string;
        w: number;
        h: number;
    }>;
    /**
     * Раскладка, по которой считать пороги, — та, что сейчас видна. Не задана —
     * берём укладку самих spans (первый заход в сетку).
     */
    base?: Array<Placed>;
    m: Metrics;
    /** указатель в координатах контента сетки */
    x: number;
    y: number;
    /** блок гостя: id, размер и индекс, если он из ЭТОЙ же сетки */
    drag: {
        id: string;
        w: number;
        h: number;
        fromIndex: number | null;
    };
}): {
    index: number;
    next: Array<Placed>;
    moves: Array<{
        id: string;
        dx: number;
        dy: number;
    }>;
    rect: {
        x: number;
        y: number;
        width: number;
        height: number;
    } | null;
};
type DndZoneEngine = {
    attachContainer: (el: HTMLElement) => () => void;
    attach: (el: HTMLElement, id: string) => () => void;
};
type DndEngine = {
    grid: (name: string, opts: DndZoneOptions) => DndZoneEngine;
    active: () => DndDragging | null;
    over: () => string | null;
    destroy: () => void;
};
declare function createGridDndEngine(opts?: DndGroupOptions): DndEngine;
/** Есть ли нативный DnD вообще (на тач-устройствах его нет). */
declare const dndSupported: () => boolean;
/** формат данных переноса — Pragmatic кладёт свои, этот остаётся для совместимости */
declare const DND_MIME = "application/x-dumb-grid";

type DndActive = DndDragging | null;
type DumbGridDndHandle = {
    /** ref на контейнер сетки */
    container: (el: HTMLElement) => void;
    /** ref на блок — он становится нативно перетаскиваемым */
    bind: (id: string) => (el: HTMLElement) => void;
    /** блок, который тащат из ЭТОЙ сетки */
    active: () => string | null;
};
type DumbGridDndGroupHandle = {
    grid: (name: string, opts: DndZoneOptions) => DumbGridDndHandle;
    /** что тащат сейчас */
    active: () => DndActive;
    /** сетка под указателем — для подсветки приёмника */
    over: () => string | null;
    /** сколько строк займёт сетка, если бросить блок сейчас (0 — жеста нет) */
    rows: (grid: string) => number;
};
declare function createDumbGridDndGroup(opts?: DndGroupOptions): DumbGridDndGroupHandle;

type DumbGridDndItem = {
    id: string;
    content: () => JSX.Element;
    /** ширина: число колонок либо доля сетки (`'half'`, `'1/3'`, …) */
    w?: SpanValue;
    /** высота в строках */
    h?: number;
};
type DumbGridDndProps = {
    items: Array<DumbGridDndItem>;
    cols?: number;
    rowHeight?: number;
    gap?: number;
    /** перестановка внутри этой сетки */
    onReorder?: (from: number, to: number) => void;
    /** перетаскивание выключено — рисуем просто сетку */
    disabled?: boolean;
    /** группа сеток: с ней блок можно утащить в соседнюю сетку */
    group?: DumbGridDndGroupHandle;
    /** имя этой сетки в группе */
    name?: string;
    class?: string;
    style?: JSX.CSSProperties;
    blockClass?: string;
    blockStyle?: JSX.CSSProperties;
};
declare function DumbGridDnd(props: DumbGridDndProps): JSX.Element;

type DumbSortableDndProps<T> = {
    items: Array<T>;
    /** позвать с новым порядком (на дропе) */
    setItems: (next: Array<T>) => void;
    /** стабильный id элемента */
    id: (item: T) => string;
    /** `y` — вертикальный список (по умолчанию), `grid` — сетка плиток */
    axis?: 'y' | 'grid';
    disabled?: boolean;
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
    /** на дропе: переставить из fromIndex в toIndex (индексы в order()) */
    onEnd?: (fromIndex: number, toIndex: number) => void;
    /** id строки, которую тащат (null — жеста нет) */
    onActive?: (id: string | null) => void;
};
type SortDndEngine = {
    /** ref на контейнер списка */
    attachContainer: (el: HTMLElement) => () => void;
    /** ref на строку; ручка — дочка с [data-drag-handle] */
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

type Flip = {
    /** отправить элемент на смещение (dx, dy) от его места в потоке */
    to: (el: HTMLElement, dx: number, dy: number) => void;
    /**
     * Элемент УЖЕ переехал (переставили DOM, сменили `order`, изменилась
     * раскладка) — доиграть переезд: стартовать со смещения (dx, dy), то есть со
     * старого места, и приехать в ноль. Классический FLIP: Invert + Play.
     */
    nudge: (el: HTMLElement, dx: number, dy: number) => void;
    /** снять всё разом — на завершении жеста */
    clear: () => void;
};
declare function createFlip(animate: boolean): Flip;

type AutoScroller = {
    /** снять цепочку прокручиваемых уровней от элемента вверх (на старте жеста) */
    start: (el: HTMLElement) => void;
    /** последняя известная позиция курсора */
    move: (x: number, y: number) => void;
    stop: () => void;
};
declare function createAutoScroller(): AutoScroller;

type DumbTreeNode = {
    id: number | string;
    parent: number | string;
    title: string;
    /** порядок среди соседей (для сортировки «по индексу») */
    index?: number;
    /** доп. строка для поиска/тултипа (бренд категории и т.п.) */
    meta?: string | null;
};
type Id = number | string;
type DumbTreeIcons = {
    /** папка свёрнута */
    folder: string;
    /** папка раскрыта */
    folderOpen: string;
    /** лист (flat-режим / узел без детей) */
    leaf: string;
    /** стрелка раскрытой папки */
    expanded: string;
    /** стрелка свёрнутой папки */
    collapsed: string;
    search: string;
    sortIndex: string;
    sortName: string;
    dragHandle: string;
};
type DumbTreeLabels = Partial<{
    search: string;
    sortIndex: string;
    sortName: string;
}>;
type DumbTreeProps<T extends DumbTreeNode> = {
    /** плоский массив узлов (иерархия по parent). undefined → спиннер загрузки */
    nodes?: Array<T>;
    /** заголовок сайдбара */
    title?: string;
    /** активный (выбранный) id — реактивный аксессор */
    activeId?: () => Id | null | undefined;
    /** клик по строке */
    onSelect?: (id: T['id'], node: T) => void;
    /** плоский список без иерархии/сворачивания */
    flat?: boolean;
    /** скрыть поле поиска */
    hideSearch?: boolean;
    placeholder?: string;
    /** свой матчер поиска (по умолчанию fuzzy по title/meta/id) */
    match?: (node: T, query: string) => boolean;
    /** скрыть тоггл сортировки и держать порядок строго по index */
    hideSort?: boolean;
    /** локаль для сравнения названий (по умолчанию — браузерная) */
    locale?: string;
    /** ключ localStorage для раскрытых папок и режима сортировки */
    storageKey?: string;
    /** drag-reorder flat-списка: переставить from→to в порядке отображения */
    sortable?: (from: number, to: number) => void;
    /** анимировать перестановку; по умолчанию да, но не при prefers-reduced-motion */
    animate?: boolean;
    /** доп. контент справа в строке (бейджи/иконки статуса) */
    rowExtra?: (node: T) => JSX.Element;
    /** доп. класс на строку-ссылку (напр. opacity-50 для скрытых) */
    rowClass?: (node: T) => string | undefined;
    /** доп. класс на текст строки (напр. line-through) */
    titleClass?: (node: T) => string | undefined;
    /** свой tooltip строки (по умолчанию «title · meta · id N») */
    rowTitle?: (node: T) => string;
    /** доп. класс на корневой <aside> */
    class?: string;
    /** классы иконок (обязательно — кит не несёт свой набор) */
    icons: DumbTreeIcons;
    labels?: DumbTreeLabels;
};
declare function DumbTree<T extends DumbTreeNode>(props: DumbTreeProps<T>): JSX.Element;

type DumbColumn<T> = {
    /** ключ колонки: id для сортировки и путь к значению по умолчанию */
    key: string;
    /** содержимое `<th>` */
    label?: JSX.Element;
    /** разрешить сортировку по этой колонке */
    sortable?: boolean;
    /** класс на `<th>` и `<td>` */
    class?: string;
    /** класс только на `<th>` */
    headClass?: string;
    /** выравнивание содержимого */
    align?: 'left' | 'center' | 'right';
    /** ширина колонки (CSS-значение, напр. '80px' или '12%') */
    width?: string;
    /** не пускать клик по ячейке в onRowClick (для кнопок/инпутов внутри) */
    stopClick?: boolean;
    /** содержимое `<td>`; по умолчанию — значение по `key` */
    render?: (row: T, index: number) => JSX.Element;
    /** значение для сортировки; по умолчанию — `row[key]` */
    value?: (row: T) => unknown;
};
type DumbTableProps<T> = {
    rows: Array<T>;
    columns: Array<DumbColumn<T>>;
    /** стабильный id строки (нужен перетаскиванию); по умолчанию — индекс */
    rowId?: (row: T, index: number) => string;
    /** активная колонка сортировки — задаёт СЕРВЕРНЫЙ режим (вместе с onSort) */
    sort?: string;
    order?: 'asc' | 'desc';
    /**
     * Есть onSort → сортирует сервер (manualSorting); нет → сортируем на клиенте.
     * Третий клик по колонке сбрасывает сортировку — тогда придёт (null, null).
     */
    onSort?: (key: string | null, order: 'asc' | 'desc' | null) => void;
    /** убрать третий клик-сброс: сортировка будет только asc ⇄ desc */
    noSortRemoval?: boolean;
    /**
     * Анимировать смену сортировки через View Transitions.
     * Смысл только в клиентском режиме: там состояние меняется внутри таблицы и
     * снаружи его не обернуть. В серверном режиме оборачивай сам — данные всё
     * равно приходят от тебя. Строкам нужен уникальный `view-transition-name`
     * (см. `rowStyle`), иначе браузер сделает кроссфейд всей таблицы.
     */
    viewTransition?: boolean;
    /** анимировать перетаскивание строк; по умолчанию да, но не при prefers-reduced-motion */
    animate?: boolean;
    /**
     * Направление ПЕРВОГО клика по заголовку. По умолчанию — как у TanStack:
     * текстовые колонки начинают с asc, числовые с desc. `false` заставляет
     * все колонки начинать с asc, `true` — с desc.
     */
    sortDescFirst?: boolean;
    /** включает перетаскивание строк за ручку; индексы — в текущем показанном порядке */
    onReorder?: (from: number, to: number) => void;
    /**
     * Содержимое ручки перетаскивания. `false` — ручки нет вовсе, строка тянется
     * целиком; тогда стоит задать `dragThreshold`, иначе клик по строке и начало
     * драга неотличимы (а поверх таблицы ещё может быть выделение рамкой).
     */
    handle?: JSX.Element | false;
    /** сколько px пройти мышью до старта драга (по умолчанию 0 — сразу) */
    dragThreshold?: number;
    onRowClick?: (row: T, index: number) => void;
    /** приглушить таблицу на время загрузки */
    loading?: boolean;
    /** показывается вместо таблицы, когда строк нет */
    empty?: JSX.Element;
    class?: string;
    tableClass?: string;
    headClass?: string;
    rowClass?: (row: T, index: number) => string | undefined;
    /** стиль на строку — например уникальный `view-transition-name` */
    rowStyle?: (row: T, index: number) => JSX.CSSProperties | undefined;
    /** содержимое `<tfoot>` */
    footer?: JSX.Element;
    /**
     * Распорки для виртуализации: сколько пикселей «съедено» строками выше и ниже
     * окна. Само окно режешь снаружи — как и страницу, таблица рисует что дали.
     * Перетаскивание при этом лучше выключать: снимок позиций делается один раз,
     * а строки за пределами окна в DOM просто отсутствуют.
     */
    spacerTop?: number;
    spacerBottom?: number;
};
declare function DumbTable<T>(props: DumbTableProps<T>): JSX.Element;

type DumbPaginationProps = {
    page: number;
    total: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    /** показывает переключатель размера страницы */
    pageSizes?: Array<number>;
    onPageSizeChange?: (size: number) => void;
    /** подпись слева; по умолчанию «total · page/pages» */
    summary?: (info: {
        page: number;
        pages: number;
        total: number;
    }) => string;
    class?: string;
    buttonClass?: string;
    activeClass?: string;
};
declare function buildPageNumbers(current: number, total: number): Array<number | '…'>;
declare function DumbPagination(props: DumbPaginationProps): solid_js.JSX.Element;

/**
 * Клиент стандартного интерфейса OData 1С (`standard.odata`).
 *
 * Framework-free и универсальный (браузер и Node 18+): fetch, TextEncoder,
 * без зависимостей. Инкапсулирует известные капризы 1С:
 * - `$format=application/json;odata=nometadata` в каждом запросе — иначе в
 *   ответе светится внутренний адрес сервера 1С (Accept 1С игнорирует).
 * - Пробелы в параметрах кодируются как `%20` — с `+` 1С МОЛЧА игнорирует
 *   `$filter` (поэтому не URLSearchParams).
 * - `$filter`/`$orderby` по полям могут быть запрещены правами роли
 *   («Операция не разрешена в предложении "ГДЕ"») — для хронологических
 *   списков есть `tailPage()` (листание с конца через `$skip`).
 * - Точечное чтение `Entity(guid'...')` работает даже когда `$filter` запрещён.
 * - Ошибки 1С приходят как `odata.error` (иногда с BOM) — парсятся.
 */
type OdataClientOptions = {
    /** Базовый URL: прямой `https://host/base/odata/standard.odata` или прокси `/odata` */
    baseUrl: string;
    /** Логин 1С (Basic). Либо передайте готовый token. */
    login?: string;
    password?: string;
    /** Готовый base64(login:password) — если логин/пароль не хранится */
    token?: string;
    /** Свой fetch (например, с логированием или ретраями) */
    fetch?: typeof fetch;
    /** Таймаут запроса, мс (по умолчанию 30000). Защита от зависших запросов 1С. */
    timeoutMs?: number;
};
type OdataListResponse<T> = {
    value: T[];
    'odata.count'?: string;
};
declare class OdataError extends Error {
    readonly status?: number | undefined;
    constructor(message: string, status?: number | undefined);
}
/** base64 c поддержкой UTF-8 (кириллица в логинах 1С), работает в браузере и Node */
declare function toBase64(s: string): string;
/** Экранирование строки для `$filter`: апостроф удваивается */
declare function odataString(s: string): string;
declare class OdataClient {
    private readonly baseUrl;
    private readonly token;
    private readonly fetchFn;
    private readonly timeoutMs;
    constructor(opts: OdataClientOptions);
    /** Сборка URL: параметры кодируются вручную (`%20`, не `+`) */
    url(resource: string, params?: Record<string, string | number>): string;
    request<T>(resource: string, params?: Record<string, string | number>, init?: {
        method?: string;
        body?: unknown;
    }): Promise<T>;
    /** GET сущности/набора */
    get<T = Record<string, unknown>>(resource: string, params?: Record<string, string | number>): Promise<T>;
    /** GET набора → массив `value` */
    list<T = Record<string, unknown>>(resource: string, params?: Record<string, string | number>): Promise<T[]>;
    /** Точечное чтение по ключу: `Entity(guid'...')` — работает даже при запрете `$filter` */
    one<T = Record<string, unknown>>(entity: string, refKey: string, select?: string): Promise<T>;
    /** Точное число записей набора (опционально — с `$filter`) */
    count(resource: string, filter?: string): Promise<number>;
    /**
     * Страница «свежие сверху» хронологического набора, когда `$orderby`
     * игнорируется/запрещён: читаем кусок с конца через `$skip` и разворачиваем.
     * `filter` (опционально) применяется и к count, и к странице — поиск
     * с пагинацией поверх того же приёма.
     */
    tailPage<T = Record<string, unknown>>(resource: string, opts: {
        page: number;
        pageSize: number;
        select?: string;
        filter?: string;
    }): Promise<{
        rows: T[];
        total: number;
    }>;
}
declare function createOdataClient(opts: OdataClientOptions): OdataClient;

type Numeric = number | string | null | undefined;
/** 1 234,56 ₽ */
declare function RubR2(v: Numeric): string;
/** 1 234,56 */
declare function Rub2(v: Numeric): string;
/** 1 235 */
declare function Rub0(v: Numeric): string;
/** 1 235 ₽ */
declare function Rub0R(v: Numeric): string;
/** 1 234,5678 */
declare function Rub4(v: Numeric): string;
/** 1 234 или — */
declare function fmtNum(v: Numeric): string;
/** 1 234,56 ₽ или — */
declare function fmtPrice(v: Numeric): string;
type DateInput = string | number | Date | null | undefined;
/** 23.02.2026, 16:40:22 */
declare function fmtDateTime(v: DateInput): string;
/** 23.02.2026, 16:40 */
declare function fmtDateTimeShort(v: DateInput): string;
/** 23.02.2026 */
declare function fmtDate(v: DateInput): string;
/** 16:40:22 */
declare function fmtTime(v: DateInput): string;
/** 23 февр. 2026 г. */
declare function fmtDateMonth(v: DateInput): string;
/** 512 Б / 24 КБ / 1.3 МБ */
declare function fmtSize(bytes: number): string;
/** "2 ч. назад", "3 дн. назад" или — */
declare function timeAgo(v: DateInput): string;

declare const genSlug: (name: string) => string;

/** Извлечь изображения из ZIP-архива, вернуть как FileList */
declare function extractImagesFromZip(zipFile: File): Promise<FileList>;

/**
 * imgproxy URL builder — чистая функция без зависимостей от SolidJS/DOM.
 *
 * URL: /insecure/{processing_options}/{base64url(source)}.{ext}
 * Подпись здесь не реализована — для прода либо включайте /insecure/
 * в imgproxy, либо подписывайте на сервере и передавайте готовый URL.
 */
type ImgFit = 'fit' | 'fill' | 'fill-down' | 'force' | 'auto';
type ImgGravity = 'no' | 'so' | 'ea' | 'we' | 'noea' | 'nowe' | 'soea' | 'sowe' | 'ce' | 'sm' | 'fp';
type ImgFormat = 'jpg' | 'png' | 'webp' | 'avif' | 'gif' | 'ico' | 'svg' | 'tiff';
type ImgproxyOps = {
    w?: number;
    h?: number;
    fit?: ImgFit;
    q?: number;
    format?: ImgFormat;
    gravity?: ImgGravity;
    enlarge?: boolean;
    extend?: boolean;
    dpr?: number;
    blur?: number;
    sharpen?: number;
    bg?: string;
    padding?: number | [number, number, number, number];
    preset?: string | string[];
};
type ImgproxyConfig = {
    /** База imgproxy, напр. https://img.example.com. Не задана → imgproxyUrl вернёт src как есть */
    baseUrl?: string;
    /** S3-бакет для конвертации /media/... → s3://bucket/... Не задан → конвертации нет */
    bucket?: string;
    /** Публичный http-эндпоинт того же бакета — тоже конвертируется в s3:// */
    webEndpoint?: string;
};
/**
 * Явно задать настройки imgproxy (перебивают переменные окружения).
 * Вызывать один раз на старте приложения.
 */
declare function configureImgproxy(c: ImgproxyConfig): void;
/**
 * Строит imgproxy URL из src.
 *
 * Конвертация source (только если задан бакет):
 *   /media/sites/1/...              → s3://{bucket}/sites/1/...
 *   http://{webEndpoint}/path       → s3://{bucket}/path
 *   http://...                      → как есть
 *
 * Настройки берутся из configureImgproxy(), иначе из переменных окружения
 * VITE_IMGPROXY_URL / VITE_S3_BUCKET / VITE_S3_WEB_ENDPOINT.
 * Если база не задана — возвращает оригинальный src (graceful fallback).
 */
declare function imgproxyUrl(src: string, opts?: ImgproxyOps): string;

export { type AutoScroller, DND_MIME, type DndActive, type DndEngine, type DndGroupOptions, type DndTransferSource, type DndTransferTarget, type DndZoneEngine, type DndZoneOptions, type DumbColumn, DumbGrid, type DumbGridBlock, DumbGridDnd, type DumbGridDndGroupHandle, type DumbGridDndHandle, type DumbGridDndItem, type DumbGridDndProps, type DumbGridGroupHandle, type DumbGridHandle, type DumbGridItem, type DumbGridLayout, type DumbGridOptions, type DumbGridProps, DumbPagination, type DumbPaginationProps, DumbSortable, DumbSortableDnd, type DumbSortableDndHandle, type DumbSortableDndProps, type DumbSortableHandle, type DumbSortableOptions, type DumbSortableProps, DumbTable, type DumbTableProps, DumbTree, type DumbTreeIcons, type DumbTreeLabels, type DumbTreeNode, type DumbTreeProps, type Flip, type FlowMode, type FreeSpan, type GridActive, type GridEngine, type GridGroupActive, type GridGroupEngine, type GridGroupOptions, type GridPanel, type GridSpan, type GridTransferSource, type GridTransferTarget, type GridZoneEngine, type GridZoneOptions, type ImgFit, type ImgFormat, type ImgGravity, type ImgproxyConfig, type ImgproxyOps, type IntersectMode, type LayoutMode, type Metrics, OdataClient, type OdataClientOptions, OdataError, type OdataListResponse, type Placed, type Rect, ResizableGrid, type ResizableGridProps, Rub0, Rub0R, Rub2, Rub4, RubR2, SelectionArea, type SelectionAreaProps, type SelectionCoreOptions, type SortDndEngine, type SortDndOptions, type SortableGroupHandle, type SortableGroupOptions, type SortableListHandle, type SortableListOptions, type SpanLimits, type SpanPreset, type SpanValue, buildPageNumbers, cellRect, colWidth, configureImgproxy, createAutoScroller, createDumbGrid, createDumbGridDndGroup, createDumbGridGroup, createDumbSortable, createDumbSortableDnd, createFlip, createGridDndEngine, createGridEngine, createGridGroupEngine, createOdataClient, createSelectionArea, createSortDndEngine, createSortableGroup, dndSupported, extractImagesFromZip, firstFreeCell, fitSpan, fmtDate, fmtDateMonth, fmtDateTime, fmtDateTimeShort, fmtNum, fmtPrice, fmtSize, fmtTime, genSlug, imgproxyUrl, insertIndex, mergeLayout, moveDeltas, odataString, overlaps, packFlow, placeFree, planDrop, pointToCell, resolveSpan, rowCount, snapSpan, spanSize, timeAgo, toBase64 };
