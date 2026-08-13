import { type SelectionCoreOptions } from './selectionCore';
export declare function createSelectionArea(opts: SelectionCoreOptions): {
    /** повесить жест на контейнер; годится и как ref — owner захвачен здесь */
    attach: (el: HTMLElement) => void;
};
