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

export type OdataClientOptions = {
  /** Базовый URL: прямой `https://host/base/odata/standard.odata` или прокси `/odata` */
  baseUrl: string
  /** Логин 1С (Basic). Либо передайте готовый token. */
  login?: string
  password?: string
  /** Готовый base64(login:password) — если логин/пароль не хранится */
  token?: string
  /** Свой fetch (например, с логированием или ретраями) */
  fetch?: typeof fetch
  /** Таймаут запроса, мс (по умолчанию 30000). Защита от зависших запросов 1С. */
  timeoutMs?: number
}

export type OdataListResponse<T> = {
  value: T[]
  'odata.count'?: string
}

export class OdataError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'OdataError'
  }
}

const JSON_NOMETA = 'application/json;odata=nometadata'

/** base64 c поддержкой UTF-8 (кириллица в логинах 1С), работает в браузере и Node */
export function toBase64(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  // btoa есть в браузере и в Node 16+
  return btoa(bin)
}

/** Экранирование строки для `$filter`: апостроф удваивается */
export function odataString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}

/** Парсинг odata.error из тела ответа (учитывает BOM) */
function parseODataError(text: string): string | null {
  try {
    const clean = text.replace(/^﻿/, '')
    const json = JSON.parse(clean)
    return json?.['odata.error']?.message?.value ?? null
  } catch {
    return null
  }
}

export class OdataClient {
  private readonly baseUrl: string
  private readonly token: string
  private readonly fetchFn: typeof fetch
  private readonly timeoutMs: number

  constructor(opts: OdataClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '')
    this.token = opts.token ?? toBase64(`${opts.login ?? ''}:${opts.password ?? ''}`)
    this.fetchFn = opts.fetch ?? fetch
    this.timeoutMs = opts.timeoutMs ?? 30000
  }

  /** Сборка URL: параметры кодируются вручную (`%20`, не `+`) */
  url(resource: string, params: Record<string, string | number> = {}): string {
    const all: Record<string, string> = {
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
      $format: JSON_NOMETA,
    }
    const qs = Object.entries(all)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')
    return `${this.baseUrl}/${encodeURI(resource)}?${qs}`
  }

  async request<T>(
    resource: string,
    params: Record<string, string | number> = {},
    init: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs)
    let res: Response
    try {
      res = await this.fetchFn(this.url(resource, params), {
        method: init.method ?? 'GET',
        headers: {
          Authorization: `Basic ${this.token}`,
          Accept: 'application/json',
          ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: ctrl.signal,
      })
    } catch (e) {
      if (ctrl.signal.aborted) throw new OdataError(`1С OData: таймаут ${this.timeoutMs}мс`)
      throw e
    } finally {
      clearTimeout(timer)
    }

    const text = await res.text()
    if (!res.ok) {
      const msg = parseODataError(text)
      if (res.status === 401) throw new OdataError('Неверный логин или пароль 1С', 401)
      throw new OdataError(msg ?? `1С OData HTTP ${res.status}: ${text.slice(0, 200)}`, res.status)
    }

    // 204 No Content (DELETE и часть PATCH) приходит без тела
    if (!text.trim()) return undefined as T

    const json = JSON.parse(text.replace(/^﻿/, '')) as T & Record<string, unknown>
    const err = (json as Record<string, unknown>)['odata.error'] as
      | { message?: { value?: string } }
      | undefined
    if (err) throw new OdataError(err.message?.value ?? JSON.stringify(err).slice(0, 200))
    return json
  }

  /** GET сущности/набора */
  get<T = Record<string, unknown>>(resource: string, params?: Record<string, string | number>) {
    return this.request<T>(resource, params)
  }

  /** GET набора → массив `value` */
  async list<T = Record<string, unknown>>(
    resource: string,
    params?: Record<string, string | number>,
  ): Promise<T[]> {
    const resp = await this.request<OdataListResponse<T>>(resource, params)
    return resp.value ?? []
  }

  /** Точечное чтение по ключу: `Entity(guid'...')` — работает даже при запрете `$filter` */
  one<T = Record<string, unknown>>(entity: string, refKey: string, select?: string) {
    return this.request<T>(`${entity}(guid'${refKey}')`, select ? { $select: select } : {})
  }

  /** Точное число записей набора (опционально — с `$filter`) */
  async count(resource: string, filter?: string): Promise<number> {
    const params: Record<string, string | number> = {
      $top: 0,
      $inlinecount: 'allpages',
      $select: 'Ref_Key',
    }
    if (filter) params.$filter = filter
    const resp = await this.request<OdataListResponse<unknown>>(resource, params)
    return Number(resp['odata.count']) || 0
  }

  /**
   * Страница «свежие сверху» хронологического набора, когда `$orderby`
   * игнорируется/запрещён: читаем кусок с конца через `$skip` и разворачиваем.
   * `filter` (опционально) применяется и к count, и к странице — поиск
   * с пагинацией поверх того же приёма.
   */
  async tailPage<T = Record<string, unknown>>(
    resource: string,
    opts: { page: number; pageSize: number; select?: string; filter?: string },
  ): Promise<{ rows: T[]; total: number }> {
    const total = await this.count(resource, opts.filter)
    const end = Math.max(0, total - (opts.page - 1) * opts.pageSize)
    const skip = Math.max(0, end - opts.pageSize)
    const top = end - skip
    if (top <= 0) return { rows: [], total }

    const params: Record<string, string | number> = { $skip: skip, $top: top }
    if (opts.select) params.$select = opts.select
    if (opts.filter) params.$filter = opts.filter
    const rows = await this.list<T>(resource, params)
    return { rows: rows.reverse(), total }
  }
}

export function createOdataClient(opts: OdataClientOptions): OdataClient {
  return new OdataClient(opts)
}
