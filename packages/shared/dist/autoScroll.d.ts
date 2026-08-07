export type AutoScroller = {
    /** снять цепочку прокручиваемых уровней от элемента вверх (на старте жеста) */
    start: (el: HTMLElement) => void;
    /** последняя известная позиция курсора */
    move: (x: number, y: number) => void;
    stop: () => void;
};
export declare function createAutoScroller(): AutoScroller;
