export type MoveKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End' | 'PageUp' | 'PageDown';
export type MoveArgs = {
    /** откуда идём; `-1` — курсора ещё нет */
    from: number;
    count: number;
    /** колонок в ряду; 1 — список */
    columns?: number;
    /** сколько рядов в экране — для PageUp/PageDown */
    page?: number;
};
/**
 * Куда уводит клавиша. `null` — эта клавиша не про перемещение, обрабатывать
 * её не надо (и, что важнее, не надо гасить событие).
 */
export declare function moveIndex(key: string, args: MoveArgs): number | null;
/**
 * Выделение после нажатия. Три случая, и все три знакомы по любому файловому
 * менеджеру: просто стрелка переносит выделение, Shift растягивает диапазон от
 * якоря, Ctrl/Cmd только двигает курсор, ничего не трогая.
 */
export declare function moveSelection<T>(args: {
    keys: Array<T>;
    /** индекс, с которого начался диапазон */
    anchor: number;
    next: number;
    current: Set<T>;
    shift: boolean;
    ctrl: boolean;
}): {
    selected: Set<T>;
    anchor: number;
};
/** относится ли клавиша к перемещению — чтобы решить, гасить ли событие */
export declare const isMoveKey: (key: string) => key is MoveKey;
