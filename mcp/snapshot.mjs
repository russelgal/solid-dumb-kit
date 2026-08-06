#!/usr/bin/env node
// Снимок репы для хостинга: один JSON, из которого сервер отвечает без диска.
//
// На Vercel файлов репы рядом с функцией нет — в бандл попадает только то, что
// в него положили. Класть весь репозиторий бессмысленно (там `dist`, тесты,
// история), поэтому кладём ровно то, из чего сервер строит ответы: исходники
// пакетов, их манифесты, примеры, обе версии доков и правила.
//
// Собирается на сборке (`vercel.json` → buildCommand), в гит не коммитится:
// снимок — производная, а производные в репе разъезжаются с оригиналом.
//
// Запуск: `node mcp/snapshot.mjs [куда.json]`

import { readFile, readdir, stat, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(process.argv[2] ?? join(ROOT, 'mcp/snapshot.json'))

/** что берём: путь → какие файлы внутри интересны */
const WANTED = [
  { dir: 'packages', match: (p) => /\.(ts|tsx)$/.test(p) || p.endsWith('package.json') },
  { dir: 'examples', match: (p) => p.endsWith('.tsx') },
  { dir: 'docs', match: (p) => p.endsWith('.md') },
]
/** отдельные файлы из корня */
const SINGLES = ['CLAUDE.md', 'README.md', 'README.ru.md', 'CHANGELOG.md']
/** что не нужно никогда: собранное и тесты */
const SKIP_DIR = new Set(['node_modules', 'dist', 'test', '__tests__'])

const files = {}

async function walk(dir, match) {
  for (const entry of await readdir(join(ROOT, dir)).catch(() => [])) {
    if (SKIP_DIR.has(entry) || entry.startsWith('.')) continue
    const path = `${dir}/${entry}`
    const info = await stat(join(ROOT, path)).catch(() => null)
    if (!info) continue
    if (info.isDirectory()) await walk(path, match)
    else if (match(path)) files[path] = await readFile(join(ROOT, path), 'utf8')
  }
}

for (const { dir, match } of WANTED) await walk(dir, match)
for (const path of SINGLES) {
  const text = await readFile(join(ROOT, path), 'utf8').catch(() => null)
  if (text !== null) files[path] = text
}

const snapshot = {
  meta: {
    // на Vercel коммит приезжает переменной окружения; локально спрашивать git
    // незачем — снимок всё равно пересобирается на каждой сборке
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    built: new Date().toISOString(),
    files: Object.keys(files).length,
  },
  files,
}

await mkdir(dirname(OUT), { recursive: true })
await writeFile(OUT, JSON.stringify(snapshot))

const bytes = Object.values(files).reduce((sum, text) => sum + text.length, 0)
console.log(
  `снимок: ${snapshot.meta.files} файлов, ${(bytes / 1024 / 1024).toFixed(2)} МБ → ${OUT}`,
)
