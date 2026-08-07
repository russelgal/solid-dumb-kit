import { type Metrics, type Placed } from '@solid-dumb-kit/grid';
export type DndDragging = {
    grid: string;
    id: string;
    w: number;
    h: number;
};
export type DndTransferSource = {
    grid: string;
    id: string;
    index: number;
};
export type DndTransferTarget = {
    grid: string;
    index: number;
};
export type DndGroupOptions = {
    /** анимировать расступание; по умолчанию да, но не при prefers-reduced-motion */
    animate?: boolean;
    /** блок переехал в ДРУГУЮ сетку — обе раскладки правит потребитель */
    onTransfer?: (from: DndTransferSource, to: DndTransferTarget) => void;
    /** что тащат сейчас */
    onActive?: (state: DndDragging | null) => void;
    /** над какой сеткой указатель */
    onOver?: (grid: string | null) => void;
    /**
     * Сколько строк займёт сетка, если бросить блок прямо сейчас.
     *
     * Без этого контейнер остаётся прежней высоты: соседи разъезжаются
     * трансформом, а трансформ высоту не меняет. Нижние блоки тогда вылезают за
     * край — и, что хуже, курсор над ними оказывается ВНЕ зоны приёма, так что
     * дроп туда просто не проходит.
     */
    onRows?: (grid: string, rows: number) => void;
};
export type DndZoneOptions = {
    order: () => Array<string>;
    spanOf: (id: string) => {
        w: number;
        h: number;
    };
    cols: () => number;
    rowHeight: () => number;
    gapX: () => number;
    gapY: () => number;
    disabled?: () => boolean;
    accepts?: (from: string) => boolean;
    onReorder?: (from: number, to: number) => void;
};
/**
 * Куда встанет блок и как для этого разъезжаются соседи — вся решающая часть,
 * без DOM и событий. Вынесена наружу, чтобы проверяться тестами напрямую:
 * жест руками не воспроизвести, а вот арифметику — сколько угодно.
 */
export declare function planDrop(args: {
    /** порядок и размеры блоков сетки-приёмника */
    spans: Array<{
        id: string;
        w: number;
        h: number;
    }>;
    /**
     * Раскладка, по которой считать пороги, — та, что сейчас видна. Не задана —
     * берём укладку самих spans (первый заход в сетку).
     */
    base?: Array<Placed>;
    m: Metrics;
    /** указатель в координатах контента сетки */
    x: number;
    y: number;
    /** блок гостя: id, размер и индекс, если он из ЭТОЙ же сетки */
    drag: {
        id: string;
        w: number;
        h: number;
        fromIndex: number | null;
    };
}): {
    index: number;
    next: Array<Placed>;
    moves: Array<{
        id: string;
        dx: number;
        dy: number;
    }>;
    rect: {
        x: number;
        y: number;
        width: number;
        height: number;
    } | null;
};
export type DndZoneEngine = {
    attachContainer: (el: HTMLElement) => () => void;
    attach: (el: HTMLElement, id: string) => () => void;
};
export type DndEngine = {
    grid: (name: string, opts: DndZoneOptions) => DndZoneEngine;
    active: () => DndDragging | null;
    over: () => string | null;
    destroy: () => void;
};
export declare function createGridDndEngine(opts?: DndGroupOptions): DndEngine;
/** Есть ли нативный DnD вообще (на тач-устройствах его нет). */
export declare const dndSupported: () => boolean;
/** формат данных переноса — Pragmatic кладёт свои, этот остаётся для совместимости */
export declare const DND_MIME = "application/x-dumb-grid";
