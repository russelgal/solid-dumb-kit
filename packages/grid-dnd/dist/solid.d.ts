import { type DndDragging, type DndGroupOptions, type DndZoneOptions } from './dndCore';
export type DndActive = DndDragging | null;
export type DumbGridDndHandle = {
    /** ref на контейнер сетки */
    container: (el: HTMLElement) => void;
    /** ref на блок — он становится нативно перетаскиваемым */
    bind: (id: string) => (el: HTMLElement) => void;
    /** блок, который тащат из ЭТОЙ сетки */
    active: () => string | null;
};
export type DumbGridDndGroupHandle = {
    grid: (name: string, opts: DndZoneOptions) => DumbGridDndHandle;
    /** что тащат сейчас */
    active: () => DndActive;
    /** сетка под указателем — для подсветки приёмника */
    over: () => string | null;
    /** сколько строк займёт сетка, если бросить блок сейчас (0 — жеста нет) */
    rows: (grid: string) => number;
};
export declare function createDumbGridDndGroup(opts?: DndGroupOptions): DumbGridDndGroupHandle;
