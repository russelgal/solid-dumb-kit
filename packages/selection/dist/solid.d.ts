import { type SelectionCoreOptions } from './selectionCore';
export declare function createSelectionArea(opts: SelectionCoreOptions): {
    /** повесить жест на контейнер */
    attach(el: HTMLElement): void;
};
