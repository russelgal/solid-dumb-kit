// Версия пакета и дата его последней правки — для шапки витрины.
//
// Считается НА СБОРКЕ, в Node: версия читается из `package.json` пакета, дата —
// из git (`git log -1` по его каталогу). В браузер уезжает готовая табличка,
// ни git, ни файловой системы там не нужно.
//
// Дата берётся по КАТАЛОГУ пакета, а не по всей репе: правка в витрине не
// должна выглядеть как обновление двадцати двух компонентов сразу.
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

const ID = 'virtual:kit-meta'
const RESOLVED = `\0${ID}`

export type PackageMeta = {
  /** версия из package.json пакета */
  version: string
  /** ISO-дата последнего коммита, тронувшего каталог пакета; null — git недоступен */
  updated: string | null
}

/**
 * Дата последнего коммита по каталогу. На Vercel клон неглубокий, и история
 * может быть усечена — тогда получаем пустую строку и честно отдаём `null`,
 * вместо того чтобы показывать дату сборки под видом даты правки.
 */
function lastCommit(root: string, dir: string): string | null {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', dir], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return out || null
  } catch {
    return null
  }
}

export function kitMeta(root: string): Plugin {
  return {
    name: 'dumb-kit-meta',

    resolveId(id) {
      return id === ID ? RESOLVED : null
    },

    load(id) {
      if (id !== RESOLVED) return null

      const dir = join(root, 'packages')
      const meta: Record<string, PackageMeta> = {}

      for (const name of readdirSync(dir)) {
        let version = ''
        try {
          version = JSON.parse(readFileSync(join(dir, name, 'package.json'), 'utf8')).version ?? ''
        } catch {
          continue // не пакет
        }
        meta[name] = { version, updated: lastCommit(root, `packages/${name}`) }
      }

      return `export default ${JSON.stringify(meta)}`
    },
  }
}
