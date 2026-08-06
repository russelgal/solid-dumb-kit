#!/usr/bin/env node
// MCP-сервер кита по stdio: чем он умеет пользоваться и по каким правилам.
//
// Зачем. Кит потребляется из соседних проектов (bluefable и дальше), и агенту
// там нужно знать не «какие файлы лежат в репозитории», а конкретное: какие
// пакеты есть, какие у компонента пропсы, как выглядит рабочий пример и что в
// этой репе делать запрещено. Читать ради этого весь исходник — дорого и
// ненадёжно: половина ответа окажется выдумкой по мотивам имён файлов.
//
// Почему без единой зависимости. Сервер запускают там, где `node_modules` кита
// может не быть вовсе (чужой проект, cron, чистая машина). MCP по stdio — это
// JSON-RPC 2.0 строками, и его целиком видно в этом файле: сто строк транспорта
// против дерева пакетов, которое пришлось бы ставить и обновлять.
//
// Сами инструменты — в `tools.mjs`: тот же набор отвечает и по HTTP на
// хостинге (`api/mcp.mjs`). Здесь только транспорт и источник данных.
//
// Запуск: `node mcp/server.mjs` из любой директории; корень репы вычисляется от
// расположения файла. Подключение — см. mcp/README.md.

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fileSource } from './sources.mjs'
import { handle } from './tools.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = fileSource(ROOT)

/** stdout занят протоколом — всё человеческое уходит в stderr */
const log = (...args) => console.error('[mcp]', ...args)

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

let buffer = ''
/** очередь строк и признак «обработчик уже крутится» */
const queue = []
let busy = false
let closed = false

async function drain() {
  if (busy) return
  busy = true
  while (queue.length) {
    const request = queue.shift()
    try {
      const result = await handle(source, request)
      // уведомления (без id) ответа не требуют
      if (result !== null && request.id !== undefined) {
        send({ jsonrpc: '2.0', id: request.id, result })
      }
    } catch (error) {
      if (request.id !== undefined) {
        send({
          jsonrpc: '2.0',
          id: request.id,
          error: { code: error?.code ?? -32603, message: error?.message ?? 'внутренняя ошибка' },
        })
      }
    }
  }
  busy = false
  // stdin закрыли, пока мы отвечали, — теперь работа кончилась по-настоящему
  if (closed) process.exit(0)
}

process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  buffer += chunk
  // одно сообщение — одна строка; хвост без перевода строки ждёт продолжения
  const lines = buffer.split('\n')
  buffer = lines.pop() ?? ''
  for (const line of lines) {
    const text = line.trim()
    if (!text) continue
    try {
      queue.push(JSON.parse(text))
    } catch {
      log('не разобрал строку:', text.slice(0, 120))
    }
  }
  // Обработка ПОСЛЕДОВАТЕЛЬНАЯ, и выход — только когда очередь пуста. Иначе
  // `process.exit` по концу ввода убивал бы ответы, до которых дело ещё не
  // дошло: инструменты читают файлы, то есть отвечают не в том же тике.
  void drain()
})

process.stdin.on('end', () => {
  closed = true
  if (!busy && !queue.length) process.exit(0)
  void drain()
})

log(`solid-dumb-kit готов, корень ${ROOT}`)
