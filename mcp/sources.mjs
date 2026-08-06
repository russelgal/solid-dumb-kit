// Откуда сервер берёт знания: с диска или из снимка.
//
// Их два, потому что запускается он в двух местах. Локально — рядом с рабочей
// копией, и тогда честнее читать файлы: видны невыпущенные правки и текущая
// ветка. На хостинге диска с репой нет вовсе, там едет снимок — один JSON,
// собранный при сборке (`mcp/snapshot.mjs`).
//
// Инструменты про эту разницу не знают: они получают источник и зовут у него
// три метода. Иначе через месяц это были бы два разных сервера с разными
// ответами на один вопрос.

import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

/** Файлы репы с диска. */
export function fileSource(root) {
  const cache = new Map()

  async function list(dir) {
    try {
      return await readdir(join(root, dir))
    } catch {
      return []
    }
  }

  async function read(path) {
    if (cache.has(path)) return cache.get(path)
    let text = null
    try {
      text = await readFile(join(root, path), 'utf8')
    } catch {
      text = null
    }
    cache.set(path, text)
    return text
  }

  /** все исходники пакетов — по ним ищутся типы и идёт поиск */
  async function files(dir = 'packages', acc = []) {
    for (const entry of await list(dir)) {
      if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue
      const path = `${dir}/${entry}`
      const info = await stat(join(root, path)).catch(() => null)
      if (!info) continue
      if (info.isDirectory()) await files(path, acc)
      else if (/\.(ts|tsx)$/.test(entry)) acc.push(path)
    }
    return acc
  }

  return { kind: 'file', root, list, read, files }
}

/**
 * Снимок: `{ files: { путь: содержимое } }`.
 *
 * Список каталога вычисляется из путей, а не хранится отдельно: одно и то же
 * знание в двух местах разъезжается молча.
 */
export function snapshotSource(snapshot) {
  const files = snapshot.files ?? {}
  const paths = Object.keys(files)

  const list = async (dir) => {
    const prefix = dir.endsWith('/') ? dir : `${dir}/`
    const out = new Set()
    for (const path of paths) {
      if (!path.startsWith(prefix)) continue
      out.add(path.slice(prefix.length).split('/')[0])
    }
    return [...out]
  }

  return {
    kind: 'snapshot',
    meta: snapshot.meta ?? {},
    list,
    read: async (path) => files[path] ?? null,
    files: async () => paths.filter((p) => p.startsWith('packages/') && /\.(ts|tsx)$/.test(p)),
  }
}
