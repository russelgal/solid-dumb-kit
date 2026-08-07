import { type LayoutMode } from './gridMath';
import type { DumbGridBlock } from './gridCore';
import { type PressGateOptions } from '@solid-dumb-kit/shared';
/** куда блок уехал: сетка, индекс в потоке и ячейка для свободного режима */
export type GridTransferTarget = {
    grid: string;
    index: number;
    x: number;
    y: number;
};
export type GridTransferSource = {
    grid: string;
    id: string;
    index: number;
};
export type GridGroupOptions = PressGateOptions & {
    animate?: boolean;
    /** блок переехал в ДРУГУЮ сетку — обе раскладки правит потребитель */
    onTransfer?: (from: GridTransferSource, to: GridTransferTarget) => void;
    /** идёт жест: имя сетки, блок и вид — для подсветки */
    onActive?: (state: {
        grid: string;
        id: string;
        kind: 'move' | 'resize';
    } | null) => void;
    /** над какой сеткой сейчас указатель (null — ни над какой) */
    onOver?: (grid: string | null) => void;
};
/** сетка внутри группы: те же опции, что у одиночной, плюс приём чужих блоков */
export type GridZoneOptions = {
    blocks: () => Array<DumbGridBlock>;
    mode?: () => LayoutMode;
    cols: () => number;
    rowHeight: () => number;
    gapX: () => number;
    gapY: () => number;
    disabled?: () => boolean;
    resizable?: () => boolean;
    /** пускать ли к себе блок из сетки `from` (по умолчанию да) */
    accepts?: (from: string) => boolean;
    /** перестановка внутри этой сетки (потоковые режимы) */
    onReorder?: (from: number, to: number) => void;
    /** перемещение внутри этой сетки (режим free) */
    onMove?: (id: string, x: number, y: number) => void;
    /** ресайз внутри этой сетки */
    onResize?: (id: string, w: number, h: number) => void;
};
export type GridZoneEngine = {
    attachContainer: (el: HTMLElement) => () => void;
    attach: (el: HTMLElement, id: string) => () => void;
    attachResize: (el: HTMLElement, id: string) => () => void;
};
export type GridGroupEngine = {
    grid: (name: string, opts: GridZoneOptions) => GridZoneEngine;
    active: () => {
        grid: string;
        id: string;
        kind: 'move' | 'resize';
    } | null;
    over: () => string | null;
    destroy: () => void;
};
export declare function createGridGroupEngine(opts: GridGroupOptions): GridGroupEngine;
