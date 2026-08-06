// MCP по HTTP: тот же сервер, но с чужой машины и без клона репы.
//
// Транспорт Streamable HTTP в простейшем его виде: клиент шлёт POST с одним
// сообщением JSON-RPC, сервер отвечает одним JSON. Сессий и SSE нет намеренно —
// на serverless каждый запрос попадает в свой инстанс, и держать между ними
// состояние всё равно нечем. Инструменты у нас без состояния, так что и не надо.
//
// Данные — из снимка (`mcp/snapshot.json`), собранного на сборке: диска с репой
// на хостинге нет. Сами инструменты общие с stdio-версией, см. `mcp/tools.mjs`.

import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fileSource, snapshotSource } from '../mcp/sources.mjs'
import { handle, INSTRUCTIONS, NAME, VERSION } from '../mcp/tools.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** источник переживает холодный старт: снимок читается один раз на инстанс */
let ready = null
async function source() {
  if (!ready) {
    ready = readFile(join(ROOT, 'mcp/snapshot.json'), 'utf8')
      .then((text) => snapshotSource(JSON.parse(text)))
      // Снимка нет — значит запустили локально, без сборки: читаем файлы репы.
      // Так `vercel dev` и обычный `node` ведут себя одинаково полезно.
      .catch(() => fileSource(ROOT))
  }
  return ready
}

const json = (res, status, body) => {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

export default async function handler(req, res) {
  // Клиенты MCP ходят с чужого источника, поэтому CORS обязателен, иначе
  // браузерный клиент даже до POST не доберётся.
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-headers', 'content-type, mcp-protocol-version, authorization')
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  const src = await source()

  // GET — для человека: открыл в браузере и видишь, что сервер жив и чем набит
  if (req.method === 'GET') {
    json(res, 200, {
      name: NAME,
      version: VERSION,
      transport: 'streamable-http',
      instructions: INSTRUCTIONS,
      snapshot: src.kind === 'snapshot' ? src.meta : { kind: 'файлы репы' },
      connect: `claude mcp add --transport http solid-dumb-kit <адрес этой страницы>`,
    })
    return
  }

  if (req.method !== 'POST') {
    json(res, 405, { error: 'только POST' })
    return
  }

  let body = req.body
  if (typeof body === 'string') body = JSON.parse(body)
  if (!body) {
    // Vercel разбирает тело сам, но при нестандартном content-type — нет
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  }

  // клиент вправе прислать пачку сообщений; отвечаем такой же пачкой
  const batch = Array.isArray(body) ? body : [body]
  const answers = []
  for (const request of batch) {
    try {
      const result = await handle(src, request)
      if (result !== null && request.id !== undefined) {
        answers.push({ jsonrpc: '2.0', id: request.id, result })
      }
    } catch (error) {
      if (request.id !== undefined) {
        answers.push({
          jsonrpc: '2.0',
          id: request.id,
          error: { code: error?.code ?? -32603, message: error?.message ?? 'внутренняя ошибка' },
        })
      }
    }
  }

  // на одни уведомления ответа не бывает — 202 без тела
  if (!answers.length) {
    res.statusCode = 202
    res.end()
    return
  }
  json(res, 200, Array.isArray(body) ? answers : answers[0])
}
