// Ручки к хранилищу ТОЛЬКО ДЛЯ РАЗРАБОТКИ.
//
// Живут в `configureServer`, то есть существуют лишь пока крутится `pnpm demo`.
// В собранной витрине (и на Pages) их нет вовсе — там просто нет сервера,
// который мог бы подписать и перечислить, поэтому вкладки честно переходят на
// поддельные данные.
//
// Ключи берутся из окружения и наружу не уходят: браузер получает подписанную
// ссылку на один объект и на пять минут либо готовый список. Ровно та схема,
// которую кит и предполагает у потребителя, — здесь она просто собрана для
// проверки на живом Garage.
//
// ЗАПИСЬ — ПО ВСЕМУ БАКЕТУ. Это дев-ручки к своему же хранилищу, и запирать
// хозяина в песочнице незачем: файндер для того и нужен, чтобы разбирать
// настоящие папки. Помнить стоит одно — удаление тут пачками и без корзины.
//
// Нужен предохранитель (общий бакет, чужие данные) — `S3_DEV_LOCK` в `.env`:
// `1` запирает запись в `dumb-kit-dev/`, любая другая строка — в неё же как в
// префикс. Смотреть при этом можно всё и так.
import { loadEnv, type Plugin } from 'vite'
import type { Connect } from 'vite'

/** префикс, в который кладём всё дев-барахло: отличить и вычистить */
const PREFIX = 'dumb-kit-dev/'

export function devS3(): Plugin {
  return {
    name: 'dumb-kit-dev-s3',
    apply: 'serve',          // ← в сборку не попадает никогда
    configureServer(server) {
      // `.env` Vite сам в `process.env` НЕ кладёт: клиенту он отдаёт только
      // `VITE_*` через `import.meta.env`, а для конфига и плагинов есть
      // `loadEnv`. Пустой префикс — значит читаем все переменные.
      const {
        S3_ENDPOINT: endpoint,
        S3_REGION: region,
        S3_BUCKET: bucket,
        S3_ACCESS_KEY: accessKeyId,
        S3_SECRET_KEY: secretAccessKey,
        S3_WEB_ENDPOINT: web,
        S3_DEV_LOCK: lock,
      } = loadEnv(server.config.mode, server.config.envDir, '')

      /** префикс, дальше которого запись не пускается; пусто — пускается всюду */
      const locked = lock === '1' ? PREFIX : lock || ''

      const ready = Boolean(endpoint && bucket && accessKeyId && secretAccessKey)
      if (!ready) {
        server.config.logger.info(
          '  \x1b[33mдев-подпись выключена\x1b[0m: нет S3_* в окружении (см. .env.example)',
        )
      } else {
        server.config.logger.info(
          `  \x1b[32mдев-подпись\x1b[0m: ${bucket} на ${endpoint}, ` +
            `запись ${locked ? `в ${locked}` : '\x1b[31mво весь бакет\x1b[0m'}`,
        )
      }

      /** клиент создаётся лениво и один раз: без настроек sdk и грузить незачем */
      let client: Promise<Sdk> | null = null
      const sdk = () => (client ??= loadSdk())

      async function loadSdk(): Promise<Sdk> {
        const s3 = await import('@aws-sdk/client-s3')
        const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
        const cli = new s3.S3Client({
          endpoint,
          region: region || 'garage',
          credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
          forcePathStyle: true,
          // БЕЗ ЭТОГО ПОДПИСАННЫЙ PUT НЕ ПРОЙДЁТ: свежий sdk кладёт в подпись
          // заголовки контрольной суммы, а браузер её не считает — хранилище
          // отвечает 400 InvalidDigest
          requestChecksumCalculation: 'WHEN_REQUIRED',
        })
        return { s3, cli, getSignedUrl }
      }

      /** можно ли ТРОГАТЬ этот ключ, а не только смотреть на него */
      const writable = (key: string) => !locked || key.startsWith(locked)

      /** ключ как есть, а для папки — все ключи под ней */
      async function expand({ cli, s3 }: Sdk, key: string): Promise<Array<string>> {
        if (!key.endsWith('/')) return [key]
        const out: Array<string> = []
        let token: string | undefined
        do {
          const page = await cli.send(
            new s3.ListObjectsV2Command({ Bucket: bucket, Prefix: key, ContinuationToken: token }),
          )
          for (const o of page.Contents ?? []) if (o.Key) out.push(o.Key)
          token = page.IsTruncated ? page.NextContinuationToken : undefined
        } while (token)
        return out
      }

      async function copy({ cli, s3 }: Sdk, from: string, to: string) {
        await cli.send(
          new s3.CopyObjectCommand({
            Bucket: bucket,
            // CopySource кодируем ПОСЕГМЕНТНО: целиком через encodeURIComponent
            // слэши превращаются в %2F, и часть хранилищ такой источник не найдёт
            CopySource: [bucket!, ...from.split('/')].map(encodeURIComponent).join('/'),
            Key: to,
          }),
        )
      }

      async function removeAll({ cli, s3 }: Sdk, keys: Array<string>) {
        // за раз хранилище принимает тысячу ключей — режем пачками
        for (let i = 0; i < keys.length; i += 1000) {
          await cli.send(
            new s3.DeleteObjectsCommand({
              Bucket: bucket,
              Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })) },
            }),
          )
        }
      }

      const route = (path: string, handler: Handler) =>
        server.middlewares.use(path, async (req, res) => {
          res.setHeader('content-type', 'application/json')
          if (!ready) {
            res.statusCode = 503
            return res.end(JSON.stringify({ error: 'дев-подпись не настроена: заполни S3_* в .env' }))
          }
          try {
            const body = req.method === 'GET' ? {} : JSON.parse((await text(req)) || '{}')
            const url = new URL(req.url ?? '/', 'http://x')
            const out = await handler({ body, query: url.searchParams, sdk: await sdk() })
            res.end(JSON.stringify(out ?? {}))
          } catch (err) {
            res.statusCode = err instanceof Denied ? 403 : 500
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
          }
        })

      /** чем показывать объект: публичным адресом, если он есть, иначе подписью */
      const linkOf = async ({ cli, s3, getSignedUrl }: Sdk, key: string) =>
        web
          ? `${web}/${key.split('/').map(encodeURIComponent).join('/')}`
          : await getSignedUrl(cli, new s3.GetObjectCommand({ Bucket: bucket, Key: key }), {
              expiresIn: 300,
            })

      /* ── подпись на заливку: её зовут и галерея, и файндер ─────────────── */
      route('/api/sign', async ({ body, sdk: { cli, s3, getSignedUrl } }) => {
        const { name = 'file', type = 'application/octet-stream', prefix } = body
        // чистим имя, но с флагом `u`: без него `\w` не знает кириллицы и
        // «проба.png» превращается в «_.png»
        const safe = String(name).replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 120)
        // без папки — в общую дев-кучу с меткой времени, чтобы имена не бились;
        // с папкой — под своим именем, файндер показывает именно её содержимое
        const key = prefix ? `${prefix}${safe}` : `${PREFIX}${Date.now()}-${safe}`
        guard(key, writable, locked)
        const url = await getSignedUrl(
          cli,
          new s3.PutObjectCommand({ Bucket: bucket, Key: key, ContentType: type }),
          { expiresIn: 300 },
        )
        return {
          url,
          key,
          headers: { 'Content-Type': type },
          publicUrl: web ? `${web}/${key}` : undefined,
        }
      })

      /* ── заливка ЧЕРЕЗ СЕРВЕР: файл телом запроса ─────────────────────── */
      server.middlewares.use('/api/s3/upload', async (req, res) => {
        res.setHeader('content-type', 'application/json')
        if (!ready) {
          res.statusCode = 503
          return res.end(JSON.stringify({ error: 'дев-подпись не настроена: заполни S3_* в .env' }))
        }
        try {
          const url = new URL(req.url ?? '/', 'http://x')
          const prefix = url.searchParams.get('prefix') ?? ''
          const name = url.searchParams.get('name') ?? 'file'
          const type = req.headers['content-type'] || 'application/octet-stream'

          // имя чистим с флагом `u`: без него \w не знает кириллицы
          const safe = String(name).replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 120)
          const key = `${prefix}${safe}`
          guard(key, writable, locked)

          // тело копим в память: дев-ручка, файлы тут ручные. Для настоящего
          // сервера сюда просится стрим прямо в Upload из @aws-sdk/lib-storage
          const parts: Array<Buffer> = []
          for await (const chunk of req) parts.push(chunk as Buffer)
          const body = Buffer.concat(parts)

          const { cli, s3 } = await sdk()
          await cli.send(
            new s3.PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: type }),
          )
          res.end(JSON.stringify({ key, publicUrl: web ? `${web}/${key}` : undefined }))
        } catch (err) {
          res.statusCode = err instanceof Denied ? 403 : 500
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
        }
      })

      /* ── что лежит в папке ─────────────────────────────────────────────── */
      route('/api/s3/list', async ({ query, sdk: kit }) => {
        const prefix = query.get('prefix') ?? ''
        const { cli, s3 } = kit
        const entries: Array<Record<string, unknown>> = []
        let token: string | undefined

        do {
          const page = await cli.send(
            new s3.ListObjectsV2Command({
              Bucket: bucket,
              Prefix: prefix,
              // разделитель — то, из-за чего S3 вообще похож на дерево: ключи
              // глубже текущего уровня схлопываются в CommonPrefixes
              Delimiter: '/',
              ContinuationToken: token,
              MaxKeys: 1000,
            }),
          )
          for (const p of page.CommonPrefixes ?? []) {
            if (!p.Prefix) continue
            entries.push({ key: p.Prefix, name: trimName(p.Prefix), dir: true })
          }
          for (const o of page.Contents ?? []) {
            // сама папка приезжает объектом нулевого размера — показывать её
            // внутри себя же незачем
            if (!o.Key || o.Key === prefix || o.Key.endsWith('/')) continue
            entries.push({
              key: o.Key,
              name: trimName(o.Key),
              size: o.Size ?? 0,
              modified: o.LastModified ? new Date(o.LastModified).getTime() : undefined,
              url: await linkOf(kit, o.Key),
            })
          }
          token = page.IsTruncated ? page.NextContinuationToken : undefined
          // страховка от бакета на миллион ключей: витрина не файловый архив
          if (entries.length > 4000) break
        } while (token)

        return { entries, writable: writable(prefix) }
      })

      /* ── всё дерево папок разом, с весом каждой ────────────────────────── */
      route('/api/s3/tree', async ({ sdk: { cli, s3 } }) => {
        // ОДИН проход без `Delimiter`: получаем все ключи и выводим папки
        // арифметикой. Дешевле, чем спрашивать каждую ветку по клику, и заодно
        // даёт то, чего плоский листинг не даёт вовсе, — вес папки.
        const acc = new Map<string, { size: number; count: number }>()
        let token: string | undefined
        let scanned = 0
        do {
          const page = await cli.send(
            new s3.ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token, MaxKeys: 1000 }),
          )
          for (const o of page.Contents ?? []) {
            if (!o.Key) continue
            scanned++
            const size = o.Size ?? 0
            const file = !o.Key.endsWith('/')
            // ключ вкладывается в КАЖДОГО своего предка: `a/b/c.jpg` — в `a/b/`
            // и в `a/`, иначе вес папки считал бы только её собственные файлы
            let cut = o.Key.indexOf('/')
            while (cut >= 0) {
              const prefix = o.Key.slice(0, cut + 1)
              const was = acc.get(prefix) ?? { size: 0, count: 0 }
              was.size += size
              if (file) was.count++
              acc.set(prefix, was)
              cut = o.Key.indexOf('/', cut + 1)
            }
          }
          token = page.IsTruncated ? page.NextContinuationToken : undefined
        } while (token)

        return {
          scanned,
          entries: [...acc].map(([key, v]) => ({
            key,
            name: key.slice(0, -1).slice(key.slice(0, -1).lastIndexOf('/') + 1),
            dir: true,
            size: v.size,
            count: v.count,
          })),
        }
      })

      /* ── удаление ──────────────────────────────────────────────────────── */
      route('/api/s3/delete', async ({ body, sdk: kit }) => {
        const keys: Array<string> = body.keys ?? []
        for (const k of keys) guard(k, writable, locked)
        // папка удаляется вместе с содержимым: пустых папок в S3 не бывает,
        // и «удалить папку, оставив файлы» означало бы осиротить их навсегда
        const flat = (await Promise.all(keys.map((k) => expand(kit, k)))).flat()
        await removeAll(kit, flat)
        return { removed: flat.length }
      })

      /* ── перенос ───────────────────────────────────────────────────────── */
      route('/api/s3/move', async ({ body, sdk: kit }) => {
        const keys: Array<string> = body.keys ?? []
        const to: string = body.to ?? ''
        guard(to || PREFIX, writable, locked)
        for (const k of keys) guard(k, writable, locked)

        let moved = 0
        for (const key of keys) {
          // папка переезжает вместе с именем: `a/фото/` в `b/` даёт `b/фото/...`,
          // поэтому от каждого ключа отрезаем путь ДО имени папки, а не всю её
          const cut = key.endsWith('/') ? key.slice(0, -1).lastIndexOf('/') + 1 : 0
          const under = await expand(kit, key)
          for (const from of under) {
            const tail = key.endsWith('/') ? from.slice(cut) : tailOf(from)
            const dest = `${to}${tail}`
            guard(dest, writable, locked)
            if (dest === from) continue
            await copy(kit, from, dest)
            moved++
          }
          await removeAll(kit, under.filter((k) => `${to}${key.endsWith('/') ? k.slice(cut) : tailOf(k)}` !== k))
        }
        return { moved }
      })

      /* ── новая папка ───────────────────────────────────────────────────── */
      route('/api/s3/mkdir', async ({ body, sdk: { cli, s3 } }) => {
        const prefix: string = body.prefix ?? ''
        guard(prefix, writable, locked)
        // папка в S3 — это соглашение, а не сущность; кладём пустой объект с
        // ключом на `/`, иначе только что созданная папка не покажется в списке
        await cli.send(new s3.PutObjectCommand({ Bucket: bucket, Key: prefix, Body: '' }))
        return { ok: true }
      })

    },
  }
}

/* ────────── мелочи ────────── */

type Sdk = {
  s3: typeof import('@aws-sdk/client-s3')
  cli: import('@aws-sdk/client-s3').S3Client
  getSignedUrl: typeof import('@aws-sdk/s3-request-presigner').getSignedUrl
}

type Handler = (ctx: {
  body: Record<string, never>
  query: URLSearchParams
  sdk: Sdk
}) => Promise<unknown>

class Denied extends Error {}

function guard(key: string, writable: (k: string) => boolean, locked: string) {
  if (!writable(key)) throw new Denied(`S3_DEV_LOCK: писать можно только в ${locked}`)
}

const trimName = (key: string) => {
  const clean = key.endsWith('/') ? key.slice(0, -1) : key
  return clean.slice(clean.lastIndexOf('/') + 1)
}

const tailOf = (key: string) => key.slice(key.lastIndexOf('/') + 1)

async function text(req: Connect.IncomingMessage): Promise<string> {
  let body = ''
  for await (const chunk of req) body += chunk
  return body
}
