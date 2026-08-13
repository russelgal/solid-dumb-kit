import { type DumbSortableOptions } from './sortableCore';
import { type SortableGroupOptions, type SortableListOptions } from './sortableGroup';
export type DumbSortableHandle = {
    /** самодостаточный ref на элемент (ручка = дочка с [data-drag-handle]) */
    bind: (id: string) => (el: HTMLElement) => void;
    /** низкоуровневый ref на элемент-ячейку */
    row: (id: string) => (el: HTMLElement) => void;
    /** низкоуровневый ref на ручку-хендл */
    handle: (id: string) => (el: HTMLElement) => void;
    /**
     * Старт драга для JSX: `ref={s.row(id)} onPointerDown={s.press(id)}`.
     *
     * Это и есть путь без своих слушателей: `pointerdown` у Solid делегирован —
     * один слушатель на документ вместо слушателя на каждой строке. На тысяче
     * строк разница в монтировании невелика, на двадцати тысячах — уже единицы
     * миллисекунд, и столько же на снятии.
     *
     * `bind` (самодостаточный ref со своим `addEventListener`) остаётся: движок
     * зовут и без Solid, а там JSX взять неоткуда.
     */
    press: (id: string) => (ev: PointerEvent) => void;
    /** то же для ручки, которая не лежит внутри ячейки */
    pressHandle: (id: string) => (ev: PointerEvent) => void;
};
export declare function createDumbSortable(opts: DumbSortableOptions): DumbSortableHandle;
export type SortableListHandle = {
    /** ref на контейнер зоны */
    container: (el: HTMLElement) => void;
    /** ref на элемент зоны (ручка = дочка с [data-drag-handle]) */
    bind: (id: string) => (el: HTMLElement) => void;
    /** ref на карточку без слушателя — в паре с press */
    card: (id: string) => (el: HTMLElement) => void;
    /** старт драга для JSX: `onPointerDown={l.press(id)}` */
    press: (id: string) => (ev: PointerEvent) => void;
};
export type SortableGroupHandle = {
    /** зарегистрировать зону */
    list: (name: string, opts: SortableListOptions) => SortableListHandle;
    /** имя зоны под указателем во время драга (для подсветки), иначе null */
    activeList: () => string | null;
    /** id перетаскиваемого элемента, иначе null */
    draggingId: () => string | null;
};
export declare function createSortableGroup(opts: SortableGroupOptions): SortableGroupHandle;
