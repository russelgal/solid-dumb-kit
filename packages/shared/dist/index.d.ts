declare function prefersReducedMotion(): boolean;
/** анимировать ли: undefined → да, но с оглядкой на системную настройку */
declare function shouldAnimate(explicit?: boolean): boolean;

/**
 * Вставить стили один раз на документ.
 *
 * @param id  ключ, он же `data-dumb-kit` у тега — по нему видно в инспекторе,
 *            кто это положил, и по нему же ищется уже вставленное
 * @param css  сами правила
 */
declare function injectStyle(id: string, css: string): void;

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

/** снятая на старте геометрия скроллера (живыми остаются только scrollTop/Left) */
type ViewGeom = {
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
declare const EDGE = 48;
declare const MAX_SPEED = 18;
declare const ACCEL = 3.5;
/** ближайший прокручиваемый предок (включая сам элемент) */
declare function scrollParent(el: HTMLElement, includeSelf?: boolean): HTMLElement | null;
/** Единственное синхронное чтение геометрии — один раз на старте жеста. */
declare function measure(scroller: HTMLElement | null): ViewGeom;
/** Живой скролл — дешёвое чтение, layout не форсит. */
declare function scrollOf(scroller: HTMLElement | null): {
    sx: number;
    sy: number;
};
declare function doScroll(scroller: HTMLElement | null, dx: number, dy: number): void;
/**
 * Позиция скроллера во вьюпорте СЕЙЧАС: снятая на старте, сдвинутая на то,
 * насколько с тех пор прокрутилось окно. Так покадровый getBoundingClientRect
 * (forced layout!) заменяется на чтение window.scrollX/Y.
 */
declare function viewOrigin(geom: ViewGeom, winX: number, winY: number): {
    top: number;
    left: number;
};
/**
 * Скорость авто-скролла: чем дальше указатель за краем контейнера, тем быстрее
 * (до ACCEL× потолка). 0 — если указатель не в краевой зоне либо скроллить некуда.
 */
declare function autoScrollSpeed(args: {
    pointerY: number;
    viewTop: number;
    clientH: number;
    scrollY: number;
    scrollMax: number;
}): number;

declare function suppressTextSelection(): void;
declare function restoreTextSelection(): void;

/** с чего жест не начинается, когда тянут за весь элемент, а не за ручку */
declare const NO_DRAG = "input, textarea, select, option, button, a, label, [contenteditable=\"\"], [contenteditable=\"true\"], [data-no-drag]";
declare function targetIsInteractive(ev: PointerEvent): boolean;
/** внутри элемента что-то в фокусе (значит его редактируют, а не двигают) */
declare function focusInside(el: HTMLElement): boolean;
declare const LONGPRESS = 350;
declare const MOVE_TOL = 10;
type PressGateOptions = {
    /** тач: удержание до старта, мс (0 = сразу). По умолчанию 350 */
    pressDelay?: number;
    /** мышь: long-press до старта, мс (0 = выкл). Приоритетнее mouseThreshold */
    mousePressDelay?: number;
    /** мышь: дистанция до старта, px (0 = сразу) */
    mouseThreshold?: number;
};
type PressGate = {
    /**
     * Принять pointerdown. `start` позовётся, когда условие старта выполнено:
     * сразу, после удержания или после сдвига на порог.
     */
    arm: (ev: PointerEvent, start: (x: number, y: number) => void) => void;
    /** ждём ли мы сейчас старта (чтобы не начать второй жест поверх) */
    pending: () => boolean;
    cancel: () => void;
};
/**
 * Калитка старта жеста: на тач-устройстве ждём удержания (иначе палец не сможет
 * прокрутить страницу), мышью — сразу либо после порога-дистанции.
 */
declare function createPressGate(opts?: PressGateOptions): PressGate;

export { ACCEL, type AutoScroller, EDGE, type Flip, LONGPRESS, MAX_SPEED, MOVE_TOL, NO_DRAG, type PressGate, type PressGateOptions, type ViewGeom, autoScrollSpeed, createAutoScroller, createFlip, createPressGate, doScroll, focusInside, injectStyle, measure, prefersReducedMotion, restoreTextSelection, scrollOf, scrollParent, shouldAnimate, suppressTextSelection, targetIsInteractive, viewOrigin };
