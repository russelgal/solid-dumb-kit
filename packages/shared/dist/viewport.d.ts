/** снятая на старте геометрия скроллера (живыми остаются только scrollTop/Left) */
export type ViewGeom = {
    /** позиция скроллера во вьюпорте на момент старта */
    top: number;
    left: number;
    clientH: number;
    clientW: number;
    /** предел прокрутки на старте */
    max: number;
    /** полный размер содержимого (scrollWidth/scrollHeight) */
    scrollW: number;
    scrollH: number;
    /** скролл окна на момент старта — по нему компенсируем сдвиг контейнера */
    winX: number;
    winY: number;
};
export declare const EDGE = 48;
export declare const MAX_SPEED = 18;
export declare const ACCEL = 3.5;
/** ближайший прокручиваемый предок (включая сам элемент) */
export declare function scrollParent(el: HTMLElement, includeSelf?: boolean): HTMLElement | null;
/** Единственное синхронное чтение геометрии — один раз на старте жеста. */
export declare function measure(scroller: HTMLElement | null): ViewGeom;
/** Живой скролл — дешёвое чтение, layout не форсит. */
export declare function scrollOf(scroller: HTMLElement | null): {
    sx: number;
    sy: number;
};
export declare function doScroll(scroller: HTMLElement | null, dx: number, dy: number): void;
/**
 * Позиция скроллера во вьюпорте СЕЙЧАС: снятая на старте, сдвинутая на то,
 * насколько с тех пор прокрутилось окно. Так покадровый getBoundingClientRect
 * (forced layout!) заменяется на чтение window.scrollX/Y.
 */
export declare function viewOrigin(geom: ViewGeom, winX: number, winY: number): {
    top: number;
    left: number;
};
/**
 * Скорость авто-скролла: чем дальше указатель за краем контейнера, тем быстрее
 * (до ACCEL× потолка). 0 — если указатель не в краевой зоне либо скроллить некуда.
 */
export declare function autoScrollSpeed(args: {
    pointerY: number;
    viewTop: number;
    clientH: number;
    scrollY: number;
    scrollMax: number;
}): number;
