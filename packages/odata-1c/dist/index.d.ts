/**
 * Клиент стандартного интерфейса OData 1С (`standard.odata`).
 *
 * Framework-free и универсальный (браузер и Node 18+): fetch, TextEncoder,
 * без зависимостей. Инкапсулирует известные капризы 1С:
 * - `$format=application/json;odata=nometadata` в каждом запросе — иначе в
 *   ответе светится внутренний адрес сервера 1С (Accept 1С игнорирует).
 * - Пробелы в параметрах кодируются как `%20` — с `+` 1С МОЛЧА игнорирует
 *   `$filter` (поэтому не URLSearchParams).
 * - `$filter`/`$orderby` по полям могут быть запрещены правами роли
 *   («Операция не разрешена в предложении "ГДЕ"») — для хронологических
 *   списков есть `tailPage()` (листание с конца через `$skip`).
 * - Точечное чтение `Entity(guid'...')` работает даже когда `$filter` запрещён.
 * - Ошибки 1С приходят как `odata.error` (иногда с BOM) — парсятся.
 */
type OdataClientOptions = {
    /** Базовый URL: прямой `https://host/base/odata/standard.odata` или прокси `/odata` */
    baseUrl: string;
    /** Логин 1С (Basic). Либо передайте готовый token. */
    login?: string;
    password?: string;
    /** Готовый base64(login:password) — если логин/пароль не хранится */
    token?: string;
    /** Свой fetch (например, с логированием или ретраями) */
    fetch?: typeof fetch;
    /** Таймаут запроса, мс (по умолчанию 30000). Защита от зависших запросов 1С. */
    timeoutMs?: number;
};
type OdataListResponse<T> = {
    value: T[];
    'odata.count'?: string;
};
declare class OdataError extends Error {
    readonly status?: number | undefined;
    constructor(message: string, status?: number | undefined);
}
/** base64 c поддержкой UTF-8 (кириллица в логинах 1С), работает в браузере и Node */
declare function toBase64(s: string): string;
/** Экранирование строки для `$filter`: апостроф удваивается */
declare function odataString(s: string): string;
declare class OdataClient {
    private readonly baseUrl;
    private readonly token;
    private readonly fetchFn;
    private readonly timeoutMs;
    constructor(opts: OdataClientOptions);
    /** Сборка URL: параметры кодируются вручную (`%20`, не `+`) */
    url(resource: string, params?: Record<string, string | number>): string;
    request<T>(resource: string, params?: Record<string, string | number>, init?: {
        method?: string;
        body?: unknown;
    }): Promise<T>;
    /** GET сущности/набора */
    get<T = Record<string, unknown>>(resource: string, params?: Record<string, string | number>): Promise<T>;
    /** GET набора → массив `value` */
    list<T = Record<string, unknown>>(resource: string, params?: Record<string, string | number>): Promise<T[]>;
    /** Точечное чтение по ключу: `Entity(guid'...')` — работает даже при запрете `$filter` */
    one<T = Record<string, unknown>>(entity: string, refKey: string, select?: string): Promise<T>;
    /** Точное число записей набора (опционально — с `$filter`) */
    count(resource: string, filter?: string): Promise<number>;
    /**
     * Страница «свежие сверху» хронологического набора, когда `$orderby`
     * игнорируется/запрещён: читаем кусок с конца через `$skip` и разворачиваем.
     * `filter` (опционально) применяется и к count, и к странице — поиск
     * с пагинацией поверх того же приёма.
     */
    tailPage<T = Record<string, unknown>>(resource: string, opts: {
        page: number;
        pageSize: number;
        select?: string;
        filter?: string;
    }): Promise<{
        rows: T[];
        total: number;
    }>;
}
declare function createOdataClient(opts: OdataClientOptions): OdataClient;

export { OdataClient, type OdataClientOptions, OdataError, type OdataListResponse, createOdataClient, odataString, toBase64 };
