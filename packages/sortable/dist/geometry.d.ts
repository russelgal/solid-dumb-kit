export { viewOrigin, autoScrollSpeed, EDGE, MAX_SPEED, ACCEL, type ViewGeom, } from '@solid-dumb-kit/shared';
/** позиция ячейки в координатах контента контейнера */
export type Cell = {
    left: number;
    top: number;
    width: number;
    height: number;
};
/** чужая ячейка для хиттеста: центры и вертикальные границы */
export type Item = {
    id: string;
    cx: number;
    cy: number;
    top: number;
    bottom: number;
};
/** Перетаскиваемый не должен выезжать за видимую область контейнера. */
export declare function clampDragged(args: {
    cell: Cell;
    tx: number;
    ty: number;
    scrollX: number;
    scrollY: number;
    clientW: number;
    clientH: number;
    grid: boolean;
}): {
    tx: number;
    ty: number;
};
/**
 * Позиция вставки по указателю (индекс в списке БЕЗ перетаскиваемого).
 * Сетка: считаем всех, кто «раньше» по строкам-колонкам; список: кто выше центра.
 */
export declare function hitIndex(others: Array<Item>, pX: number, pY: number, grid: boolean): number;
/**
 * Сетка: FLIP-маппинг «элемент → исходная ячейка его нового визуального индекса».
 * Корректно при одинаковых ячейках — для грида это норма.
 */
export declare function gridLayout(args: {
    ids: Array<string>;
    dragId: string;
    fromIndex: number;
    k: number;
    cells: Array<Cell>;
}): Array<{
    id: string;
    dx: number;
    dy: number;
}>;
/**
 * Куда встанет карточка — по ВИДИМЫМ сейчас позициям, а не по снятым.
 *
 * Раскладка уже раздвинула колонку: карточки ниже дырки стоят на holeH+gap ниже
 * своих снятых мест. Если сравнивать курсор со снятыми центрами, дырка
 * перескакивает раньше, чем курсор дошёл до середины видимой карточки (и
 * позже — при движении вверх). Поэтому считаем от текущего k инкрементально:
 *   • вниз  — когда курсор прошёл центр карточки, стоящей сразу ПОД дыркой;
 *   • вверх — когда поднялся выше центра карточки, стоящей сразу НАД ней.
 * Пороги вниз и вверх разнесены ровно на высоту дырки, поэтому на границе
 * ничего не дребезжит — гистерезис получается сам собой.
 */
export declare function nextInsertIndex(args: {
    /** плотные позиции карточек зоны БЕЗ перетаскиваемой, сверху вниз */
    cells: Array<Cell>;
    gap: number;
    top: number;
    /** высота места, которое занимает перетаскиваемая */
    holeH: number;
    /** текущая позиция дырки */
    k: number;
    pointerY: number;
}): number;
/** зазор между строками, выведенный из снимка (первые две ячейки) */
export declare function gapOf(cells: Array<Cell>): number;
/**
 * Раскладка = СДВИГ БЛОКА строк ровно на место перетаскиваемой.
 *
 * Считаем не «уложим колонку заново», а «кто именно и на сколько уезжает
 * относительно своей СНЯТОЙ позиции». Это принципиально: накопительная укладка
 * (`cursor += высота + зазор`) опирается на один усреднённый зазор, и при
 * субпиксельных высотах каждая следующая строка получает крошечное расхождение
 * со своим настоящим местом — строки дёргаются на пару пикселей уже в момент
 * захвата, когда переставлять ещё нечего. Здесь незатронутые строки получают
 * ровно 0, всегда.
 *
 * Индексы — в списке БЕЗ перетаскиваемой.
 * `from === null` — гость из другой колонки (своего места здесь нет).
 * `to === null` — перетаскиваемую увели в другую колонку, место держим.
 */
export declare function shiftLayout(args: {
    count: number;
    from: number | null;
    to: number | null;
    /** высота перетаскиваемой вместе с зазором */
    amount: number;
}): Array<number>;
/**
 * Верх дырки на позиции k — то есть куда приземлится перетаскиваемая.
 * Нужен, чтобы на дропе доанимировать её до места вместо телепорта:
 * позиция известна арифметически, мерить ничего не надо.
 */
export declare function holeTop(args: {
    /** ячейки БЕЗ перетаскиваемой, сверху вниз */
    cells: Array<Cell>;
    gap: number;
    top: number;
    k: number;
}): number;
/** Вертикальный список в пределах одной колонки. */
export declare function listLayout(args: {
    ids: Array<string>;
    dragId: string;
    fromIndex: number;
    k: number;
    cells: Array<Cell>;
}): Array<{
    id: string;
    dy: number;
}>;
