import { type SortDndOptions } from './sortDndCore';
export type DumbSortableDndHandle = {
    /** ref на контейнер списка */
    container: (el: HTMLElement) => void;
    /** ref на строку (ручка — дочка с [data-drag-handle]) */
    bind: (id: string) => (el: HTMLElement) => void;
    /** id строки, которую тащат */
    active: () => string | null;
};
export declare function createDumbSortableDnd(opts: SortDndOptions): DumbSortableDndHandle;
