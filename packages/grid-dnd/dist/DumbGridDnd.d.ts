import { type JSX } from 'solid-js';
import { type DumbGridDndGroupHandle } from './solid';
import { type SpanValue } from '@solid-dumb-kit/grid';
export type DumbGridDndItem = {
    id: string;
    content: () => JSX.Element;
    /** ширина: число колонок либо доля сетки (`'half'`, `'1/3'`, …) */
    w?: SpanValue;
    /** высота в строках */
    h?: number;
};
export type DumbGridDndProps = {
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
export declare function DumbGridDnd(props: DumbGridDndProps): JSX.Element;
