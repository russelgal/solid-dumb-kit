import * as solid_js from 'solid-js';
import { JSX } from 'solid-js';

/** Как элемент попадает в выделение */
type IntersectMode = 
/** рамка коснулась элемента */
'touch'
/** рамка накрыла элемент целиком */
 | 'cover'
/** рамка накрыла центр элемента */
 | 'center';

type SelectionAreaProps = {
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
declare function SelectionArea(props: SelectionAreaProps): JSX.Element;

type SelectionCoreOptions = {
    /** контейнер: и область жеста, и (обычно) скроллер */
    container: () => HTMLElement | null;
    /** CSS-селектор выбираемых элементов */
    selectables: string;
    /** атрибут-ключ элемента (по умолчанию data-key) */
    keyAttr?: string;
    /** режим попадания в рамку */
    intersect?: () => IntersectMode;
    /** выделение изменилось (в процессе жеста и по его окончании) */
    onChange: (selected: Set<string>, info: {
        added: string[];
        removed: string[];
    }) => void;
    /** жест завершён */
    onStop?: (selected: Set<string>) => void;
    /** старт запрещён (вернуть false) */
    onBeforeStart?: (ev: PointerEvent) => boolean | void;
    /** выделение на момент старта жеста */
    current: () => Set<string>;
    /** сколько px пройти до старта рамки */
    threshold?: number;
    /** класс на прямоугольник рамки */
    areaClass?: string;
};

declare function createSelectionArea(opts: SelectionCoreOptions): {
    /** повесить жест на контейнер */
    attach(el: HTMLElement): void;
};

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

type DumbSortableProps<T> = {
    items: Array<T>;
    /** позвать с новым порядком (на дропе) */
    setItems: (next: Array<T>) => void;
    /** стабильный id элемента */
    id: (item: T) => string;
    axis?: 'y' | 'grid';
    disabled?: () => boolean;
    pressDelay?: number;
    mousePressDelay?: number;
    mouseThreshold?: number;
    /** анимировать перестановку; по умолчанию да, но не при prefers-reduced-motion */
    animate?: boolean;
    /** ВЕРНИ один корневой элемент — компонент привяжется прямо к нему */
    children: (item: T, index: () => number) => JSX.Element;
};
declare function DumbSortable<T>(props: DumbSortableProps<T>): JSX.Element;

type DumbSortableOptions = {
    /** текущий визуальный порядок id (совпадает с порядком data) */
    order: () => string[];
    /** 'y' — вертикальный список (по умолчанию), 'grid' — двумерная сетка */
    axis?: 'y' | 'grid';
    /** drag запрещён (напр. активна сортировка колонки) */
    disabled?: () => boolean;
    /** тач: удержание до старта драга, мс (0 = сразу). По умолчанию 350 */
    pressDelay?: number;
    /** мышь: long-press до старта, мс (0 = выкл). Имеет приоритет над mouseThreshold */
    mousePressDelay?: number;
    /** мышь: дистанция до старта драга, px (0 = сразу, как было). По умолчанию 0 */
    mouseThreshold?: number;
    /**
     * Анимировать расступание соседей и приземление на дропе.
     * По умолчанию да, но при системном `prefers-reduced-motion: reduce` —
     * нет. Явное `true` перебивает и системную настройку.
     */
    animate?: boolean;
    /** на дропе: переставить из fromIndex в toIndex (индексы в order()) */
    onEnd: (fromIndex: number, toIndex: number) => void;
};

type SortableGroupOptions = {
    /** перенос завершён: откуда (зона+индекс) и куда */
    onEnd: (from: {
        list: string;
        index: number;
    }, to: {
        list: string;
        index: number;
    }) => void;
    /** запретить драг целиком */
    disabled?: () => boolean;
    /** тач: удержание до старта драга, мс. По умолчанию 350 */
    pressDelay?: number;
    /** мышь: long-press до старта, мс (0 = выкл) */
    mousePressDelay?: number;
    /** мышь: дистанция до старта драга, px (0 = сразу) */
    mouseThreshold?: number;
    /**
     * Анимировать расступание карточек и приземление клона.
     * По умолчанию да, но при системном `prefers-reduced-motion: reduce` — нет.
     */
    animate?: boolean;
};
type SortableListOptions = {
    /** визуальный порядок id внутри этой зоны */
    order: () => string[];
    /** принимать ли элемент из зоны `from` (по умолчанию принимает всех) */
    accepts?: (from: string) => boolean;
};

type DumbSortableHandle = {
    /** самодостаточный ref на элемент (ручка = дочка с [data-drag-handle]) */
    bind: (id: string) => (el: HTMLElement) => void;
    /** низкоуровневый ref на элемент-ячейку */
    row: (id: string) => (el: HTMLElement) => void;
    /** низкоуровневый ref на ручку-хендл */
    handle: (id: string) => (el: HTMLElement) => void;
};
declare function createDumbSortable(opts: DumbSortableOptions): DumbSortableHandle;
type SortableListHandle = {
    /** ref на контейнер зоны */
    container: (el: HTMLElement) => void;
    /** ref на элемент зоны (ручка = дочка с [data-drag-handle]) */
    bind: (id: string) => (el: HTMLElement) => void;
};
type SortableGroupHandle = {
    /** зарегистрировать зону */
    list: (name: string, opts: SortableListOptions) => SortableListHandle;
    /** имя зоны под указателем во время драга (для подсветки), иначе null */
    activeList: () => string | null;
    /** id перетаскиваемого элемента, иначе null */
    draggingId: () => string | null;
};
declare function createSortableGroup(opts: SortableGroupOptions): SortableGroupHandle;

type DumbTreeNode = {
    id: number | string;
    parent: number | string;
    title: string;
    /** порядок среди соседей (для сортировки «по индексу») */
    index?: number;
    /** доп. строка для поиска/тултипа (бренд категории и т.п.) */
    meta?: string | null;
};
type Id = number | string;
type DumbTreeIcons = {
    /** папка свёрнута */
    folder: string;
    /** папка раскрыта */
    folderOpen: string;
    /** лист (flat-режим / узел без детей) */
    leaf: string;
    /** стрелка раскрытой папки */
    expanded: string;
    /** стрелка свёрнутой папки */
    collapsed: string;
    search: string;
    sortIndex: string;
    sortName: string;
    dragHandle: string;
};
type DumbTreeLabels = Partial<{
    search: string;
    sortIndex: string;
    sortName: string;
}>;
type DumbTreeProps<T extends DumbTreeNode> = {
    /** плоский массив узлов (иерархия по parent). undefined → спиннер загрузки */
    nodes?: Array<T>;
    /** заголовок сайдбара */
    title?: string;
    /** активный (выбранный) id — реактивный аксессор */
    activeId?: () => Id | null | undefined;
    /** клик по строке */
    onSelect?: (id: T['id'], node: T) => void;
    /** плоский список без иерархии/сворачивания */
    flat?: boolean;
    /** скрыть поле поиска */
    hideSearch?: boolean;
    placeholder?: string;
    /** свой матчер поиска (по умолчанию fuzzy по title/meta/id) */
    match?: (node: T, query: string) => boolean;
    /** скрыть тоггл сортировки и держать порядок строго по index */
    hideSort?: boolean;
    /** локаль для сравнения названий (по умолчанию — браузерная) */
    locale?: string;
    /** ключ localStorage для раскрытых папок и режима сортировки */
    storageKey?: string;
    /** drag-reorder flat-списка: переставить from→to в порядке отображения */
    sortable?: (from: number, to: number) => void;
    /** анимировать перестановку; по умолчанию да, но не при prefers-reduced-motion */
    animate?: boolean;
    /** доп. контент справа в строке (бейджи/иконки статуса) */
    rowExtra?: (node: T) => JSX.Element;
    /** доп. класс на строку-ссылку (напр. opacity-50 для скрытых) */
    rowClass?: (node: T) => string | undefined;
    /** доп. класс на текст строки (напр. line-through) */
    titleClass?: (node: T) => string | undefined;
    /** свой tooltip строки (по умолчанию «title · meta · id N») */
    rowTitle?: (node: T) => string;
    /** доп. класс на корневой <aside> */
    class?: string;
    /** классы иконок (обязательно — кит не несёт свой набор) */
    icons: DumbTreeIcons;
    labels?: DumbTreeLabels;
};
declare function DumbTree<T extends DumbTreeNode>(props: DumbTreeProps<T>): JSX.Element;

type DumbColumn<T> = {
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
type DumbTableProps<T> = {
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
declare function DumbTable<T>(props: DumbTableProps<T>): JSX.Element;

type DumbPaginationProps = {
    page: number;
    total: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    /** показывает переключатель размера страницы */
    pageSizes?: Array<number>;
    onPageSizeChange?: (size: number) => void;
    /** подпись слева; по умолчанию «total · page/pages» */
    summary?: (info: {
        page: number;
        pages: number;
        total: number;
    }) => string;
    class?: string;
    buttonClass?: string;
    activeClass?: string;
};
declare function buildPageNumbers(current: number, total: number): Array<number | '…'>;
declare function DumbPagination(props: DumbPaginationProps): solid_js.JSX.Element;

type VirtualWindow = {
    /** видимое окно: [first, last) */
    first: number;
    last: number;
    /** высота строк выше и ниже окна — распорки */
    padTop: number;
    padBottom: number;
    /** полная высота контента */
    total: number;
};

type VirtualOptions = {
    /** ключи ВСЕХ строк набора, в текущем порядке */
    keys: () => Array<string>;
    /** высота строки, пока её не измерили */
    estimate?: number;
    /** сколько строк рисовать про запас */
    overscan?: number;
    /** атрибут, по которому строки находятся в DOM */
    keyAttr?: string;
    /** окно пересчитано — перерисуй */
    onChange: (win: VirtualWindow) => void;
};
type VirtualEngine = {
    attach: (scroller: HTMLElement) => () => void;
    /** пересчитать (после смены данных или сортировки) */
    refresh: () => void;
    /** снять высоты отрисованных строк — звать после перерисовки окна */
    measure: () => void;
    window: () => VirtualWindow;
    destroy: () => void;
};
declare function createVirtualEngine(opts: VirtualOptions): VirtualEngine;

declare function createVirtual(opts: Omit<VirtualOptions, 'onChange'>): {
    /** ref на прокручиваемый контейнер */
    scroller: (el: HTMLElement) => () => void;
    /** индексы окна и распорки */
    window: solid_js.Accessor<VirtualWindow>;
    /** пересчитать после смены данных */
    refresh: () => void;
    /** снять высоты отрисованных строк */
    measure: () => void;
};

type Numeric = number | string | null | undefined;
/** 1 234,56 ₽ */
declare function RubR2(v: Numeric): string;
/** 1 234,56 */
declare function Rub2(v: Numeric): string;
/** 1 235 */
declare function Rub0(v: Numeric): string;
/** 1 235 ₽ */
declare function Rub0R(v: Numeric): string;
/** 1 234,5678 */
declare function Rub4(v: Numeric): string;
/** 1 234 или — */
declare function fmtNum(v: Numeric): string;
/** 1 234,56 ₽ или — */
declare function fmtPrice(v: Numeric): string;
type DateInput = string | number | Date | null | undefined;
/** 23.02.2026, 16:40:22 */
declare function fmtDateTime(v: DateInput): string;
/** 23.02.2026, 16:40 */
declare function fmtDateTimeShort(v: DateInput): string;
/** 23.02.2026 */
declare function fmtDate(v: DateInput): string;
/** 16:40:22 */
declare function fmtTime(v: DateInput): string;
/** 23 февр. 2026 г. */
declare function fmtDateMonth(v: DateInput): string;
/** 512 Б / 24 КБ / 1.3 МБ */
declare function fmtSize(bytes: number): string;
/** "2 ч. назад", "3 дн. назад" или — */
declare function timeAgo(v: DateInput): string;

declare const genSlug: (name: string) => string;

/** Извлечь изображения из ZIP-архива, вернуть как FileList */
declare function extractImagesFromZip(zipFile: File): Promise<FileList>;

/**
 * imgproxy URL builder — чистая функция без зависимостей от SolidJS/DOM.
 *
 * URL: /insecure/{processing_options}/{base64url(source)}.{ext}
 * Подпись здесь не реализована — для прода либо включайте /insecure/
 * в imgproxy, либо подписывайте на сервере и передавайте готовый URL.
 */
type ImgFit = 'fit' | 'fill' | 'fill-down' | 'force' | 'auto';
type ImgGravity = 'no' | 'so' | 'ea' | 'we' | 'noea' | 'nowe' | 'soea' | 'sowe' | 'ce' | 'sm' | 'fp';
type ImgFormat = 'jpg' | 'png' | 'webp' | 'avif' | 'gif' | 'ico' | 'svg' | 'tiff';
type ImgproxyOps = {
    w?: number;
    h?: number;
    fit?: ImgFit;
    q?: number;
    format?: ImgFormat;
    gravity?: ImgGravity;
    enlarge?: boolean;
    extend?: boolean;
    dpr?: number;
    blur?: number;
    sharpen?: number;
    bg?: string;
    padding?: number | [number, number, number, number];
    preset?: string | string[];
};
type ImgproxyConfig = {
    /** База imgproxy, напр. https://img.example.com. Не задана → imgproxyUrl вернёт src как есть */
    baseUrl?: string;
    /** S3-бакет для конвертации /media/... → s3://bucket/... Не задан → конвертации нет */
    bucket?: string;
    /** Публичный http-эндпоинт того же бакета — тоже конвертируется в s3:// */
    webEndpoint?: string;
};
/**
 * Явно задать настройки imgproxy (перебивают переменные окружения).
 * Вызывать один раз на старте приложения.
 */
declare function configureImgproxy(c: ImgproxyConfig): void;
/**
 * Строит imgproxy URL из src.
 *
 * Конвертация source (только если задан бакет):
 *   /media/sites/1/...              → s3://{bucket}/sites/1/...
 *   http://{webEndpoint}/path       → s3://{bucket}/path
 *   http://...                      → как есть
 *
 * Настройки берутся из configureImgproxy(), иначе из переменных окружения
 * VITE_IMGPROXY_URL / VITE_S3_BUCKET / VITE_S3_WEB_ENDPOINT.
 * Если база не задана — возвращает оригинальный src (graceful fallback).
 */
declare function imgproxyUrl(src: string, opts?: ImgproxyOps): string;

export { type DumbColumn, DumbPagination, type DumbPaginationProps, DumbSortable, type DumbSortableHandle, type DumbSortableOptions, type DumbSortableProps, DumbTable, type DumbTableProps, DumbTree, type DumbTreeIcons, type DumbTreeLabels, type DumbTreeNode, type DumbTreeProps, type GridPanel, type ImgFit, type ImgFormat, type ImgGravity, type ImgproxyConfig, type ImgproxyOps, type IntersectMode, ResizableGrid, type ResizableGridProps, Rub0, Rub0R, Rub2, Rub4, RubR2, SelectionArea, type SelectionAreaProps, type SelectionCoreOptions, type SortableGroupHandle, type SortableGroupOptions, type SortableListHandle, type SortableListOptions, type VirtualEngine, type VirtualOptions, type VirtualWindow, buildPageNumbers, configureImgproxy, createDumbSortable, createSelectionArea, createSortableGroup, createVirtual, createVirtualEngine, extractImagesFromZip, fmtDate, fmtDateMonth, fmtDateTime, fmtDateTimeShort, fmtNum, fmtPrice, fmtSize, fmtTime, genSlug, imgproxyUrl, timeAgo };
