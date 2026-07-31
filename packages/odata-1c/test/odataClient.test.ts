import { describe, it, expect, vi } from 'vitest'
import { createOdataClient, OdataError, odataString, toBase64 } from '../src/odataClient'

/**
 * Тесты клиента с подменённым fetch: сети нет, проверяется ровно то, ради чего
 * клиент существует, — какой URL уходит в 1С, какие заголовки на нём висят и
 * как разбирается ответ (включая капризы вроде BOM и пустого тела).
 */

/** fetch-заглушка: запоминает вызовы, отдаёт заданный ответ */
function fakeFetch(
  body: unknown,
  init: { status?: number; text?: string } = {},
): { fetch: typeof fetch; calls: Array<{ url: string; init: RequestInit }> } {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fetchFn = vi.fn(async (input: RequestInfo | URL, reqInit?: RequestInit) => {
    calls.push({ url: String(input), init: reqInit ?? {} })
    const text = init.text ?? JSON.stringify(body)
    const status = init.status ?? 200
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => text,
    } as Response
  })
  return { fetch: fetchFn as unknown as typeof fetch, calls }
}

const client = (fetchFn: typeof fetch, baseUrl = 'https://1c.example/base/odata/standard.odata') =>
  createOdataClient({ baseUrl, login: 'Кладовщик', password: 'секрет', fetch: fetchFn })

describe('сборка URL', () => {
  it('добавляет $format=nometadata и кодирует пробелы как %20, а не +', async () => {
    const { fetch, calls } = fakeFetch({ value: [] })
    await client(fetch).list('Catalog_Номенклатура', { $filter: "Description eq 'Скотч'" })

    const url = calls[0]!.url
    expect(url).toContain('%24format=application%2Fjson%3Bodata%3Dnometadata')
    // с '+' вместо %20 1С молча отдаёт выборку без отбора
    expect(url).toContain('%20eq%20')
    expect(url).not.toContain('+')
  })

  it('срезает хвостовой слэш базы и кодирует кириллицу в имени сущности', () => {
    const { fetch } = fakeFetch({ value: [] })
    const c = client(fetch, 'https://1c.example/base/odata/standard.odata/')
    expect(c.url('Catalog_Номенклатура')).toMatch(
      /^https:\/\/1c\.example\/base\/odata\/standard\.odata\/Catalog_%D0%9D/,
    )
  })

  it('относительный baseUrl прокси остаётся относительным', () => {
    const { fetch } = fakeFetch({ value: [] })
    expect(client(fetch, '/odata').url('Catalog_Партнеры')).toMatch(/^\/odata\/Catalog_%D0%9F/)
  })
})

describe('авторизация', () => {
  it('Basic-заголовок строится из UTF-8 (кириллица в логине 1С)', async () => {
    const { fetch, calls } = fakeFetch({ value: [] })
    await client(fetch).list('Catalog_Партнеры')

    const headers = calls[0]!.init.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Basic ${toBase64('Кладовщик:секрет')}`)
    expect(headers.Accept).toBe('application/json')
  })

  it('готовый token используется как есть — логин/пароль не нужны', async () => {
    const { fetch, calls } = fakeFetch({ value: [] })
    const c = createOdataClient({ baseUrl: '/odata', token: 'dG9rZW4=', fetch })
    await c.list('Catalog_Пользователи')
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Basic dG9rZW4=')
  })
})

describe('разбор ответа', () => {
  it('list отдаёт value, а при его отсутствии — пустой массив', async () => {
    const withValue = fakeFetch({ value: [{ Ref_Key: 'a' }] })
    expect(await client(withValue.fetch).list('Catalog_Номенклатура')).toHaveLength(1)

    const empty = fakeFetch({})
    expect(await client(empty.fetch).list('Catalog_Номенклатура')).toEqual([])
  })

  it('BOM перед JSON не ломает разбор', async () => {
    const { fetch } = fakeFetch(null, { text: '﻿{"value":[{"Ref_Key":"a"}]}' })
    expect(await client(fetch).list('Catalog_Номенклатура')).toEqual([{ Ref_Key: 'a' }])
  })

  it('пустое тело (204 на DELETE/PATCH) не считается ошибкой', async () => {
    const { fetch } = fakeFetch(null, { status: 204, text: '' })
    await expect(client(fetch).get('Catalog_Номенклатура')).resolves.toBeUndefined()
  })

  it('401 отдаётся понятным сообщением со статусом', async () => {
    const { fetch } = fakeFetch(null, { status: 401, text: '' })
    const err = await client(fetch)
      .list('Catalog_Номенклатура')
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(OdataError)
    expect((err as OdataError).status).toBe(401)
    expect((err as OdataError).message).toBe('Неверный логин или пароль 1С')
  })

  it('текст odata.error достаётся и из тела ошибки, и из успешного ответа', async () => {
    const body = JSON.stringify({
      'odata.error': { message: { value: 'Операция не разрешена в предложении "ГДЕ"' } },
    })

    const failed = fakeFetch(null, { status: 400, text: body })
    await expect(client(failed.fetch).list('Catalog_Номенклатура')).rejects.toThrow(
      'Операция не разрешена',
    )

    // 1С умеет положить odata.error и в ответ с кодом 200
    const ok200 = fakeFetch(null, { text: body })
    await expect(client(ok200.fetch).list('Catalog_Номенклатура')).rejects.toThrow(
      'Операция не разрешена',
    )
  })

  it('обрыв по таймауту приходит как OdataError, а не AbortError', async () => {
    const hang = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('AbortError')))
      })
    })
    const c = createOdataClient({
      baseUrl: '/odata',
      token: 't',
      timeoutMs: 5,
      fetch: hang as unknown as typeof fetch,
    })
    await expect(c.list('Catalog_Номенклатура')).rejects.toThrow('таймаут 5мс')
  })
})

describe('точечное чтение и счёт', () => {
  it('one() ходит в Entity(guid\'…\') с $select', async () => {
    const { fetch, calls } = fakeFetch({ Ref_Key: 'a' })
    await client(fetch).one('Catalog_Номенклатура', 'aaa-bbb', 'Артикул,Description')

    const url = decodeURIComponent(calls[0]!.url)
    expect(url).toContain("Catalog_Номенклатура(guid'aaa-bbb')")
    expect(url).toContain('$select=Артикул,Description')
  })

  it('count() просит только счётчик, без строк', async () => {
    const { fetch, calls } = fakeFetch({ value: [], 'odata.count': '1743' })
    const total = await client(fetch).count('Catalog_Партнеры', "Date ge datetime'2026-01-01T00:00:00'")

    expect(total).toBe(1743)
    const url = decodeURIComponent(calls[0]!.url)
    expect(url).toContain('$top=0')
    expect(url).toContain('$inlinecount=allpages')
    expect(url).toContain('$filter=Date ge')
  })

  it('count() без odata.count в ответе даёт 0, а не NaN', async () => {
    const { fetch } = fakeFetch({ value: [] })
    expect(await client(fetch).count('Catalog_Партнеры')).toBe(0)
  })
})

describe('tailPage — листание с конца', () => {
  /** fetch, отвечающий сначала на count, затем на страницу */
  const paged = (total: number, rows: unknown[]) => {
    const calls: Array<{ url: string }> = []
    let call = 0
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      calls.push({ url: decodeURIComponent(String(input)) })
      const body = call++ === 0 ? { value: [], 'odata.count': String(total) } : { value: rows }
      return { ok: true, status: 200, text: async () => JSON.stringify(body) } as Response
    })
    return { fetch: fetchFn as unknown as typeof fetch, calls }
  }

  it('первая страница берёт хвост набора и разворачивает его', async () => {
    const { fetch, calls } = paged(100, [{ n: 91 }, { n: 92 }, { n: 93 }])
    const { rows, total } = await client(fetch).tailPage('Document_Заказ', { page: 1, pageSize: 10 })

    expect(total).toBe(100)
    expect(calls[1]!.url).toContain('$skip=90')
    expect(calls[1]!.url).toContain('$top=10')
    expect(rows[0]).toEqual({ n: 93 }) // свежие сверху
  })

  it('вторая страница отступает ещё на pageSize', async () => {
    const { fetch, calls } = paged(100, [])
    await client(fetch).tailPage('Document_Заказ', { page: 2, pageSize: 10 })
    expect(calls[1]!.url).toContain('$skip=80')
  })

  it('неполный остаток в начале набора не уводит $skip в минус', async () => {
    const { fetch, calls } = paged(25, [])
    await client(fetch).tailPage('Document_Заказ', { page: 3, pageSize: 10 })
    expect(calls[1]!.url).toContain('$skip=0')
    expect(calls[1]!.url).toContain('$top=5')
  })

  it('за последней страницей запрос строк не отправляется', async () => {
    const { fetch, calls } = paged(25, [])
    const { rows, total } = await client(fetch).tailPage('Document_Заказ', { page: 9, pageSize: 10 })
    expect(rows).toEqual([])
    expect(total).toBe(25)
    expect(calls).toHaveLength(1) // только count
  })

  it('filter применяется и к счёту, и к странице', async () => {
    const { fetch, calls } = paged(30, [])
    await client(fetch).tailPage('Document_Заказ', {
      page: 1,
      pageSize: 10,
      select: 'Ref_Key,Number',
      filter: "substringof('скотч', Комментарий)",
    })
    expect(calls[0]!.url).toContain('substringof')
    expect(calls[1]!.url).toContain('substringof')
    expect(calls[1]!.url).toContain('$select=Ref_Key,Number')
  })
})

describe('odataString', () => {
  it('оборачивает в апострофы и удваивает их внутри', () => {
    expect(odataString('Скотч')).toBe("'Скотч'")
    expect(odataString("Д'Артаньян")).toBe("'Д''Артаньян'")
  })
})
