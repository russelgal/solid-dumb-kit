import * as solid_js from 'solid-js';

/**
 * Разбор объекта пропсов в плоский список строк для отладочной таблицы.
 *
 * Чистый TS без Solid: это же нужно и в тестах, и в логе, и на сервере.
 *
 * Зачем вообще: `JSON.stringify(props)` для отладки не годится — он МОЛЧА
 * выбрасывает функции и `undefined`, а у компонентов вроде шахматки почти всё
 * поведение и есть функции (`onOpen`, `spanClass`, `dayClass`). В дампе их
 * просто не было, и выглядело это как «проп не пришёл».
 */
type DumpKind = 'object' | 'array' | 'function' | 'primitive';
interface DumpRow {
    /** ключ на своём уровне: `scale`, `stepMin` */
    key: string;
    /** полный путь от корня: `scale.stepMin` */
    path: string;
    /** глубина вложенности, 0 — верхний уровень */
    depth: number;
    /** `typeof` значения */
    type: string;
    kind: DumpKind;
    /** короткое человекочитаемое представление */
    value: string;
    /** сырое значение — вдруг вызывающему нужно больше */
    raw: unknown;
}
/** `ƒ apply(3)`, `Array(2133)`, `{first, days, …}`, `"текст"` */
declare function describe(v: unknown): string;
interface DumpOptions {
    /** насколько глубоко разворачивать вложенные объекты; 0 — не разворачивать */
    depth?: number;
    /** сколько элементов массива показывать; остальные схлопываются в «…» */
    maxItems?: number;
    /** не раскрывать эти ключи верхнего уровня: `rows`, `spans` — там тысячи строк */
    skip?: string[];
}
/**
 * Плоский список строк с сохранением порядка «родитель → его дети».
 *
 * Ключи берутся с самого объекта: Solid объявляет пропсы перечислимыми
 * геттерами, поэтому `Object.keys` их видит, а чтение — обычное обращение к
 * свойству (то есть подписка на реактивность; для отладочной панели это норма,
 * в боевом коде так делать нельзя).
 */
declare function dumpProps(source: object, options?: DumpOptions): DumpRow[];

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
interface DumbPropsTableProps extends DumpOptions {
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
declare function DumbPropsTable(props: DumbPropsTableProps): solid_js.JSX.Element;

export { DumbPropsTable, type DumbPropsTableProps, type DumpKind, type DumpOptions, type DumpRow, describe, dumpProps };
