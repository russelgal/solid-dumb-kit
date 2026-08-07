/** блок в единицах сетки */
export type GridSpan = {
    id: string;
    /** ширина в колонках */
    w: number;
    /** высота в строках */
    h: number;
};
/** блок, которому нашлось место: колонка и строка — нулевые индексы */
export type Placed = GridSpan & {
    col: number;
    row: number;
};
/** блок со своей позицией — для свободного режима */
export type FreeSpan = GridSpan & {
    x?: number;
    y?: number;
};
/**
 * Как раскладывать:
 *  • `flow`  — по порядку, курсор назад не возвращается (CSS без `dense`);
 *  • `dense` — по порядку, но дырки затыкаются следующими блоками;
 *  • `free`  — каждый блок стоит по своим `x`/`y`, дырки остаются.
 */
export type LayoutMode = 'flow' | 'dense' | 'free';
/** режимы, у которых позиция выводится из порядка массива */
export type FlowMode = 'flow' | 'dense';
/** метрики сетки в px (colW приходит из ResizeObserver, остальное — пропы) */
export type Metrics = {
    cols: number;
    colW: number;
    rowH: number;
    gapX: number;
    gapY: number;
};
/** прямоугольник блока в координатах контента контейнера */
export type Rect = {
    x: number;
    y: number;
    width: number;
    height: number;
};
/**
 * Ширина «по-человечески»: доля сетки вместо счёта колонок.
 * Числа тоже принимаются — пресет это удобство, а не замена.
 */
export type SpanPreset = 'full' | 'half' | 'third' | 'quarter' | 'two-thirds' | 'three-quarters' | `${number}/${number}`;
export type SpanValue = number | SpanPreset;
/**
 * Пресет → колонки. Доля округляется ВНИЗ: так N блоков ширины `1/N` всегда
 * влезают в строку, даже когда сетка на доли не делится (`half` при 5 колонках —
 * это 2, а не 3, иначе два таких блока в строку уже не встанут).
 *
 * Неизвестная строка даёт 1 колонку: опечатка в пресете должна бросаться в
 * глаза сразу, а не тихо растягивать блок на всю сетку.
 */
export declare function resolveSpan(value: SpanValue | undefined, cols: number): number;
/** Ширина колонки при заданной ширине контента: остаток после всех зазоров. */
export declare function colWidth(contentW: number, cols: number, gapX: number): number;
/** Размер блока шириной n единиц: сами единицы плюс зазоры между ними. */
export declare function spanSize(n: number, unit: number, gap: number): number;
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
export declare function packFlow(items: Array<GridSpan & {
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
export declare function placeFree(items: Array<FreeSpan>, cols: number): Array<Placed>;
/** Сколько строк занимает раскладка — нужно для min-height контейнера. */
export declare function rowCount(placed: Array<Placed>): number;
/** Прямоугольник блока в px. */
export declare function cellRect(p: Placed, m: Metrics): Rect;
/** Переставить элемент массива, не мутируя исходный. */
export declare function reorder<T>(list: Array<T>, from: number, to: number): Array<T>;
/**
 * Позиция вставки по указателю — индекс в списке БЕЗ перетаскиваемого.
 *
 * Считаем по ИСХОДНОЙ раскладке (той, что была на старте жеста), а не по
 * разъехавшейся: пороги тогда стоят на месте и дырка не дребезжит на границе.
 * Логика чтения та же, что у сортировщика-сетки: блок «раньше» указателя, если
 * он целиком выше него либо в той же полосе и левее его центра.
 */
export declare function insertIndex(args: {
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
export declare function moveDeltas(args: {
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
export declare function pointToCell(args: {
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
export declare function firstFreeCell(args: {
    placed: Array<Placed>;
    cols: number;
    w: number;
    h: number;
}): {
    x: number;
    y: number;
};
/** Пересекается ли прямоугольник с кем-то, кроме себя. */
export declare function overlaps(args: {
    placed: Array<Placed>;
    id: string;
    col: number;
    row: number;
    w: number;
    h: number;
}): boolean;
/** пределы размера блока в единицах сетки */
export type SpanLimits = {
    minW?: number;
    maxW?: number;
    minH?: number;
    maxH?: number;
};
/**
 * Новый размер блока при ресайзе: пиксельную дельту переводим в единицы сетки и
 * округляем к ближайшей. Никаких замеров — только start-размер и dx/dy курсора.
 */
export declare function snapSpan(args: {
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
export declare function fitSpan(args: {
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
