import { type DumbGridOptions } from './gridCore';
import { type GridGroupOptions, type GridZoneOptions } from './gridGroup';
export type GridActive = {
    id: string;
    kind: 'move' | 'resize';
} | null;
export type DumbGridHandle = {
    /** ref на контейнер сетки (обязателен: с него берётся ширина колонки) */
    container: (el: HTMLElement) => void;
    /** ref на блок (ручка = дочка с [data-drag-handle]) */
    bind: (id: string) => (el: HTMLElement) => void;
    /** ref на ручку ресайза внутри блока */
    resize: (id: string) => (el: HTMLElement) => void;
    /** блок под жестом и вид жеста, реактивно */
    active: () => GridActive;
};
export declare function createDumbGrid(opts: DumbGridOptions): DumbGridHandle;
export type GridGroupActive = {
    grid: string;
    id: string;
    kind: 'move' | 'resize';
} | null;
export type DumbGridGroupHandle = {
    /** зарегистрировать сетку; результат отдаётся компоненту как проп `group` */
    grid: (name: string, opts: GridZoneOptions) => DumbGridHandle;
    /** что сейчас тащат, реактивно */
    active: () => GridGroupActive;
    /** над какой сеткой указатель, реактивно (для подсветки приёмника) */
    over: () => string | null;
};
export declare function createDumbGridGroup(opts: GridGroupOptions): DumbGridGroupHandle;
