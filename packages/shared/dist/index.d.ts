declare function prefersReducedMotion(): boolean;
/** анимировать ли: undefined → да, но с оглядкой на системную настройку */
declare function shouldAnimate(explicit?: boolean): boolean;

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

export { ACCEL, type AutoScroller, EDGE, type Flip, LONGPRESS, MAX_SPEED, MOVE_TOL, NO_DRAG, type Presigned, type PresignedOptions, type PressGate, type PressGateOptions, type QueueEvents, type StableOrder, type UploadQueue, type UploadResult, type Uploader, type ViewGeom, autoScrollSpeed, createAutoScroller, createFlip, createPresignedUploader, createPressGate, createStableOrder, createUploadQueue, doScroll, focusInside, injectStyle, measure, prefersReducedMotion, putWithProgress, restoreTextSelection, scrollOf, scrollParent, shouldAnimate, suppressTextSelection, targetIsInteractive, viewOrigin };
