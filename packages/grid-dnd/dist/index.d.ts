import { JSX } from 'solid-js';
import { Placed, Metrics, SpanValue } from '@solid-dumb-kit/grid';
export { GridSpan, SpanPreset, SpanValue } from '@solid-dumb-kit/grid';

type DndDragging = {
    grid: string;
    id: string;
    w: number;
    h: number;
};
type DndTransferSource = {
    grid: string;
    id: string;
    index: number;
};
type DndTransferTarget = {
    grid: string;
    index: number;
};
type DndGroupOptions = {
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
type DndZoneOptions = {
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
declare function planDrop(args: {
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
type DndZoneEngine = {
    attachContainer: (el: HTMLElement) => () => void;
    attach: (el: HTMLElement, id: string) => () => void;
};
type DndEngine = {
    grid: (name: string, opts: DndZoneOptions) => DndZoneEngine;
    active: () => DndDragging | null;
    over: () => string | null;
    destroy: () => void;
};
declare function createGridDndEngine(opts?: DndGroupOptions): DndEngine;
/** Есть ли нативный DnD вообще (на тач-устройствах его нет). */
declare const dndSupported: () => boolean;
/** формат данных переноса — Pragmatic кладёт свои, этот остаётся для совместимости */
declare const DND_MIME = "application/x-dumb-grid";

type DndActive = DndDragging | null;
type DumbGridDndHandle = {
    /** ref на контейнер сетки */
    container: (el: HTMLElement) => void;
    /** ref на блок — он становится нативно перетаскиваемым */
    bind: (id: string) => (el: HTMLElement) => void;
    /** блок, который тащат из ЭТОЙ сетки */
    active: () => string | null;
};
type DumbGridDndGroupHandle = {
    grid: (name: string, opts: DndZoneOptions) => DumbGridDndHandle;
    /** что тащат сейчас */
    active: () => DndActive;
    /** сетка под указателем — для подсветки приёмника */
    over: () => string | null;
    /** сколько строк займёт сетка, если бросить блок сейчас (0 — жеста нет) */
    rows: (grid: string) => number;
};
declare function createDumbGridDndGroup(opts?: DndGroupOptions): DumbGridDndGroupHandle;

type DumbGridDndItem = {
    id: string;
    content: () => JSX.Element;
    /** ширина: число колонок либо доля сетки (`'half'`, `'1/3'`, …) */
    w?: SpanValue;
    /** высота в строках */
    h?: number;
};
type DumbGridDndProps = {
    items: Array<DumbGridDndItem>;
    cols?: number;
    rowHeight?: number;
    gap?: number;
    /** перестановка внутри этой сетки */
    onReorder?: (from: number, to: number) => void;
    /** перетаскивание выключено — рисуем просто сетку */
    disabled?: boolean;
    /** группа сеток: с ней блок можно утащить в соседнюю сетку */
    group?: DumbGridDndGroupHandle;
    /** имя этой сетки в группе */
    name?: string;
    class?: string;
    style?: JSX.CSSProperties;
    blockClass?: string;
    blockStyle?: JSX.CSSProperties;
};
declare function DumbGridDnd(props: DumbGridDndProps): JSX.Element;

export { DND_MIME, type DndActive, type DndEngine, type DndGroupOptions, type DndTransferSource, type DndTransferTarget, type DndZoneEngine, type DndZoneOptions, DumbGridDnd, type DumbGridDndGroupHandle, type DumbGridDndHandle, type DumbGridDndItem, type DumbGridDndProps, createDumbGridDndGroup, createGridDndEngine, dndSupported, planDrop };
