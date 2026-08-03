// Пути и сортировка — чистые функции: ни DOM, ни Solid, поэтому проверяются
// тестами напрямую.
//
// Единственное соглашение, из которого растёт всё остальное: ПАПКА — ЭТО КЛЮЧ,
// ЗАКАНЧИВАЮЩИЙСЯ НА `/`. У S3 никаких папок нет вовсе, есть общий префикс, и
// файндер эту же условность разделяет: `a/b/` — папка, `a/b` — файл. Отсюда и
// корень: пустая строка, а не `/`.

import type { FinderEntry } from './finderTypes'

/** имя без пути: `a/b/c.jpg` → `c.jpg`, `a/b/` → `b` */
export function nameOf(key: string): string {
  const clean = key.endsWith('/') ? key.slice(0, -1) : key
  const i = clean.lastIndexOf('/')
  return i < 0 ? clean : clean.slice(i + 1)
}

/** папка, в которой лежит ключ: `a/b/c.jpg` → `a/b/`, `a/` → `` */
export function parentOf(key: string): string {
  const clean = key.endsWith('/') ? key.slice(0, -1) : key
  const i = clean.lastIndexOf('/')
  return i < 0 ? '' : clean.slice(0, i + 1)
}

/** приписать имя к префиксу, не наплодив двойных слэшей */
export function joinPrefix(prefix: string, name: string): string {
  const base = !prefix || prefix.endsWith('/') ? prefix : `${prefix}/`
  return `${base}${name}`
}

/**
 * Хлебные крошки от корня до текущего места. Корень идёт первым всегда — по
 * нему возвращаются наверх, и он же цель для переноса «в самый верх».
 */
export function crumbs(prefix: string, rootLabel = 'Всё'): Array<{ name: string; prefix: string }> {
  const out = [{ name: rootLabel, prefix: '' }]
  let acc = ''
  for (const part of prefix.split('/')) {
    if (!part) continue
    acc += `${part}/`
    out.push({ name: part, prefix: acc })
  }
  return out
}

/**
 * Можно ли перенести ключ в префикс.
 *
 * Отказов ровно три, и все три — про здравый смысл, а не про хранилище:
 * на место, где он уже лежит; папку внутрь самой себя; папку внутрь своего же
 * потомка (иначе ветка уезжает сама в себя и пропадает).
 */
export function canMove(key: string, to: string): boolean {
  if (parentOf(key) === to) return false
  if (!key.endsWith('/')) return true
  return to !== key && !to.startsWith(key)
}

export type SortKey = 'name' | 'size' | 'modified'

/**
 * Порядок показа. Папки всегда сверху — даже при сортировке по размеру, у
 * которого для папки и значения-то нет; так делает любой файловый менеджер, и
 * ломать привычку незачем.
 *
 * Имена сравниваем `localeCompare` с `numeric`: иначе `файл10` встаёт перед
 * `файл2`, и это замечают сразу.
 */
export function sortEntries(
  entries: Array<FinderEntry>,
  key: SortKey = 'name',
  desc = false,
): Array<FinderEntry> {
  const dir = desc ? -1 : 1
  return [...entries].sort((a, b) => {
    if (!!a.dir !== !!b.dir) return a.dir ? -1 : 1
    if (key === 'size') return dir * ((a.size ?? 0) - (b.size ?? 0))
    if (key === 'modified') return dir * (stamp(a) - stamp(b))
    return dir * a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  })
}

const stamp = (e: FinderEntry): number => {
  if (e.modified === undefined) return 0
  const t = typeof e.modified === 'number' ? e.modified : Date.parse(e.modified)
  return Number.isNaN(t) ? 0 : t
}

export type FileKind = 'image' | 'video' | 'audio' | 'pdf' | 'archive' | 'text' | 'file'

const KINDS: Array<[FileKind, RegExp]> = [
  ['image', /\.(jpe?g|png|gif|webp|svg|avif|bmp|ico|heic)$/i],
  ['video', /\.(mp4|webm|mov|m4v|avi|mkv|ogv)$/i],
  ['audio', /\.(mp3|wav|ogg|flac|m4a|aac)$/i],
  ['pdf', /\.pdf$/i],
  ['archive', /\.(zip|rar|7z|tar|gz|bz2|xz)$/i],
  ['text', /\.(txt|md|json|ya?ml|csv|log|xml|html?|css|[jt]sx?)$/i],
]

export function kindOf(name: string): FileKind {
  for (const [kind, re] of KINDS) if (re.test(name)) return kind
  return 'file'
}

/** значок по виду файла: эмодзи, чтобы пакет не тащил иконочный шрифт */
export const ICONS: Record<FileKind | 'dir', string> = {
  dir: '📁',
  image: '🖼',
  video: '🎬',
  audio: '🎵',
  pdf: '📕',
  archive: '🗜',
  text: '📄',
  file: '📦',
}
