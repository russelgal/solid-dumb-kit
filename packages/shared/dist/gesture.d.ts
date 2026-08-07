/** с чего жест не начинается, когда тянут за весь элемент, а не за ручку */
export declare const NO_DRAG = "input, textarea, select, option, button, a, label, [contenteditable=\"\"], [contenteditable=\"true\"], [data-no-drag]";
export declare function targetIsInteractive(ev: PointerEvent): boolean;
/** внутри элемента что-то в фокусе (значит его редактируют, а не двигают) */
export declare function focusInside(el: HTMLElement): boolean;
export declare const LONGPRESS = 350;
export declare const MOVE_TOL = 10;
export type PressGateOptions = {
    /** тач: удержание до старта, мс (0 = сразу). По умолчанию 350 */
    pressDelay?: number;
    /** мышь: long-press до старта, мс (0 = выкл). Приоритетнее mouseThreshold */
    mousePressDelay?: number;
    /** мышь: дистанция до старта, px (0 = сразу) */
    mouseThreshold?: number;
};
export type PressGate = {
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
export declare function createPressGate(opts?: PressGateOptions): PressGate;
