/**
 * Разбор объекта пропсов в плоский список строк для отладочной таблицы.
 *
 * Чистый TS без Solid: это же нужно и в тестах, и в логе, и на сервере.
 *
 * Зачем вообще: `JSON.stringify(props)` для отладки не годится — он МОЛЧА
 * выбрасывает функции и `undefined`, а у компонентов вроде шахматки почти всё
 * поведение и есть функции (`onOpen`, `spanClass`, `dayClass`). В дампе их
 * просто не было, и выглядело это как «проп не пришёл».
 */

export type DumpKind = 'object' | 'array' | 'function' | 'primitive'

export interface DumpRow {
  /** ключ на своём уровне: `scale`, `stepMin` */
  key: string
  /** полный путь от корня: `scale.stepMin` */
  path: string
  /** глубина вложенности, 0 — верхний уровень */
  depth: number
  /** `typeof` значения */
  type: string
  kind: DumpKind
  /** короткое человекочитаемое представление */
  value: string
  /** сырое значение — вдруг вызывающему нужно больше */
  raw: unknown
}

/** `ƒ apply(3)`, `Array(2133)`, `{first, days, …}`, `"текст"` */
export function describe(v: unknown): string {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  if (typeof v === 'function') {
    const f = v as (...a: unknown[]) => unknown
    return `ƒ ${f.name || 'anonymous'}(${f.length})`
  }
  if (Array.isArray(v)) return `Array(${v.length})`
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'object') {
    const keys = Object.keys(v as object)
    return `{${keys.slice(0, 6).join(', ')}${keys.length > 6 ? ', …' : ''}}`
  }
  if (typeof v === 'string') return JSON.stringify(v)
  return String(v)
}

const kindOf = (v: unknown): DumpKind =>
  typeof v === 'function'
    ? 'function'
    : Array.isArray(v)
      ? 'array'
      : v !== null && typeof v === 'object'
        ? 'object'
        : 'primitive'

/**
 * Порядок строк: сначала ВЛОЖЕННЫЕ (объекты и массивы — в них самое
 * интересное и их надо развернуть), потом функции, потом простые значения.
 * Внутри группы — по алфавиту, чтобы дамп не прыгал между перерисовками.
 */
const WEIGHT: Record<DumpKind, number> = { object: 0, array: 1, function: 2, primitive: 3 }

export interface DumpOptions {
  /** насколько глубоко разворачивать вложенные объекты; 0 — не разворачивать */
  depth?: number
  /** сколько элементов массива показывать; остальные схлопываются в «…» */
  maxItems?: number
  /** не раскрывать эти ключи верхнего уровня: `rows`, `spans` — там тысячи строк */
  skip?: string[]
}

/**
 * Плоский список строк с сохранением порядка «родитель → его дети».
 *
 * Ключи берутся с самого объекта: Solid объявляет пропсы перечислимыми
 * геттерами, поэтому `Object.keys` их видит, а чтение — обычное обращение к
 * свойству (то есть подписка на реактивность; для отладочной панели это норма,
 * в боевом коде так делать нельзя).
 */
export function dumpProps(source: object, options: DumpOptions = {}): DumpRow[] {
  const maxDepth = options.depth ?? 1
  const maxItems = options.maxItems ?? 8
  const skip = new Set(options.skip ?? [])
  const out: DumpRow[] = []
  // защита от циклов: props → style → props и подобное
  const seen = new WeakSet<object>()

  const walk = (obj: object, depth: number, prefix: string) => {
    const entries = Object.keys(obj).map((key) => {
      let raw: unknown
      try {
        raw = (obj as Record<string, unknown>)[key]
      } catch (e) {
        // геттер может бросить (у Solid — чтение вне провайдера и т.п.)
        raw = `‹ошибка чтения: ${(e as Error)?.message ?? e}›`
      }
      return { key, raw, kind: kindOf(raw) }
    })

    entries.sort((a, b) => WEIGHT[a.kind] - WEIGHT[b.kind] || a.key.localeCompare(b.key))

    for (const e of entries) {
      const path = prefix ? `${prefix}.${e.key}` : e.key
      out.push({
        key: e.key,
        path,
        depth,
        type: typeof e.raw,
        kind: e.kind,
        value: describe(e.raw),
        raw: e.raw,
      })

      if (depth >= maxDepth || skip.has(path) || skip.has(e.key)) continue
      if (e.kind !== 'object' && e.kind !== 'array') continue
      const child = e.raw as object
      if (seen.has(child)) continue
      seen.add(child)

      if (e.kind === 'array') {
        const arr = child as unknown[]
        for (let i = 0; i < Math.min(arr.length, maxItems); i++) {
          const item = arr[i]
          out.push({
            key: `[${i}]`,
            path: `${path}[${i}]`,
            depth: depth + 1,
            type: typeof item,
            kind: kindOf(item),
            value: describe(item),
            raw: item,
          })
        }
        if (arr.length > maxItems) {
          out.push({
            key: `…ещё ${arr.length - maxItems}`,
            path: `${path}[…]`,
            depth: depth + 1,
            type: 'array',
            kind: 'primitive',
            value: '',
            raw: undefined,
          })
        }
        continue
      }

      walk(child, depth + 1, path)
    }
  }

  walk(source, 0, '')
  return out
}
