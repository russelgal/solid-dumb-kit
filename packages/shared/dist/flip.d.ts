export type Flip = {
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
export declare function createFlip(animate: boolean): Flip;
