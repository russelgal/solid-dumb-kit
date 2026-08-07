import { type FreeSpan, type GridSpan, type LayoutMode, type SpanLimits } from './gridMath';
import { type PressGateOptions } from '@solid-dumb-kit/shared';
/** блок сетки: размеры в единицах + пределы ресайза (+ позиция в режиме free) */
export type DumbGridBlock = GridSpan & FreeSpan & SpanLimits & {
    /** ни двигать, ни ресайзить (двигаться от соседей всё равно может) */
    locked?: boolean;
};
export type DumbGridOptions = PressGateOptions & {
    /** текущий порядок и размеры блоков — источник истины у потребителя */
    blocks: () => Array<DumbGridBlock>;
    /** как раскладывать: поток, плотный поток или свободные позиции */
    mode?: () => LayoutMode;
    /** число колонок сетки */
    cols: () => number;
    /** высота строки, px */
    rowHeight: () => number;
    gapX: () => number;
    gapY: () => number;
    /** жесты запрещены целиком */
    disabled?: () => boolean;
    /** ресайз разрешён (драг остаётся) */
    resizable?: () => boolean;
    /**
     * Анимировать расступание соседей и приземление. По умолчанию да, но при
     * системном `prefers-reduced-motion: reduce` — нет; явное `true` перебивает.
     */
    animate?: boolean;
    /** поток: на дропе переставить блок из fromIndex в toIndex (индексы в blocks()) */
    onReorder: (fromIndex: number, toIndex: number) => void;
    /** free: на дропе поставить блок в ячейку (x — колонка, y — строка) */
    onMove?: (id: string, x: number, y: number) => void;
    /** на отпускании ручки ресайза: новый размер блока в единицах сетки */
    onResize: (id: string, w: number, h: number) => void;
    /**
     * Жест начался/закончился. Движку нельзя знать про сигналы, поэтому
     * реактивность строит обёртка: ./solid.ts пишет отсюда в createSignal.
     */
    onActive?: (state: {
        id: string;
        kind: 'move' | 'resize';
    } | null) => void;
};
export type GridEngine = {
    /** ref на контейнер сетки: с него берутся ширина колонки и система координат */
    attachContainer: (el: HTMLElement) => () => void;
    /** ref на блок: регистрация + старт драга (ручка = дочка с [data-drag-handle]) */
    attach: (el: HTMLElement, id: string) => () => void;
    /** ref на ручку ресайза внутри блока */
    attachResize: (el: HTMLElement, id: string) => () => void;
    /** ширина колонки в px по последнему ResizeObserver (0 — ещё не измерено) */
    colWidth: () => number;
    /** id блока под жестом и его вид — для подсветки в UI */
    active: () => {
        id: string;
        kind: 'move' | 'resize';
    } | null;
    destroy: () => void;
};
export declare function createGridEngine(opts: DumbGridOptions): GridEngine;
