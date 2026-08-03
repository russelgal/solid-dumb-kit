// Готовые адаптеры к хранилищу.
//
// Файндер говорит с хранилищем через `FinderSource` — и почти всегда этот
// адаптер получается один и тот же: сходить в свои ручки за списком, залить по
// подписанной ссылке, попросить удалить или перенести. Здесь он написан один
// раз; свой понадобится, только если ручки называются иначе или хранилище
// вообще не по HTTP.
//
// Ключей от бакета тут по-прежнему нет и быть не может: см. `presigned.ts` в
// `@solid-dumb-kit/shared`. Адаптер знает адреса СВОЕГО сервера, не более.

import { putWithProgress, type Presigned } from '@solid-dumb-kit/shared'
import { nameOf, parentOf } from './finderPath'
import type { FinderEntry, FinderSource } from './finderTypes'

/* ────────── HTTP: свои ручки ────────── */

export type HttpSourceOptions = {
  /** база ручек хранилища, например `/api/s3` */
  base: string
  /**
   * Куда просить подпись на заливку. Файл при этом летит В ХРАНИЛИЩЕ напрямую,
   * мимо твоего сервера. Ответ — `{ url, headers?, key?, publicUrl? }`, как у
   * `createPresignedUploader`.
   */
  sign?: string
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
  upload?: string
  /**
   * Имена ручек, если они у тебя другие. По умолчанию:
   * `list`, `tree`, `delete`, `move`, `mkdir`.
   */
  paths?: Partial<Record<'list' | 'tree' | 'delete' | 'move' | 'mkdir', string>>
  /**
   * Чего сервер НЕ умеет. Выключенное умение исчезает и из файндера: нет
   * `move` — плитки не таскаются, нет `remove` — нет кнопки удаления.
   */
  without?: Array<'tree' | 'remove' | 'move' | 'mkdir'>
  /** заголовки на каждый запрос: авторизация и прочее */
  headers?: () => Record<string, string>
  /** свой fetch — для тестов или обёртки с ретраями */
  fetch?: typeof fetch
}

/**
 * Адаптер к своим HTTP-ручкам. Ровно та схема, что собрана в витрине кита
 * (`playground/devS3.ts`): перечисление и разрушающие операции идут на сервер,
 * файл летит в хранилище напрямую по подписанной ссылке.
 */
export function createHttpSource(opts: HttpSourceOptions): FinderSource {
  const f = opts.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
  const at = (name: keyof NonNullable<HttpSourceOptions['paths']>) =>
    `${opts.base}/${opts.paths?.[name] ?? name}`
  const off = (what: 'tree' | 'remove' | 'move' | 'mkdir') => opts.without?.includes(what)

  /**
   * Ответ разбираем строго: `{ error }` — это ошибка, даже когда статус 200.
   * Иначе неудачное удаление выглядит как удачное, а список просто не меняется.
   */
  async function call<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await f(url, {
      ...init,
      headers: { ...(opts.headers?.() ?? {}), ...(init?.headers ?? {}) },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || (data as { error?: string })?.error) {
      throw new Error((data as { error?: string })?.error ?? `хранилище ответило ${res.status}`)
    }
    return data as T
  }

  const post = (url: string, body: unknown, signal?: AbortSignal) =>
    call<unknown>(url, { method: 'POST', body: JSON.stringify(body), signal }).then(() => undefined)

  const source: FinderSource = {
    list: (prefix, ctx) =>
      call<{ entries: Array<FinderEntry> }>(
        `${at('list')}?prefix=${encodeURIComponent(prefix)}`,
        { signal: ctx.signal },
      ).then((r) => r.entries ?? []),
  }

  if (!off('tree')) {
    source.tree = (ctx) =>
      call<{ entries: Array<FinderEntry> }>(at('tree'), { signal: ctx.signal }).then(
        (r) => r.entries ?? [],
      )
  }

  if (opts.upload) {
    // через свой сервер: файл телом запроса, имя и папка — в query
    source.upload = (file, ctx) =>
      putWithProgress(
        file,
        {
          url:
            `${opts.upload}?prefix=${encodeURIComponent(ctx.prefix)}` +
            `&name=${encodeURIComponent(file.name)}`,
          method: 'POST',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
            ...(opts.headers?.() ?? {}),
          },
        },
        ctx,
      ).then(() => undefined)
  } else if (opts.sign) {
    // мимо сервера: он только подписывает ссылку
    source.upload = async (file, ctx) => {
      const signed = await call<Presigned>(opts.sign!, {
        method: 'POST',
        body: JSON.stringify({ name: file.name, type: file.type, prefix: ctx.prefix }),
        signal: ctx.signal,
      })
      await putWithProgress(file, signed, ctx)
    }
  }

  if (!off('remove')) source.remove = (keys) => post(at('delete'), { keys })
  if (!off('move')) source.move = (keys, to) => post(at('move'), { keys, to })
  if (!off('mkdir')) source.mkdir = (prefix) => post(at('mkdir'), { prefix })

  return source
}

/* ────────── S3: подпись на сервере, файл мимо сервера ────────── */

export type S3SourceOptions = Omit<HttpSourceOptions, 'upload'> & {
  /** куда просить подпись; по умолчанию `<base>/sign` */
  sign?: string
}

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
export function createS3Source(opts: S3SourceOptions): FinderSource {
  return createHttpSource({ ...opts, sign: opts.sign ?? `${opts.base}/sign` })
}

/* ────────── Тупой Node: файл идёт через сервер ────────── */

export type NodeSourceOptions = Omit<HttpSourceOptions, 'sign'> & {
  /** куда лить файл; по умолчанию `<base>/upload` */
  upload?: string
}

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
export function createNodeSource(opts: NodeSourceOptions): FinderSource {
  return createHttpSource({ ...opts, upload: opts.upload ?? `${opts.base}/upload` })
}

/* ────────── WebDAV ────────── */

export type WebdavSourceOptions = {
  /** корень коллекции, например `https://cloud.example.com/remote.php/dav/files/ivan` */
  base: string
  /** заголовки на каждый запрос: `Authorization` и прочее */
  headers?: () => Record<string, string>
  fetch?: typeof fetch
  /** глубина обхода для дерева; по умолчанию не обходим — дерево ленивое */
  tree?: boolean
}

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
export function createWebdavSource(opts: WebdavSourceOptions): FinderSource {
  const f = opts.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
  const root = opts.base.replace(/\/+$/, '')
  /** путь → абсолютный URL; сегменты кодируем по отдельности, слэши живые */
  const url = (path: string) =>
    `${root}/${path.split('/').filter(Boolean).map(encodeURIComponent).join('/')}${
      path.endsWith('/') && path ? '/' : ''
    }`

  const send = async (method: string, path: string, init: RequestInit = {}) => {
    const res = await f(url(path), {
      method,
      ...init,
      headers: { ...(opts.headers?.() ?? {}), ...(init.headers ?? {}) },
    })
    if (!res.ok) throw new Error(`${method} ${path || '/'} — сервер ответил ${res.status}`)
    return res
  }

  /**
   * Разбор ответа PROPFIND. Свой, а не библиотекой: нужны четыре поля из
   * `<d:response>`, а `DOMParser` в браузере есть всегда.
   *
   * Тонкость: сервер возвращает и САМУ запрошенную коллекцию — её отбрасываем,
   * иначе папка окажется вложенной сама в себя.
   */
  const parse = (xml: string, prefix: string): Array<FinderEntry> => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    const out: Array<FinderEntry> = []
    const rootPath = new URL(url(prefix), location.href).pathname.replace(/\/+$/, '')

    for (const el of Array.from(doc.getElementsByTagNameNS('DAV:', 'response'))) {
      const href = el.getElementsByTagNameNS('DAV:', 'href')[0]?.textContent ?? ''
      const path = decodeURIComponent(new URL(href, location.href).pathname).replace(/\/+$/, '')
      if (!path || path === rootPath) continue      // сама коллекция — не её содержимое

      const dir = !!el.getElementsByTagNameNS('DAV:', 'collection').length
      const name = path.slice(path.lastIndexOf('/') + 1)
      const size = Number(el.getElementsByTagNameNS('DAV:', 'getcontentlength')[0]?.textContent ?? 0)
      const modified = el.getElementsByTagNameNS('DAV:', 'getlastmodified')[0]?.textContent
      out.push({
        key: `${prefix}${name}${dir ? '/' : ''}`,
        name,
        dir: dir || undefined,
        size: dir ? undefined : size,
        modified: modified ? Date.parse(modified) : undefined,
        url: dir ? undefined : url(`${prefix}${name}`),
      })
    }
    return out
  }

  return {
    list: async (prefix, ctx) => {
      const res = await send('PROPFIND', prefix, {
        // Depth: 1 — только прямое содержимое. Без заголовка иные серверы
        // понимают запрос как «всё поддерево» и отдают мегабайты XML
        headers: { Depth: '1', 'Content-Type': 'application/xml' },
        signal: ctx.signal,
      })
      return parse(await res.text(), prefix)
    },

    upload: (file, ctx) =>
      putWithProgress(
        file,
        {
          url: url(`${ctx.prefix}${file.name}`),
          method: 'PUT',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
            ...(opts.headers?.() ?? {}),
          },
        },
        ctx,
      ).then(() => undefined),

    // DELETE по коллекции сносит её вместе с содержимым — это поведение самого
    // протокола, отдельно обходить дерево не нужно
    remove: async (keys) => {
      for (const key of keys) await send('DELETE', key)
    },

    move: async (keys, to) => {
      for (const key of keys) {
        const name = key.endsWith('/') ? nameOf(key) + '/' : nameOf(key)
        // Destination — АБСОЛЮТНЫЙ URL, относительный примут не все серверы
        await send('MOVE', key, {
          headers: { Destination: new URL(url(`${to}${name}`), location.href).href },
        })
      }
    },

    mkdir: async (prefix) => {
      await send('MKCOL', prefix)
    },
  }
}

/* ────────── Память вкладки ────────── */

export type MemorySourceOptions = {
  /** что уже лежит: ключ → размер в байтах */
  seed?: Record<string, number>
  /** задержка ответа, мс: без неё не видно ни очереди, ни «читаю…» */
  latency?: number
}

/**
 * Хранилище в памяти вкладки. Не игрушка ради демо: оно ведёт себя как S3 —
 * ключи ПЛОСКИЕ, папка существует ровно пока в ней есть файлы, — поэтому на нём
 * ловятся те же грабли, что и на настоящем бакете, но без сети и без ключей.
 *
 * Годится для витрин без сервера, для оффлайна и для тестов.
 */
export function createMemorySource(opts: MemorySourceOptions = {}): FinderSource {
  type Meta = { size: number; modified: number; url?: string }
  const files = new Map<string, Meta>()
  for (const [key, size] of Object.entries(opts.seed ?? {})) {
    files.set(key, { size, modified: Date.now() })
  }

  const wait = <T,>(v: T): Promise<T> =>
    new Promise((ok) => setTimeout(() => ok(v), opts.latency ?? 150))

  /** ключ вкладывается в КАЖДОГО своего предка — отсюда вес папки */
  const weigh = () => {
    const acc = new Map<string, { size: number; count: number }>()
    for (const [key, meta] of files) {
      let cut = key.indexOf('/')
      while (cut >= 0) {
        const prefix = key.slice(0, cut + 1)
        const was = acc.get(prefix) ?? { size: 0, count: 0 }
        was.size += meta.size
        was.count++
        acc.set(prefix, was)
        cut = key.indexOf('/', cut + 1)
      }
    }
    return acc
  }

  return {
    list: (prefix) => {
      const dirs = new Set<string>()
      const out: Array<FinderEntry> = []
      for (const [key, meta] of files) {
        if (!key.startsWith(prefix)) continue
        const rest = key.slice(prefix.length)
        const slash = rest.indexOf('/')
        if (slash >= 0) dirs.add(rest.slice(0, slash + 1))
        else out.push({ key, name: rest, ...meta })
      }
      for (const d of dirs) out.push({ key: prefix + d, name: d.slice(0, -1), dir: true })
      return wait(out)
    },

    tree: () =>
      wait(
        [...weigh()].map(([key, v]) => ({
          key,
          name: nameOf(key),
          dir: true,
          size: v.size,
          count: v.count,
        })),
      ),

    upload: (file, ctx) => {
      // полосу тянем честно: иначе не видно ни очереди, ни отмены
      const started = performance.now()
      return new Promise<void>((done, fail) => {
        const tick = () => {
          if (ctx.signal.aborted) return fail(new Error('отменено'))
          const f = Math.min(1, (performance.now() - started) / (opts.latency ?? 150) / 8)
          ctx.onProgress(f)
          if (f < 1) return void requestAnimationFrame(tick)
          files.set(`${ctx.prefix}${file.name}`, {
            size: file.size,
            modified: Date.now(),
            url: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
          })
          done()
        }
        requestAnimationFrame(tick)
      })
    },

    remove: (keys) => {
      for (const k of keys) {
        for (const key of [...files.keys()]) if (key === k || key.startsWith(k)) files.delete(key)
      }
      return wait(undefined)
    },

    move: (keys, to) => {
      for (const k of keys) {
        // папка переезжает вместе со своим именем: `a/фото/` в `b/` даёт `b/фото/…`
        const cut = k.endsWith('/') ? parentOf(k).length : 0
        for (const [key, meta] of [...files]) {
          if (key !== k && !key.startsWith(k)) continue
          files.delete(key)
          files.set(`${to}${k.endsWith('/') ? key.slice(cut) : nameOf(key)}`, meta)
        }
      }
      return wait(undefined)
    },

    // пустой папки в S3 не существует, и подделка врать не должна: кладём
    // в неё файл-заглушку, иначе показать её будет негде
    mkdir: (prefix) => {
      files.set(`${prefix}.keep`, { size: 0, modified: Date.now() })
      return wait(undefined)
    },
  }
}
