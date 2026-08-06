declare function prefersReducedMotion(): boolean;
/** анимировать ли: undefined → да, но с оглядкой на системную настройку */
declare function shouldAnimate(explicit?: boolean): boolean;

/** `solid.batch`, где он есть (Solid 1); в Solid 2 обновления батчатся сами */
declare const batch: <T>(fn: () => T) => T;
/** `onMount` из Solid 1: эффект, выполненный один раз после монтирования */
declare function onMounted(fn: () => void): void;
/**
 * `createEffect(on(dep, fn, { defer: true }))` из Solid 1: следим за ОДНИМ
 * источником, тело не трекается; `defer` пропускает первый прогон.
 */
declare function watch<T>(dep: () => T, fn: (value: T, prev: T | undefined) => void, opts?: {
    defer?: boolean;
}): void;

/**
 * Вставить стили один раз на документ.
 *
 * @param id  ключ, он же `data-dumb-kit` у тега — по нему видно в инспекторе,
 *            кто это положил, и по нему же ищется уже вставленное
 * @param css  сами правила
 */
declare function injectStyle(id: string, css: string): void;

type StableOrder<T> = {
    /**
     * Отсортировать по порядку появления; новые получают номер тут же, за
     * исчезнувшими прибирается. Отдавать сюда надо ВЕСЬ список: по подмножеству
     * уборка выбросит тех, кого в нём просто не было, и при следующем вызове они
     * получат новые номера — порядок поедет на ровном месте.
     */
    sort: (items: Array<T>) => Array<T>;
    /** номер элемента — чтобы отсортировать подмножество, не трогая карту */
    rank: (item: T) => number;
};
/**
 * @param id как достать стабильный id элемента
 */
declare function createStableOrder<T>(id: (item: T) => string): StableOrder<T>;

type Flip = {
    /** отправить элемент на смещение (dx, dy) от его места в потоке */
    to: (el: HTMLElement, dx: number, dy: number) => void;
    /**
     * Элемент УЖЕ переехал (переставили DOM, сменили `order`, изменилась
     * раскладка) — доиграть переезд: стартовать со смещения (dx, dy), то есть со
     * старого места, и приехать в ноль. Классический FLIP: Invert + Play.
     */
    nudge: (el: HTMLElement, dx: number, dy: number) => void;
    /** снять всё разом — на завершении жеста */
    clear: () => void;
};
declare function createFlip(animate: boolean): Flip;

type AutoScroller = {
    /** снять цепочку прокручиваемых уровней от элемента вверх (на старте жеста) */
    start: (el: HTMLElement) => void;
    /** последняя известная позиция курсора */
    move: (x: number, y: number) => void;
    stop: () => void;
};
declare function createAutoScroller(): AutoScroller;

/** снятая на старте геометрия скроллера (живыми остаются только scrollTop/Left) */
type ViewGeom = {
    /** позиция скроллера во вьюпорте на момент старта */
    top: number;
    left: number;
    clientH: number;
    clientW: number;
    /** предел прокрутки на старте */
    max: number;
    /** полный размер содержимого (scrollWidth/scrollHeight) */
    scrollW: number;
    scrollH: number;
    /** скролл окна на момент старта — по нему компенсируем сдвиг контейнера */
    winX: number;
    winY: number;
};
declare const EDGE = 48;
declare const MAX_SPEED = 18;
declare const ACCEL = 3.5;
/** ближайший прокручиваемый предок (включая сам элемент) */
declare function scrollParent(el: HTMLElement, includeSelf?: boolean): HTMLElement | null;
/** Единственное синхронное чтение геометрии — один раз на старте жеста. */
declare function measure(scroller: HTMLElement | null): ViewGeom;
/** Живой скролл — дешёвое чтение, layout не форсит. */
declare function scrollOf(scroller: HTMLElement | null): {
    sx: number;
    sy: number;
};
declare function doScroll(scroller: HTMLElement | null, dx: number, dy: number): void;
/**
 * Позиция скроллера во вьюпорте СЕЙЧАС: снятая на старте, сдвинутая на то,
 * насколько с тех пор прокрутилось окно. Так покадровый getBoundingClientRect
 * (forced layout!) заменяется на чтение window.scrollX/Y.
 */
declare function viewOrigin(geom: ViewGeom, winX: number, winY: number): {
    top: number;
    left: number;
};
/**
 * Скорость авто-скролла: чем дальше указатель за краем контейнера, тем быстрее
 * (до ACCEL× потолка). 0 — если указатель не в краевой зоне либо скроллить некуда.
 */
declare function autoScrollSpeed(args: {
    pointerY: number;
    viewTop: number;
    clientH: number;
    scrollY: number;
    scrollMax: number;
}): number;

declare function suppressTextSelection(): void;
declare function restoreTextSelection(): void;

/** с чего жест не начинается, когда тянут за весь элемент, а не за ручку */
declare const NO_DRAG = "input, textarea, select, option, button, a, label, [contenteditable=\"\"], [contenteditable=\"true\"], [data-no-drag]";
declare function targetIsInteractive(ev: PointerEvent): boolean;
/** внутри элемента что-то в фокусе (значит его редактируют, а не двигают) */
declare function focusInside(el: HTMLElement): boolean;
declare const LONGPRESS = 350;
declare const MOVE_TOL = 10;
type PressGateOptions = {
    /** тач: удержание до старта, мс (0 = сразу). По умолчанию 350 */
    pressDelay?: number;
    /** мышь: long-press до старта, мс (0 = выкл). Приоритетнее mouseThreshold */
    mousePressDelay?: number;
    /** мышь: дистанция до старта, px (0 = сразу) */
    mouseThreshold?: number;
};
type PressGate = {
    /**
     * Принять pointerdown. `start` позовётся, когда условие старта выполнено:
     * сразу, после удержания или после сдвига на порог.
     */
    arm: (ev: PointerEvent, start: (x: number, y: number) => void) => void;
    /** ждём ли мы сейчас старта (чтобы не начать второй жест поверх) */
    pending: () => boolean;
    cancel: () => void;
};
/**
 * Калитка старта жеста: на тач-устройстве ждём удержания (иначе палец не сможет
 * прокрутить страницу), мышью — сразу либо после порога-дистанции.
 */
declare function createPressGate(opts?: PressGateOptions): PressGate;

/** чем заливаем: своё дело потребителя, галерея транспорт не выбирает */
type Uploader = (file: File, ctx: {
    /** 0…1; зовётся часто, дёргать состояние на каждый вызов не стоит */
    onProgress: (fraction: number) => void;
    /** отменили — брось запрос */
    signal: AbortSignal;
}) => Promise<UploadResult>;
type UploadResult = {
    /** чем показывать картинку после заливки */
    url: string;
    /** ключ в хранилище — если он нужен потребителю для удаления */
    key?: string;
};
type QueueEvents = {
    /**
     * Заливка ФАКТИЧЕСКИ началась, а не просто встала в очередь.
     *
     * Без этого события все поставленные файлы показывались бы «идущими», из
     * которых реально едет только часть, — то самое враньё, ради которого
     * очередь и заводилась.
     */
    onStart?: (id: string) => void;
    onProgress?: (id: string, fraction: number) => void;
    onDone?: (id: string, result: UploadResult) => void;
    onError?: (id: string, message: string) => void;
};
type UploadQueue = {
    /** поставить файл в очередь; id — тот же, что у элемента галереи */
    add: (id: string, file: File) => void;
    /** снять с очереди: ждущего выбросить, идущего прервать */
    cancel: (id: string) => void;
    /** снять всё разом — на размонтировании */
    destroy: () => void;
    /** сколько ещё не доехало: и в работе, и в ожидании */
    pending: () => number;
};
declare function createUploadQueue(upload: Uploader, events?: QueueEvents, 
/** сколько тянуть одновременно; больше шести смысла не имеет */
concurrency?: number): UploadQueue;

/** Что должен вернуть твой сервер на просьбу подписать */
type Presigned = {
    /** куда класть — подписанная ссылка */
    url: string;
    /** каким методом; по умолчанию PUT */
    method?: 'PUT' | 'POST';
    /** заголовки, вошедшие в подпись: их обязательно повторить один в один */
    headers?: Record<string, string>;
    /** ключ объекта в бакете — вернётся потребителю как есть */
    key?: string;
    /** по какому адресу файл будет виден потом; не задан — берём `url` без query */
    publicUrl?: string;
};
type PresignedOptions = {
    /**
     * Спросить у своего сервера подпись. Единственное место, где галерея ходит
     * наружу за чем-то, кроме самого файла.
     */
    sign: (file: File) => Promise<Presigned>;
};
/**
 * Транспорт для `DumbGallery`: спрашивает подпись, кладёт файл по ней,
 * отдаёт публичный адрес.
 */
declare function createPresignedUploader(opts: PresignedOptions): Uploader;
/**
 * Положить файл по подписанной ссылке, показывая прогресс. Отдельно от
 * `createPresignedUploader`, потому что подпись просят по-разному: галерее
 * хватает файла, файндеру нужен ещё и префикс, куда класть.
 */
declare function putWithProgress(file: File, p: Presigned, ctx: {
    onProgress: (f: number) => void;
    signal: AbortSignal;
}): Promise<UploadResult>;

type VirtualRange = {
    /** первый индекс, который надо нарисовать */
    start: number;
    /** последний + 1 */
    end: number;
    /** насколько сдвинуть нарисованное вдоль оси (вниз или вправо), px */
    offset: number;
    /** размер распорки, px — НЕ всегда `rows * itemSize`, см. `MAX_SCROLL_HEIGHT` */
    total: number;
};
/**
 * Потолок высоты элемента, за которым браузер начинает врать.
 *
 * Высота блока не бесконечна: Chrome обрезает примерно на 33.5 млн px, Firefox
 * — около 17.8 млн, и дальше распорка просто перестаёт расти, а полоса
 * прокрутки — соответствовать содержимому. При строке в 28px это всего ~600
 * тысяч строк на Firefox: миллион строк простой арифметикой уже не берётся.
 *
 * Поэтому распорка зажимается этим числом (с запасом под самый строгий
 * браузер), а прокрутка перестаёт быть один-к-одному: `scrollTop` растягивается
 * до виртуальной высоты списка. Расплата — строки внутри одного «пикселя»
 * полосы перескакивают через несколько позиций; на таких объёмах это ровно то
 * же, что делает нативная полоса прокрутки, только честнее.
 */
declare const MAX_SCROLL_HEIGHT = 15000000;
type VirtualOptions = {
    /** сколько всего элементов */
    count: () => number;
    /** высота строки (или плитки) вместе с зазором, px */
    itemSize: () => number;
    /**
     * Размеры рядов поштучно, когда они РАЗНЫЕ. Заявленные, а не измеренные:
     * шахматка знает высоту строки как «этажей × высота этажа», и это по-прежнему
     * арифметика без единого обращения к элементам.
     *
     * Задан — `itemSize` не используется, `columns` игнорируется (сетка плиток
     * разной высоты — другая задача, её здесь нет). Массив должен быть НОВЫМ
     * при изменении: движок узнаёт правку по ссылке, а не по содержимому.
     * Правишь массив на месте — зови `refresh()`.
     */
    itemSizes?: () => ArrayLike<number>;
    /** сколько элементов в ряду; 1 — обычный список */
    columns?: () => number;
    /**
     * Вдоль какой оси прокрутка. `y` — обычный список, `x` — шкала времени и
     * прочие сетки, едущие вбок: читается `scrollLeft` и ширина видимой части.
     */
    axis?: 'x' | 'y';
    /**
     * Сколько пикселей стоит ПЕРЕД первым рядом внутри того же скроллера:
     * липкая колонка с названиями, шапка, отступ. Без этой поправки окно
     * считается сдвинутым ровно на её размер — на шахматке это полдюжины
     * колонок мимо.
     */
    lead?: () => number;
    /** что прокручивается */
    scroller: () => HTMLElement | null;
    /**
     * Сколько рядов рисовать сверх видимого — по одному запасному экрану сверху
     * и снизу мало кому мало. Меньше двух рядов брать не стоит: при быстрой
     * прокрутке появляется белая полоса.
     */
    overscan?: number;
    /**
     * Потолок высоты распорки, px. По умолчанию `MAX_SCROLL_HEIGHT`; ниже имеет
     * смысл опускать разве что для проверки самого маппинга на коротком списке.
     */
    maxHeight?: number;
    /** окно изменилось */
    onChange: (range: VirtualRange) => void;
};
type Virtual = {
    /** пересчитать принудительно: сменилось число элементов или размер строки */
    refresh: () => void;
    destroy: () => void;
};
declare function createVirtualizer(opts: VirtualOptions): Virtual;
/**
 * Куда прокрутить, чтобы элемент оказался в окне. Отдельно от движка, потому
 * что это чистая арифметика и её удобно проверять тестом.
 *
 * Возвращает `null`, если элемент и так виден: лишняя прокрутка к уже видимой
 * строке выглядит как дёрганье.
 */
declare function scrollOffsetFor(args: {
    index: number;
    itemSize: number;
    columns?: number;
    viewHeight: number;
    scrollTop: number;
    /** прижать к краю, даже если элемент виден */
    force?: boolean;
    /**
     * Сколько всего элементов. Нужно только длинным спискам: без этого числа
     * нельзя понять, зажата ли распорка потолком, и прокрутка к строке
     * промахнётся тем сильнее, чем длиннее список.
     */
    count?: number;
    /** потолок высоты распорки; по умолчанию `MAX_SCROLL_HEIGHT` */
    maxHeight?: number;
}): number | null;

/** Куда сортировать. */
type SortDir = 'asc' | 'desc';
/**
 * Колонка данных. Числа лежат типизированным массивом (8 байт на строку,
 * клонируются в воркер за миллисекунды), текст — обычным массивом строк.
 */
type RowColumn = {
    kind: 'number';
    values: Float64Array | number[];
} | {
    kind: 'text';
    values: string[];
};
/** Что показывать и в каком порядке. Пустой запрос — исходный порядок. */
type RowQuery = {
    sort?: {
        column: string;
        dir?: SortDir;
    };
    filter?: {
        column: string;
        /** подстрока; для числовой колонки ищется по её записи цифрами */
        contains?: string;
        /** границы для числовой колонки, включительно */
        min?: number;
        max?: number;
    };
};
type RowIndexResult = {
    /**
     * Номера строк в порядке показа. В режиме общей памяти это ОКНО в неё, а не
     * копия: держать его дольше следующего ответа нельзя — перезапишут.
     */
    order: Uint32Array;
    /** сколько строк прошло фильтр */
    matched: number;
    /** сколько всего строк было */
    total: number;
    /** сколько это считалось, мс */
    ms: number;
    /** запрос, к которому относится ответ */
    query: RowQuery;
    /**
     * Работа ещё идёт, это промежуточный улов фильтра. Бывает только в режиме
     * общей памяти — ровно ради этого он и нужен: строки видно, пока фильтр
     * досматривает остальной миллион.
     */
    partial: boolean;
};
type RowIndexProgress = {
    phase: 'filter' | 'sort';
    /** доля выполненного, 0…1 */
    done: number;
    /** сколько строк отобрано на этот момент */
    matched: number;
};
type RowIndexOptions = {
    /** готовый порядок */
    onResult: (result: RowIndexResult) => void;
    /** долгая работа: сколько уже сделано. Зовётся не чаще ~15 раз в секунду */
    onProgress?: (progress: RowIndexProgress) => void;
    /**
     * Сколько элементов обрабатывать за один заход, прежде чем уступить очереди
     * сообщений. Меньше — отзывчивее отмена, больше — меньше накладных расходов.
     */
    chunk?: number;
    /**
     * Считать на главном потоке даже там, где воркер доступен. Нужно ровно для
     * двух вещей: тестов и наглядного «а вот так оно колом встаёт».
     */
    inline?: boolean;
    /**
     * Общая память (`SharedArrayBuffer`) вместо пересылки копий. По умолчанию —
     * когда страница изолирована (`crossOriginIsolated`). Включать вручную имеет
     * смысл только для проверки: без изоляции конструктор бросит.
     */
    shared?: boolean;
};
type RowIndex = {
    /** загрузить данные; в воркер они уезжают копией — зовётся редко */
    setData: (data: {
        count: number;
        columns: Record<string, RowColumn>;
    }) => void;
    /** посчитать порядок; предыдущий незаконченный запрос отменяется */
    query: (q: RowQuery) => void;
    /**
     * Бросить текущий расчёт и не ждать ответа. Нужно, когда запрос стал пустым:
     * гонять миллион строк ради порядка «как в данных» незачем, но и получить
     * потом ответ на позавчерашний запрос нельзя.
     */
    cancel: () => void;
    /** считает ли отдельный поток (false — воркер не завёлся, работаем инлайном) */
    readonly threaded: boolean;
    /** идёт ли обмен через общую память (иначе — копиями) */
    readonly shared: boolean;
    destroy: () => void;
};
declare function createRowIndex(opts: RowIndexOptions): RowIndex;

/** файл вместе с путём внутри брошенной папки */
type DroppedFile = {
    file: File;
    /**
     * Путь относительно места броска: `фото/2026/море.jpg`. У файла, брошенного
     * поодиночке, — просто имя.
     */
    path: string;
};
/**
 * Разобрать брошенное в плоский список файлов с путями.
 *
 * Зовётся ПРЯМО в обработчике `drop`, без `await` перед ней:
 *
 * ```ts
 * onDrop={(ev) => {
 *   ev.preventDefault()
 *   readDropEntries(ev.dataTransfer).then((files) => …)
 * }}
 * ```
 *
 * Папок в браузере может не оказаться (Safari до 11.1, старый Firefox) — тогда
 * возвращаются обычные файлы, без путей. Это не ошибка, это меньше данных.
 */
declare function readDropEntries(dt: DataTransfer | null): Promise<Array<DroppedFile>>;
/** есть ли в брошенном хоть одна папка — чтобы предупредить, что будет долго */
declare function hasDirectories(dt: DataTransfer | null): boolean;

type UndoStep = {
    /** что писать в кнопке и в подсказке: «перенос 3 шт.» */
    label: string;
    /**
     * Как вернуть как было. `null` — вернуть нельзя: удаление без корзины,
     * перезапись файла. Такой шаг обрывает всю цепочку отмены за собой.
     */
    undo: (() => Promise<void>) | null;
    /** как повторить после отмены; не задан — повтор недоступен */
    redo?: () => Promise<void>;
};
type UndoStack = {
    /** запомнить сделанное */
    push: (step: UndoStep) => void;
    undo: () => Promise<void>;
    redo: () => Promise<void>;
    /** что отменится следующим; `null` — нечего или нельзя */
    peekUndo: () => UndoStep | null;
    peekRedo: () => UndoStep | null;
    canUndo: () => boolean;
    canRedo: () => boolean;
    clear: () => void;
};
type UndoOptions = {
    /** сколько шагов помнить; по умолчанию 50 */
    limit?: number;
    /** стек изменился — перерисовать кнопки */
    onChange?: () => void;
    /** отмена сорвалась */
    onError?: (err: unknown, step: UndoStep) => void;
};
declare function createUndoStack(opts?: UndoOptions): UndoStack;

type MoveKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End' | 'PageUp' | 'PageDown';
type MoveArgs = {
    /** откуда идём; `-1` — курсора ещё нет */
    from: number;
    count: number;
    /** колонок в ряду; 1 — список */
    columns?: number;
    /** сколько рядов в экране — для PageUp/PageDown */
    page?: number;
};
/**
 * Куда уводит клавиша. `null` — эта клавиша не про перемещение, обрабатывать
 * её не надо (и, что важнее, не надо гасить событие).
 */
declare function moveIndex(key: string, args: MoveArgs): number | null;
/**
 * Выделение после нажатия. Три случая, и все три знакомы по любому файловому
 * менеджеру: просто стрелка переносит выделение, Shift растягивает диапазон от
 * якоря, Ctrl/Cmd только двигает курсор, ничего не трогая.
 */
declare function moveSelection<T>(args: {
    keys: Array<T>;
    /** индекс, с которого начался диапазон */
    anchor: number;
    next: number;
    current: Set<T>;
    shift: boolean;
    ctrl: boolean;
}): {
    selected: Set<T>;
    anchor: number;
};
/** относится ли клавиша к перемещению — чтобы решить, гасить ли событие */
declare const isMoveKey: (key: string) => key is MoveKey;

type InlineEdit = {
    /** что правим сейчас; `null` — ничего */
    editing: () => string | null;
    /** текущее содержимое поля */
    value: () => string;
    /** идёт сохранение */
    busy: () => boolean;
    /** ошибка последнего сохранения */
    error: () => string | null;
    start: (id: string, initial: string) => void;
    input: (next: string) => void;
    /** сохранить; вернёт `true`, если действительно сохраняли */
    commit: () => Promise<boolean>;
    cancel: () => void;
};
type InlineEditOptions = {
    /** собственно сохранение */
    save: (id: string, value: string) => Promise<void>;
    /** привести введённое к виду хранилища: обрезать пробелы, убрать слэши */
    clean?: (value: string) => string;
    /** состояние изменилось — перерисовать */
    onChange?: () => void;
};
declare function createInlineEdit(opts: InlineEditOptions): InlineEdit;

type MultipartHandshake = {
    /** идентификатор заливки от хранилища */
    uploadId: string;
    /** ключ объекта */
    key: string;
};
type MultipartOptions = {
    /** начать: вернуть `uploadId` и ключ */
    begin: (file: File, prefix: string) => Promise<MultipartHandshake>;
    /** подписать один кусок; номера с ЕДИНИЦЫ, так требует S3 */
    signPart: (h: MultipartHandshake, partNumber: number) => Promise<string>;
    /** собрать объект из кусков */
    complete: (h: MultipartHandshake, parts: Array<UploadedPart>) => Promise<void>;
    /** выбросить недособранное */
    abort: (h: MultipartHandshake) => Promise<void>;
    /**
     * Размер куска, байт. По умолчанию 8 МиБ: у S3 минимум 5 МиБ на все куски,
     * кроме последнего, а мельче — это лишние подписи и лишние запросы.
     */
    partSize?: number;
    /** сколько кусков слать разом; по умолчанию 3 */
    concurrency?: number;
};
type UploadedPart = {
    partNumber: number;
    /** ETag куска — по нему хранилище собирает объект */
    etag: string;
};
/**
 * Залить файл частями. Прогресс общий по файлу, а не по кускам: считаем
 * отданные байты каждого куска и делим на размер файла.
 */
declare function uploadMultipart(file: File, ctx: {
    prefix: string;
    onProgress: (fraction: number) => void;
    signal: AbortSignal;
}, opts: MultipartOptions): Promise<{
    key: string;
}>;
/** стоит ли лить частями: мелкие файлы этого не окупают */
declare const shouldSplit: (file: File, partSize?: number) => boolean;

export { ACCEL, type AutoScroller, type DroppedFile, EDGE, type Flip, type InlineEdit, type InlineEditOptions, LONGPRESS, MAX_SCROLL_HEIGHT, MAX_SPEED, MOVE_TOL, type MoveArgs, type MoveKey, type MultipartHandshake, type MultipartOptions, NO_DRAG, type Presigned, type PresignedOptions, type PressGate, type PressGateOptions, type QueueEvents, type RowColumn, type RowIndex, type RowIndexOptions, type RowIndexProgress, type RowIndexResult, type RowQuery, type SortDir, type StableOrder, type UndoOptions, type UndoStack, type UndoStep, type UploadQueue, type UploadResult, type UploadedPart, type Uploader, type ViewGeom, type Virtual, type VirtualOptions, type VirtualRange, autoScrollSpeed, batch, createAutoScroller, createFlip, createInlineEdit, createPresignedUploader, createPressGate, createRowIndex, createStableOrder, createUndoStack, createUploadQueue, createVirtualizer, doScroll, focusInside, hasDirectories, injectStyle, isMoveKey, measure, moveIndex, moveSelection, onMounted, prefersReducedMotion, putWithProgress, readDropEntries, restoreTextSelection, scrollOf, scrollOffsetFor, scrollParent, shouldAnimate, shouldSplit, suppressTextSelection, targetIsInteractive, uploadMultipart, viewOrigin, watch };
