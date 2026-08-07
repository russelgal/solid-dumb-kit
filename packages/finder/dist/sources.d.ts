import type { FinderSource } from './finderTypes';
export type HttpSourceOptions = {
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
export declare function createHttpSource(opts: HttpSourceOptions): FinderSource;
export type S3SourceOptions = Omit<HttpSourceOptions, 'upload'> & {
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
export declare function createS3Source(opts: S3SourceOptions): FinderSource;
export type NodeSourceOptions = Omit<HttpSourceOptions, 'sign'> & {
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
export declare function createNodeSource(opts: NodeSourceOptions): FinderSource;
export type WebdavSourceOptions = {
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
export declare function createWebdavSource(opts: WebdavSourceOptions): FinderSource;
export type MemorySourceOptions = {
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
export declare function createMemorySource(opts?: MemorySourceOptions): FinderSource;
