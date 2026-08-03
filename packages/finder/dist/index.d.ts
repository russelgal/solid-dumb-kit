import { JSX } from 'solid-js';

type FinderEntry = {
    /**
     * Полный путь от корня. У папки ОБЯЗАТЕЛЬНО заканчивается на `/` — по этому
     * признаку файндер и отличает её при переносе, а не по одному лишь `dir`.
     */
    key: string;
    /** что писать под значком; обычно хвост `key` */
    name: string;
    dir?: boolean;
    /** у файла — его размер, у папки — сумма по всему, что внутри */
    size?: number;
    /** сколько файлов внутри; только у папок */
    count?: number;
    /** мс эпохи или что угодно, что понимает `Date.parse` */
    modified?: number | string;
    /** чем показать превью и что открыть по двойному клику */
    url?: string;
};
/** Заливка в конкретную папку: то же, что `Uploader`, но с адресом назначения. */
type FinderUploader = (file: File, ctx: {
    /** куда класть: префикс папки, открытой в момент броска */
    prefix: string;
    onProgress: (fraction: number) => void;
    signal: AbortSignal;
}) => Promise<FinderEntry | void>;
type FinderSource = {
    /**
     * Что лежит в папке. Возвращать ТОЛЬКО прямое содержимое: файндер сам никогда
     * не спрашивает рекурсию, а показать десять тысяч ключей одним списком —
     * верный способ подвесить вкладку.
     */
    list: (prefix: string, ctx: {
        signal: AbortSignal;
    }) => Promise<Array<FinderEntry>>;
    /**
     * ВСЕ папки хранилища разом — для дерева слева.
     *
     * Не задан — дерево грузится по веткам (`list` на каждую), и глубокие уровни
     * появляются только когда до них дойдут. Задан — дерево строится целиком с
     * первого вздоха: у S3 это ОДИН рекурсивный листинг без `Delimiter`, из
     * которого папки выводятся арифметикой, то есть дешевле десятка запросов
     * по веткам.
     *
     * Возвращать только папки; порядок и вложенность файндер выведет сам.
     */
    tree?: (ctx: {
        signal: AbortSignal;
    }) => Promise<Array<FinderEntry>>;
    /** не задан — заливки нет: ни кнопки, ни приёма файлов броском */
    upload?: FinderUploader;
    /** не задан — нет удаления */
    remove?: (keys: Array<string>) => Promise<void>;
    /** не задан — нет переноса: ни перетаскиванием, ни кнопкой */
    move?: (keys: Array<string>, toPrefix: string) => Promise<void>;
    /** не задан — нет создания папок */
    mkdir?: (prefix: string) => Promise<void>;
};

/** имя без пути: `a/b/c.jpg` → `c.jpg`, `a/b/` → `b` */
declare function nameOf(key: string): string;
/** папка, в которой лежит ключ: `a/b/c.jpg` → `a/b/`, `a/` → `` */
declare function parentOf(key: string): string;
/** приписать имя к префиксу, не наплодив двойных слэшей */
declare function joinPrefix(prefix: string, name: string): string;
/**
 * Хлебные крошки от корня до текущего места. Корень идёт первым всегда — по
 * нему возвращаются наверх, и он же цель для переноса «в самый верх».
 */
declare function crumbs(prefix: string, rootLabel?: string): Array<{
    name: string;
    prefix: string;
}>;
/**
 * Можно ли перенести ключ в префикс.
 *
 * Отказов ровно три, и все три — про здравый смысл, а не про хранилище:
 * на место, где он уже лежит; папку внутрь самой себя; папку внутрь своего же
 * потомка (иначе ветка уезжает сама в себя и пропадает).
 */
declare function canMove(key: string, to: string): boolean;
type SortKey = 'name' | 'size' | 'modified';
/**
 * Порядок показа. Папки всегда сверху — даже при сортировке по размеру, у
 * которого для папки и значения-то нет; так делает любой файловый менеджер, и
 * ломать привычку незачем.
 *
 * Имена сравниваем `localeCompare` с `numeric`: иначе `файл10` встаёт перед
 * `файл2`, и это замечают сразу.
 */
declare function sortEntries(entries: Array<FinderEntry>, key?: SortKey, desc?: boolean): Array<FinderEntry>;
type FileKind = 'image' | 'video' | 'audio' | 'pdf' | 'archive' | 'text' | 'file';
declare function kindOf(name: string): FileKind;
/** значок по виду файла: эмодзи, чтобы пакет не тащил иконочный шрифт */
declare const ICONS: Record<FileKind | 'dir', string>;

type FinderView = 'grid' | 'list';
type DumbFinderProps = {
    /** чем говорить с хранилищем */
    source: FinderSource;
    /** открытая папка; не задан — файндер водит себя сам, начиная с корня */
    path?: string;
    onPathChange?: (prefix: string) => void;
    /** выделенные ключи; не задан — держит у себя */
    selected?: Set<string>;
    onSelectionChange?: (keys: Set<string>) => void;
    /** плитками или списком; не задан — плитками, переключатель в тулбаре */
    view?: FinderView;
    onViewChange?: (view: FinderView) => void;
    /** что пускать в выбор файлов; по умолчанию всё */
    accept?: string;
    /** сколько файлов тянуть одновременно; по умолчанию 3 */
    concurrency?: number;
    /** как называется корень в крошках; по умолчанию «Всё» */
    rootLabel?: string;
    /** ширина плитки, css-трек; по умолчанию `minmax(132px, 1fr)` */
    tile?: string;
    /** высота области с файлами; по умолчанию `60vh` */
    height?: string;
    /** дерево папок слева; по умолчанию есть */
    sidebar?: boolean;
    /** ширина дерева, css; по умолчанию `265px` */
    sidebarWidth?: string;
    /** ключ localStorage для раскрытых веток дерева; по умолчанию `dumb-finder` */
    treeKey?: string;
    /**
     * Значки видов файлов — CSS-КЛАССЫ, а не разметка: свой набор (Solar,
     * Phosphor, Lucide) выбирает потребитель, и его же Tailwind/iconify собирает
     * из этих строк CSS. Не задан — рисуем эмодзи, чтобы пакет работал и без
     * иконочного набора вовсе.
     */
    icons?: Partial<Record<FileKind | 'dir' | 'dirOpen' | 'twist' | 'refresh' | 'viewGrid' | 'viewList' | 'mkdir' | 'upload' | 'remove' | 'undo', string>>;
    /**
     * Правка. Без неё файндер только смотрит: ни заливки, ни удаления, ни
     * переноса — даже если `source` всё это умеет.
     */
    editable?: boolean;
    /** двойной клик по файлу (по папке файндер ходит сам) */
    onOpen?: (entry: FinderEntry) => void;
    /** сорвалось: не смогли перечислить, залить, удалить, перенести */
    onError?: (message: string) => void;
    /** своя плитка целиком; не задана — рисуем свою */
    children?: (entry: FinderEntry, ctx: {
        selected: boolean;
        view: FinderView;
    }) => JSX.Element;
    class?: string;
    style?: JSX.CSSProperties;
};
declare function DumbFinder(props: DumbFinderProps): JSX.Element;

type HttpSourceOptions = {
    /** база ручек хранилища, например `/api/s3` */
    base: string;
    /**
     * Куда просить подпись на заливку. Файл при этом летит В ХРАНИЛИЩЕ напрямую,
     * мимо твоего сервера. Ответ — `{ url, headers?, key?, publicUrl? }`, как у
     * `createPresignedUploader`.
     */
    sign?: string;
    /**
     * Куда лить файл, если он должен идти ЧЕРЕЗ ТВОЙ СЕРВЕР, а не мимо него.
     * Задан вместе с `sign` — побеждает этот.
     *
     * Когда так нужно: хранилище не отдаёт подписанные ссылки; на сервере надо
     * проверить файл, посчитать хэш, сделать превью, записать строку в базу; или
     * CORS у бакета закрыт наглухо и открывать его ради браузера нельзя.
     *
     * Цена — трафик идёт вдвойне: сначала к тебе, потом от тебя в хранилище.
     *
     * Тело запроса — САМ ФАЙЛ, без multipart: имя и папка едут в query, тип — в
     * `Content-Type`. Так у сервера не появляется зависимость на разбор
     * multipart, а у браузера остаётся честный прогресс отдачи.
     */
    upload?: string;
    /**
     * Имена ручек, если они у тебя другие. По умолчанию:
     * `list`, `tree`, `delete`, `move`, `mkdir`.
     */
    paths?: Partial<Record<'list' | 'tree' | 'delete' | 'move' | 'mkdir', string>>;
    /**
     * Чего сервер НЕ умеет. Выключенное умение исчезает и из файндера: нет
     * `move` — плитки не таскаются, нет `remove` — нет кнопки удаления.
     */
    without?: Array<'tree' | 'remove' | 'move' | 'mkdir'>;
    /** заголовки на каждый запрос: авторизация и прочее */
    headers?: () => Record<string, string>;
    /** свой fetch — для тестов или обёртки с ретраями */
    fetch?: typeof fetch;
};
/**
 * Адаптер к своим HTTP-ручкам. Ровно та схема, что собрана в витрине кита
 * (`playground/devS3.ts`): перечисление и разрушающие операции идут на сервер,
 * файл летит в хранилище напрямую по подписанной ссылке.
 */
declare function createHttpSource(opts: HttpSourceOptions): FinderSource;
type S3SourceOptions = Omit<HttpSourceOptions, 'upload'> & {
    /** куда просить подпись; по умолчанию `<base>/sign` */
    sign?: string;
};
/**
 * S3-совместимое хранилище (Garage, MinIO, AWS) через СВОИ ручки.
 *
 * Ключей от бакета браузер не видит: сервер отдаёт список и подписывает ссылку
 * на один объект, а файл летит в хранилище НАПРЯМУЮ, мимо твоего сервера, — он
 * не платит трафиком за каждую картинку.
 *
 * Что должен уметь сервер, расписано в доке (`docs/ru/DumbFinder.md`), а
 * рабочая реализация лежит в витрине кита — `playground/devS3.ts`.
 */
declare function createS3Source(opts: S3SourceOptions): FinderSource;
type NodeSourceOptions = Omit<HttpSourceOptions, 'sign'> & {
    /** куда лить файл; по умолчанию `<base>/upload` */
    upload?: string;
};
/**
 * Самый простой сервер, какой бывает: папки на диске, файл принимается телом
 * запроса. Ни подписей, ни SDK, ни бакетов.
 *
 * Так делают, когда файлы лежат рядом с приложением, или когда файл всё равно
 * надо пощупать на сервере — проверить, посчитать хэш, сделать превью, записать
 * строку в базу. Расплата — трафик идёт через тебя.
 *
 * Тело запроса — САМ ФАЙЛ, без multipart: имя и папка едут в query, тип — в
 * `Content-Type`. Серверу не нужен разбор multipart, браузеру остаётся честный
 * прогресс отдачи.
 */
declare function createNodeSource(opts: NodeSourceOptions): FinderSource;
type WebdavSourceOptions = {
    /** корень коллекции, например `https://cloud.example.com/remote.php/dav/files/ivan` */
    base: string;
    /** заголовки на каждый запрос: `Authorization` и прочее */
    headers?: () => Record<string, string>;
    fetch?: typeof fetch;
    /** глубина обхода для дерева; по умолчанию не обходим — дерево ленивое */
    tree?: boolean;
};
/**
 * WebDAV: Nextcloud, ownCloud, Yandex.Disk, любой `mod_dav`.
 *
 * Ровно тот случай, ради которого файндер вообще разговаривает через адаптер:
 * тут не HTTP-ручки со своим JSON, а протокол со своими глаголами — PROPFIND,
 * MKCOL, MOVE, — и XML в ответе. Компонент об этом не знает ни строчки.
 *
 * ОГОВОРКА ПРО БРАУЗЕР. Прямо со страницы WebDAV работает, только если сервер
 * отдаёт CORS с этими самыми глаголами и с `Authorization`; чужой публичный
 * обычно не отдаёт. Тогда ставь адаптер за свой прокси и бери
 * `createHttpSource`.
 */
declare function createWebdavSource(opts: WebdavSourceOptions): FinderSource;
type MemorySourceOptions = {
    /** что уже лежит: ключ → размер в байтах */
    seed?: Record<string, number>;
    /** задержка ответа, мс: без неё не видно ни очереди, ни «читаю…» */
    latency?: number;
};
/**
 * Хранилище в памяти вкладки. Не игрушка ради демо: оно ведёт себя как S3 —
 * ключи ПЛОСКИЕ, папка существует ровно пока в ней есть файлы, — поэтому на нём
 * ловятся те же грабли, что и на настоящем бакете, но без сети и без ключей.
 *
 * Годится для витрин без сервера, для оффлайна и для тестов.
 */
declare function createMemorySource(opts?: MemorySourceOptions): FinderSource;

export { DumbFinder, type DumbFinderProps, type FileKind, type FinderEntry, type FinderSource, type FinderUploader, type FinderView, type HttpSourceOptions, ICONS, type MemorySourceOptions, type NodeSourceOptions, type S3SourceOptions, type SortKey, type WebdavSourceOptions, canMove, createHttpSource, createMemorySource, createNodeSource, createS3Source, createWebdavSource, crumbs, joinPrefix, kindOf, nameOf, parentOf, sortEntries };
