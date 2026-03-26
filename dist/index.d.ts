import { JSX } from 'solid-js';
import { SelectionEvent, SelectionOptions } from '@viselect/vanilla';
export { SelectionEvent } from '@viselect/vanilla';

type SelectionAreaProps = {
    /** CSS-селектор выбираемых элементов */
    selectables: string;
    /** Вызывается при изменении выделения */
    onSelect?: (e: SelectionEvent) => void;
    /** Вызывается при завершении выделения */
    onStop?: (e: SelectionEvent) => void;
    /** Вызывается перед началом — return false чтобы отменить */
    onBeforeStart?: (e: SelectionEvent) => boolean | void;
    /** Доп. класс контейнера */
    class?: string;
    /** Класс для прямоугольника выделения */
    selectionAreaClass?: string;
    /** Режим пересечения: touch (касание), cover (полное покрытие), center */
    intersect?: 'touch' | 'cover' | 'center';
    /** Доп. настройки поведения */
    behaviour?: Partial<SelectionOptions['behaviour']>;
    /** Доп. настройки фич */
    features?: Partial<SelectionOptions['features']>;
    children: JSX.Element;
};
/**
 * Обёртка над @viselect/vanilla для SolidJS.
 * Рисует прямоугольник выделения при перетаскивании мыши (как в Finder).
 * Shift/Cmd — добавление к выделению.
 *
 * @example
 * ```tsx
 * <SelectionArea
 *   selectables=".file-card"
 *   onSelect={({ store }) => setSelected(new Set(
 *     [...store.stored, ...store.selected].map(el => el.dataset.key!)
 *   ))}
 * >
 *   <div class="grid">
 *     <For each={files()}>
 *       {(f) => <div class="file-card" data-key={f.id}>{f.name}</div>}
 *     </For>
 *   </div>
 * </SelectionArea>
 * ```
 */
declare function SelectionArea(props: SelectionAreaProps): JSX.Element;

type GridPanel = {
    /** Уникальный id панели */
    id: string;
    /** Содержимое — render prop */
    content: () => JSX.Element;
    /** Минимальный размер в px */
    min?: number;
    /** Начальный размер в fr (по умолчанию 1) */
    initial?: number;
};
type ResizableGridProps = {
    /** Колонки (2-3) */
    cols: GridPanel[];
    /** Второй ряд (опционально, 1-3 панелей) */
    rows?: GridPanel[];
    /** Высота первого ряда в fr (по умолчанию 1) */
    rowInitial?: number;
    /** Высота второго ряда в fr (по умолчанию 1) */
    row2Initial?: number;
    /** Мин. высота ряда в px */
    rowMin?: number;
    /** Ключ localStorage для сохранения размеров */
    storageKey: string;
    /** Доп. класс */
    class?: string;
};
declare function ResizableGrid(props: ResizableGridProps): JSX.Element;

export { type GridPanel, ResizableGrid, type ResizableGridProps, SelectionArea, type SelectionAreaProps };
