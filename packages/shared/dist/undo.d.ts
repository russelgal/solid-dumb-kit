export type UndoStep = {
    /** что писать в кнопке и в подсказке: «перенос 3 шт.» */
    label: string;
    /**
     * Как вернуть как было. `null` — вернуть нельзя: удаление без корзины,
     * перезапись файла. Такой шаг обрывает всю цепочку отмены за собой.
     */
    undo: (() => Promise<void>) | null;
    /** как повторить после отмены; не задан — повтор недоступен */
    redo?: () => Promise<void>;
};
export type UndoStack = {
    /** запомнить сделанное */
    push: (step: UndoStep) => void;
    undo: () => Promise<void>;
    redo: () => Promise<void>;
    /** что отменится следующим; `null` — нечего или нельзя */
    peekUndo: () => UndoStep | null;
    peekRedo: () => UndoStep | null;
    canUndo: () => boolean;
    canRedo: () => boolean;
    clear: () => void;
};
export type UndoOptions = {
    /** сколько шагов помнить; по умолчанию 50 */
    limit?: number;
    /** стек изменился — перерисовать кнопки */
    onChange?: () => void;
    /** отмена сорвалась */
    onError?: (err: unknown, step: UndoStep) => void;
};
export declare function createUndoStack(opts?: UndoOptions): UndoStack;
