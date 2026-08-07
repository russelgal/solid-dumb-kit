import { type JSX } from 'solid-js';
import type { IntersectMode } from './selectionMath';
export type { IntersectMode };
export type SelectionAreaProps = {
    /** CSS-селектор выбираемых элементов */
    selectables: string;
    /** текущее выделение (ключи элементов) — состояние держит потребитель */
    selected: () => Set<string>;
    /** выделение изменилось */
    onChange: (selected: Set<string>) => void;
    /** жест завершён */
    onStop?: (selected: Set<string>) => void;
    /** старт запрещён — вернуть false */
    onBeforeStart?: (ev: PointerEvent) => boolean | void;
    /** атрибут-ключ элемента. По умолчанию `data-key` */
    keyAttr?: string;
    /** режим попадания: касание рамкой / полное покрытие / центр */
    intersect?: IntersectMode;
    /** сколько px пройти до появления рамки. По умолчанию 10 */
    threshold?: number;
    /** класс прямоугольника рамки (структурные стили и так инлайном) */
    areaClass?: string;
    /** доп. класс контейнера */
    class?: string;
    /** стили контейнера: если список прокручивается — overflow вешать сюда */
    style?: JSX.CSSProperties;
    children: JSX.Element;
};
/**
 * Выделение рамкой «как в Finder»: тянешь мышью — выделяется всё, чего коснулась
 * рамка. Shift/Cmd/Ctrl — добавить к выделению (повторное касание снимает).
 *
 * Без зависимостей и без reflow: позиции элементов снимаются один раз на старте
 * жеста через IntersectionObserver, дальше в кадре только арифметика.
 *
 * @example
 * ```tsx
 * const [sel, setSel] = createSignal<Set<string>>(new Set())
 *
 * <SelectionArea selectables=".card" selected={sel} onChange={setSel}
 *                style={{ 'max-height': '60vh', 'overflow-y': 'auto' }}>
 *   <For each={files()}>
 *     {(f) => <div class="card" data-key={f.id} classList={{ on: sel().has(f.id) }} />}
 *   </For>
 * </SelectionArea>
 * ```
 */
export declare function SelectionArea(props: SelectionAreaProps): JSX.Element;
