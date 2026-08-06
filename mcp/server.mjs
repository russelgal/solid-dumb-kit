#!/usr/bin/env node
// MCP-сервер кита: чем он умеет пользоваться и по каким правилам.
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
// Запуск: `node mcp/server.mjs` из любой директории; корень репы вычисляется от
// расположения файла. Подключение — см. mcp/README.md.

import { readFile, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const NAME = 'solid-dumb-kit'
const VERSION = '0.1.0'
/** сколько текста отдавать за раз: дальше ответ только засоряет контекст */
const LIMIT = 40_000

/* ── чтение репы ─────────────────────────────────────────────────────────── */

const cut = (text) =>
  text.length > LIMIT ? `${text.slice(0, LIMIT)}\n\n… обрезано на ${LIMIT} символах` : text

async function read(path) {
  return await readFile(join(ROOT, path), 'utf8')
}

async function listDir(path) {
  try {
    return await readdir(join(ROOT, path))
  } catch {
    return []
  }
}

/** пакеты кита: имя, версия, описание и путь к исходникам */
async function packages() {
  const names = (await listDir('packages')).sort()
  const out = []
  for (const dir of names) {
    const manifest = join('packages', dir, 'package.json')
    if (!existsSync(join(ROOT, manifest))) continue
    try {
      const pkg = JSON.parse(await read(manifest))
      out.push({
        dir,
        name: pkg.name,
        version: pkg.version,
        description: pkg.description ?? '',
        entry: existsSync(join(ROOT, 'packages', dir, 'src/index.tsx'))
          ? `packages/${dir}/src/index.tsx`
          : `packages/${dir}/src/index.ts`,
      })
    } catch {
      // битый манифест — не повод ронять весь список
    }
  }
  return out
}

/** пакет по имени: принимает и `table`, и `@solid-dumb-kit/table` */
async function findPackage(query) {
  const all = await packages()
  const want = String(query ?? '').replace('@solid-dumb-kit/', '').trim()
  return all.find((p) => p.dir === want || p.name === query) ?? null
}

/** все файлы с исходниками — по ним ищем типы и делаем поиск */
async function sourceFiles(dir = 'packages', acc = []) {
  for (const entry of await listDir(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue
    const path = join(dir, entry)
    const info = await stat(join(ROOT, path)).catch(() => null)
    if (!info) continue
    if (info.isDirectory()) await sourceFiles(path, acc)
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(path)
  }
  return acc
}

/**
 * Блок типа целиком, вместе с JSDoc над ним. Разбирать TypeScript ради этого
 * незачем: типы в ките пишутся руками и всегда кончаются `}` в первой колонке,
 * а комментарии над пропсами — самое ценное, что в них есть.
 */
function extractType(source, typeName) {
  // Работаем строками, а не смещениями в тексте: со смещениями тут же
  // наживаешь ошибку на единицу и отдаёшь тип без первой буквы.
  const lines = source.split('\n')
  const decl = new RegExp(`^export type ${typeName}\\b`)
  const at = lines.findIndex((line) => decl.test(line))
  if (at < 0) return null
  // прихватываем комментарий над объявлением — в нём всё самое ценное
  let head = at
  while (head > 0 && /^\s*(\/\*\*|\*|\*\/|\/\/)/.test(lines[head - 1])) head--
  let end = at + 1
  while (end < lines.length && !/^\}/.test(lines[end])) end++
  return lines.slice(head, Math.min(end + 1, lines.length)).join('\n')
}

/* ── инструменты ─────────────────────────────────────────────────────────── */

const TOOLS = [
  {
    name: 'list_packages',
    description:
      'Все пакеты кита: имя, версия, за что отвечает. Первое, что стоит спросить, ' +
      'когда неизвестно, есть ли в ките нужный компонент.',
    inputSchema: { type: 'object', properties: {} },
    run: async () => {
      const all = await packages()
      return all
        .map((p) => `${p.name}@${p.version}\n  ${p.description}\n  вход: ${p.entry}`)
        .join('\n\n')
    },
  },
  {
    name: 'package_api',
    description:
      'Публичный API пакета: барр-файл целиком. В ките он с комментариями к ' +
      'каждому экспорту — что это и когда нужно.',
    inputSchema: {
      type: 'object',
      properties: {
        package: { type: 'string', description: 'имя пакета: table или @solid-dumb-kit/table' },
      },
      required: ['package'],
    },
    run: async ({ package: name }) => {
      const pkg = await findPackage(name)
      if (!pkg) return `Пакета «${name}» нет. Спроси list_packages.`
      return `// ${pkg.entry}\n\n${await read(pkg.entry)}`
    },
  },
  {
    name: 'component_props',
    description:
      'Пропсы компонента с комментариями: тип целиком, как он написан в исходнике. ' +
      'Имя — компонента (DumbTimeline), его типа (DumbTimelineProps) или любого ' +
      'другого экспортированного типа кита (RowIndexOptions, VirtualRange).',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'DumbTimeline, DumbTimelineProps, RowQuery …' } },
      required: ['name'],
    },
    run: async ({ name }) => {
      const asked = String(name)
      // сперва как попросили, потом с суффиксом: `DumbTimeline` — это компонент,
      // а тип у него `DumbTimelineProps`, и спрашивают обычно первым именем
      const tries = asked.endsWith('Props') ? [asked] : [asked, `${asked}Props`]
      const files = await sourceFiles()
      for (const want of tries) {
        for (const file of files) {
          const source = await read(file)
          const block = extractType(source, want)
          if (block) return `// ${file}\n\n${block}`
        }
      }
      return `Типа «${tries.join('» и «')}» в пакетах нет. Проверь имя через list_packages и package_api.`
    },
  },
  {
    name: 'example',
    description:
      'Рабочий пример: без аргумента — список, с именем — исходник целиком. ' +
      'Примеры в ките держат в актуальном состоянии тестом, поэтому им можно верить ' +
      'больше, чем фрагментам из доков.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'DumbTimeline, virtual, utils …' } },
    },
    run: async ({ name }) => {
      const files = []
      for (const group of await listDir('examples')) {
        for (const file of await listDir(join('examples', group))) {
          if (file.endsWith('.example.tsx')) files.push(join('examples', group, file))
        }
      }
      if (!name) return files.sort().join('\n')
      const want = String(name).toLowerCase().replace('.example.tsx', '')
      const hit = files.find((f) => f.toLowerCase().includes(want))
      if (!hit) return `Примера «${name}» нет. Список:\n${files.sort().join('\n')}`
      return `// ${hit}\n\n${await read(hit)}`
    },
  },
  {
    name: 'docs',
    description:
      'Документация: без аргумента — список страниц, с именем — страница целиком. ' +
      'Есть две зеркальные версии, английская и русская.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'string', description: 'DumbTimeline, utils, Findings …' },
        lang: { type: 'string', enum: ['en', 'ru'], description: 'по умолчанию ru' },
      },
    },
    run: async ({ page, lang }) => {
      const dir = lang === 'en' ? 'docs' : 'docs/ru'
      const pages = (await listDir(dir)).filter((f) => f.endsWith('.md')).sort()
      if (!page) return pages.join('\n')
      const want = String(page).toLowerCase().replace('.md', '')
      const hit = pages.find((f) => f.toLowerCase().replace('.md', '') === want)
        ?? pages.find((f) => f.toLowerCase().includes(want))
      if (!hit) return `Страницы «${page}» нет. Список:\n${pages.join('\n')}`
      return await read(join(dir, hit))
    },
  },
  {
    name: 'rules',
    description:
      'Железные правила репы: чего в ките делать нельзя (замеры layout на горячем ' +
      'пути, импорты, которых нет в Solid 2, еле видимые тексты) и почему. ' +
      'Читать ДО того, как писать код с китом или для кита.',
    inputSchema: { type: 'object', properties: {} },
    run: async () => {
      const md = await read('CLAUDE.md')
      // берём разделы с железными правилами и соседние, объясняющие «почему»
      const sections = md.split(/\n(?=## )/)
      const keep = sections.filter((s) =>
        /ЖЕЛЕЗНОЕ ПРАВИЛО|ЦЕЛЬ №1|Слои|Пакетный менеджер|Версии/i.test(s.slice(0, 200)),
      )
      return keep.join('\n\n')
    },
  },
  {
    name: 'search',
    description:
      'Поиск по исходникам, примерам и докам: подстрока или регулярное выражение. ' +
      'Отдаёт файл, номер строки и саму строку.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'что ищем' },
        where: {
          type: 'string',
          enum: ['src', 'examples', 'docs', 'all'],
          description: 'по умолчанию all',
        },
      },
      required: ['query'],
    },
    run: async ({ query, where }) => {
      let re
      try {
        re = new RegExp(query, 'i')
      } catch {
        re = new RegExp(String(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      }
      const files = []
      const scope = where ?? 'all'
      if (scope === 'src' || scope === 'all') files.push(...(await sourceFiles()))
      if (scope === 'examples' || scope === 'all') {
        for (const group of await listDir('examples')) {
          for (const file of await listDir(join('examples', group))) {
            if (file.endsWith('.tsx')) files.push(join('examples', group, file))
          }
        }
      }
      if (scope === 'docs' || scope === 'all') {
        for (const dir of ['docs', 'docs/ru']) {
          for (const file of await listDir(dir)) {
            if (file.endsWith('.md')) files.push(join(dir, file))
          }
        }
      }
      const hits = []
      for (const file of files) {
        const source = await read(file).catch(() => '')
        source.split('\n').forEach((line, i) => {
          if (re.test(line)) hits.push(`${relative('.', file)}:${i + 1}: ${line.trim()}`)
        })
        if (hits.length > 400) break
      }
      return hits.length ? hits.slice(0, 400).join('\n') : `Ничего не нашлось по «${query}».`
    },
  },
]

/* ── транспорт: JSON-RPC 2.0 строками в stdin/stdout ─────────────────────── */

/** stdout занят протоколом — всё человеческое уходит в stderr */
const log = (...args) => console.error('[mcp]', ...args)

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

async function handle(request) {
  const { id, method, params } = request

  if (method === 'initialize') {
    return {
      // подтверждаем версию, которую попросил клиент: протокол совместим вперёд,
      // а спорить о номере с более новым клиентом смысла нет
      protocolVersion: params?.protocolVersion ?? '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: NAME, version: VERSION },
      instructions:
        'Знания о solid-dumb-kit: пакеты, пропсы компонентов, примеры, доки и ' +
        'железные правила репы. Начинай с list_packages и rules.',
    }
  }
  if (method === 'ping') return {}
  if (method === 'tools/list') {
    return {
      tools: TOOLS.map(({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema,
      })),
    }
  }
  if (method === 'tools/call') {
    const tool = TOOLS.find((t) => t.name === params?.name)
    if (!tool) {
      return { content: [{ type: 'text', text: `Нет такого инструмента: ${params?.name}` }], isError: true }
    }
    try {
      const text = await tool.run(params?.arguments ?? {})
      return { content: [{ type: 'text', text: cut(String(text)) }] }
    } catch (error) {
      // ошибка инструмента — это ответ модели, а не сбой протокола
      return { content: [{ type: 'text', text: `Ошибка: ${error?.message ?? error}` }], isError: true }
    }
  }
  if (String(method).startsWith('notifications/')) return null // ответа не ждут

  const error = new Error(`Метод не поддержан: ${method}`)
  error.code = -32601
  throw error
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
      const result = await handle(request)
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
