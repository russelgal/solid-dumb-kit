// Инструменты сервера — то, что агент может спросить о ките.
//
// Живут отдельно от транспорта: один и тот же набор отвечает и по stdio
// (`server.mjs`, рядом с рабочей копией), и по HTTP (`api/mcp.mjs`, на
// хостинге). Источник данных передаётся снаружи, см. `sources.mjs`.

export const NAME = 'solid-dumb-kit'
export const VERSION = '0.2.0'
/** сколько текста отдавать за раз: дальше ответ только засоряет контекст */
export const LIMIT = 40_000

export const cut = (text) =>
  text.length > LIMIT ? `${text.slice(0, LIMIT)}\n\n… обрезано на ${LIMIT} символах` : text

/* ── разбор исходников ───────────────────────────────────────────────────── */

/**
 * Блок типа целиком, вместе с JSDoc над ним. Разбирать TypeScript ради этого
 * незачем: типы в ките пишутся руками и всегда кончаются `}` в первой колонке,
 * а комментарии над полями — самое ценное, что в них есть.
 */
export function extractType(source, typeName) {
  // Работаем строками, а не смещениями в тексте: со смещениями тут же
  // наживаешь ошибку на единицу и отдаёшь тип без первой буквы.
  const lines = source.split('\n')
  // `type` и `interface` вперемешку: в ките пишут и так и так, а спрашивающему
  // разница безразлична — ему нужны поля с комментариями
  const decl = new RegExp(`^export (?:type|interface) ${typeName}\\b`)
  const at = lines.findIndex((line) => decl.test(line))
  if (at < 0) return null
  // прихватываем комментарий над объявлением — в нём всё самое ценное
  let head = at
  while (head > 0 && /^\s*(\/\*\*|\*|\*\/|\/\/)/.test(lines[head - 1])) head--
  let end = at + 1
  while (end < lines.length && !/^\}/.test(lines[end])) end++
  return lines.slice(head, Math.min(end + 1, lines.length)).join('\n')
}

/** пакеты кита: имя, версия, описание и путь к исходникам */
async function packages(src) {
  const out = []
  for (const dir of (await src.list('packages')).sort()) {
    const manifest = await src.read(`packages/${dir}/package.json`)
    if (!manifest) continue
    try {
      const pkg = JSON.parse(manifest)
      const tsx = await src.read(`packages/${dir}/src/index.tsx`)
      out.push({
        dir,
        name: pkg.name,
        version: pkg.version,
        description: pkg.description ?? '',
        entry: `packages/${dir}/src/index.${tsx ? 'tsx' : 'ts'}`,
      })
    } catch {
      // битый манифест — не повод ронять весь список
    }
  }
  return out
}

/** пакет по имени: принимает и `table`, и `@solid-dumb-kit/table` */
async function findPackage(src, query) {
  const all = await packages(src)
  const want = String(query ?? '').replace('@solid-dumb-kit/', '').trim()
  return all.find((p) => p.dir === want || p.name === query) ?? null
}

/** все примеры витрины */
async function examples(src) {
  const out = []
  for (const group of await src.list('examples')) {
    for (const file of await src.list(`examples/${group}`)) {
      if (file.endsWith('.example.tsx')) out.push(`examples/${group}/${file}`)
    }
  }
  return out.sort()
}

/* ── сами инструменты ────────────────────────────────────────────────────── */

export const TOOLS = [
  {
    name: 'list_packages',
    description:
      'Все пакеты кита: имя, версия, за что отвечает. Первое, что стоит спросить, ' +
      'когда неизвестно, есть ли в ките нужный компонент.',
    inputSchema: { type: 'object', properties: {} },
    run: async (src) => {
      const all = await packages(src)
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
    run: async (src, { package: name }) => {
      const pkg = await findPackage(src, name)
      if (!pkg) return `Пакета «${name}» нет. Спроси list_packages.`
      return `// ${pkg.entry}\n\n${await src.read(pkg.entry)}`
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
      properties: {
        name: { type: 'string', description: 'DumbTimeline, DumbTimelineProps, RowQuery …' },
      },
      required: ['name'],
    },
    run: async (src, { name }) => {
      const asked = String(name)
      // сперва как попросили, потом с суффиксом: `DumbTimeline` — это компонент,
      // а тип у него `DumbTimelineProps`, и спрашивают обычно первым именем
      const tries = asked.endsWith('Props') ? [asked] : [asked, `${asked}Props`]
      const files = await src.files()
      for (const want of tries) {
        for (const file of files) {
          const source = await src.read(file)
          if (!source) continue
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
    run: async (src, { name }) => {
      const files = await examples(src)
      if (!name) return files.join('\n')
      const want = String(name).toLowerCase().replace('.example.tsx', '')
      const hit = files.find((f) => f.toLowerCase().includes(want))
      if (!hit) return `Примера «${name}» нет. Список:\n${files.join('\n')}`
      return `// ${hit}\n\n${await src.read(hit)}`
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
        page: { type: 'string', description: 'DumbTimeline, utils, Virtual …' },
        lang: { type: 'string', enum: ['en', 'ru'], description: 'по умолчанию ru' },
      },
    },
    run: async (src, { page, lang }) => {
      const dir = lang === 'en' ? 'docs' : 'docs/ru'
      const pages = (await src.list(dir)).filter((f) => f.endsWith('.md')).sort()
      if (!page) return pages.join('\n')
      const want = String(page).toLowerCase().replace('.md', '')
      const hit =
        pages.find((f) => f.toLowerCase().replace('.md', '') === want) ??
        pages.find((f) => f.toLowerCase().includes(want))
      if (!hit) return `Страницы «${page}» нет. Список:\n${pages.join('\n')}`
      return await src.read(`${dir}/${hit}`)
    },
  },
  {
    name: 'rules',
    description:
      'Железные правила репы: чего в ките делать нельзя (замеры layout на горячем ' +
      'пути, импорты, которых нет в Solid 2, еле видимые тексты) и почему. ' +
      'Читать ДО того, как писать код с китом или для кита.',
    inputSchema: { type: 'object', properties: {} },
    run: async (src) => {
      const md = (await src.read('CLAUDE.md')) ?? ''
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
    run: async (src, { query, where }) => {
      let re
      try {
        re = new RegExp(query, 'i')
      } catch {
        re = new RegExp(String(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      }
      const scope = where ?? 'all'
      const files = []
      if (scope === 'src' || scope === 'all') files.push(...(await src.files()))
      if (scope === 'examples' || scope === 'all') files.push(...(await examples(src)))
      if (scope === 'docs' || scope === 'all') {
        for (const dir of ['docs', 'docs/ru']) {
          for (const file of await src.list(dir)) {
            if (file.endsWith('.md')) files.push(`${dir}/${file}`)
          }
        }
      }
      const hits = []
      for (const file of files) {
        const source = (await src.read(file)) ?? ''
        source.split('\n').forEach((line, i) => {
          if (re.test(line)) hits.push(`${file}:${i + 1}: ${line.trim()}`)
        })
        if (hits.length > 400) break
      }
      return hits.length ? hits.slice(0, 400).join('\n') : `Ничего не нашлось по «${query}».`
    },
  },
]

/* ── обработка запросов протокола ────────────────────────────────────────── */

export const INSTRUCTIONS =
  'Знания о solid-dumb-kit: пакеты, пропсы компонентов, примеры, доки и ' +
  'железные правила репы. Начинай с list_packages и rules.'

/**
 * Один запрос JSON-RPC → результат (или `null` для уведомлений).
 * Транспорт снаружи: по stdio это строка в stdout, по HTTP — тело ответа.
 */
export async function handle(src, request) {
  const { method, params } = request

  if (method === 'initialize') {
    return {
      // подтверждаем версию, которую попросил клиент: протокол совместим вперёд,
      // а спорить о номере с более новым клиентом смысла нет
      protocolVersion: params?.protocolVersion ?? '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: NAME, version: VERSION },
      instructions: INSTRUCTIONS,
    }
  }
  if (method === 'ping') return {}
  if (method === 'tools/list') {
    return {
      tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
    }
  }
  if (method === 'tools/call') {
    const tool = TOOLS.find((t) => t.name === params?.name)
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Нет такого инструмента: ${params?.name}` }],
        isError: true,
      }
    }
    try {
      const text = await tool.run(src, params?.arguments ?? {})
      return { content: [{ type: 'text', text: cut(String(text)) }] }
    } catch (error) {
      // ошибка инструмента — это ответ модели, а не сбой протокола
      return {
        content: [{ type: 'text', text: `Ошибка: ${error?.message ?? error}` }],
        isError: true,
      }
    }
  }
  if (String(method).startsWith('notifications/')) return null // ответа не ждут

  const error = new Error(`Метод не поддержан: ${method}`)
  error.code = -32601
  throw error
}
