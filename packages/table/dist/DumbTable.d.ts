import { type JSX } from 'solid-js';
export type DumbColumn<T> = {
    /** ключ колонки: id для сортировки и путь к значению по умолчанию */
    key: string;
    /** содержимое `<th>` */
    label?: JSX.Element;
    /** разрешить сортировку по этой колонке */
    sortable?: boolean;
    /** класс на `<th>` и `<td>` */
    class?: string;
    /** класс только на `<th>` */
    headClass?: string;
    /** выравнивание содержимого */
    align?: 'left' | 'center' | 'right';
    /** ширина колонки (CSS-значение, напр. '80px' или '12%') */
    width?: string;
    /** не пускать клик по ячейке в onRowClick (для кнопок/инпутов внутри) */
    stopClick?: boolean;
    /** содержимое `<td>`; по умолчанию — значение по `key` */
    render?: (row: T, index: number) => JSX.Element;
    /** значение для сортировки; по умолчанию — `row[key]` */
    value?: (row: T) => unknown;
};
export type DumbTableProps<T> = {
    rows: Array<T>;
    columns: Array<DumbColumn<T>>;
    /** стабильный id строки (нужен перетаскиванию); по умолчанию — индекс */
    rowId?: (row: T, index: number) => string;
    /** активная колонка сортировки — задаёт СЕРВЕРНЫЙ режим (вместе с onSort) */
    sort?: string;
    order?: 'asc' | 'desc';
    /**
     * Есть onSort → сортирует сервер (manualSorting); нет → сортируем на клиенте.
     * Третий клик по колонке сбрасывает сортировку — тогда придёт (null, null).
     */
    onSort?: (key: string | null, order: 'asc' | 'desc' | null) => void;
    /** убрать третий клик-сброс: сортировка будет только asc ⇄ desc */
    noSortRemoval?: boolean;
    /**
     * Анимировать смену сортировки через View Transitions.
     * Смысл только в клиентском режиме: там состояние меняется внутри таблицы и
     * снаружи его не обернуть. В серверном режиме оборачивай сам — данные всё
     * равно приходят от тебя. Строкам нужен уникальный `view-transition-name`
     * (см. `rowStyle`), иначе браузер сделает кроссфейд всей таблицы.
     */
    viewTransition?: boolean;
    /** анимировать перетаскивание строк; по умолчанию да, но не при prefers-reduced-motion */
    animate?: boolean;
    /**
     * Направление ПЕРВОГО клика по заголовку. По умолчанию — как у TanStack:
     * текстовые колонки начинают с asc, числовые с desc. `false` заставляет
     * все колонки начинать с asc, `true` — с desc.
     */
    sortDescFirst?: boolean;
    /** включает перетаскивание строк за ручку; индексы — в текущем показанном порядке */
    onReorder?: (from: number, to: number) => void;
    /**
     * Содержимое ручки перетаскивания. `false` — ручки нет вовсе, строка тянется
     * целиком; тогда стоит задать `dragThreshold`, иначе клик по строке и начало
     * драга неотличимы (а поверх таблицы ещё может быть выделение рамкой).
     */
    handle?: JSX.Element | false;
    /** сколько px пройти мышью до старта драга (по умолчанию 0 — сразу) */
    dragThreshold?: number;
    onRowClick?: (row: T, index: number) => void;
    /** приглушить таблицу на время загрузки */
    loading?: boolean;
    /** показывается вместо таблицы, когда строк нет */
    empty?: JSX.Element;
    class?: string;
    tableClass?: string;
    headClass?: string;
    rowClass?: (row: T, index: number) => string | undefined;
    /** стиль на строку — например уникальный `view-transition-name` */
    rowStyle?: (row: T, index: number) => JSX.CSSProperties | undefined;
    /** содержимое `<tfoot>` */
    footer?: JSX.Element;
    /**
     * Распорки для виртуализации: сколько пикселей «съедено» строками выше и ниже
     * окна. Само окно режешь снаружи — как и страницу, таблица рисует что дали.
     * Перетаскивание при этом лучше выключать: снимок позиций делается один раз,
     * а строки за пределами окна в DOM просто отсутствуют.
     */
    spacerTop?: number;
    spacerBottom?: number;
};
export declare function DumbTable<T>(props: DumbTableProps<T>): JSX.Element;
