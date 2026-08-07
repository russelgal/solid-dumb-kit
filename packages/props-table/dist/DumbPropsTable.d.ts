import { type DumpOptions } from './propsDump';
/**
 * Таблица пропсов для отладки: имя, тип, значение — ВСЁ, включая функции.
 *
 * Вложенные объекты (`scale`, `style`) разворачиваются и идут ПЕРВЫМИ: в них
 * обычно и кроется причина «почему не работает», а функции и скаляры видны и
 * так. Массивы (`rows`, `spans`) показываются первыми элементами и счётчиком —
 * дамп двух тысяч броней никому не нужен.
 *
 * Разметка нарочно голая — `table > thead/tbody`, без единого класса кита:
 * это отладочный инструмент, и оформление на нём должно быть потребителя.
 * Готовый класс (`table table-xs` у daisyUI) ложится на неё без обёрток.
 */
export interface DumbPropsTableProps extends DumpOptions {
    /** объект пропсов (или любой другой) */
    value: object;
    /** заголовок над таблицей */
    title?: string;
    class?: string;
    /** отступ на уровень вложенности, px */
    indent?: number;
    /** не рисовать шапку: в узкой панели она только занимает строку */
    headless?: boolean;
}
export declare function DumbPropsTable(props: DumbPropsTableProps): import("solid-js").JSX.Element;
