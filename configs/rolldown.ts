// ПРОТОТИП сборки пакетов на Rolldown — для замера против tsup.
//
// Повторяет то, что делает `configs/tsup.ts`, включая главную тонкость: пакет
// отдаёт ДВА варианта кода.
//
//   dist/index.js   JSX уже скомпилирован (обычный `import`)
//   dist/index.jsx  JSX НЕ тронут — условие экспорта `solid`
//
// Второй нужен потому, что кит линкуется с solid-js ПОТРЕБИТЕЛЯ: его сборщик
// сам компилирует JSX своим `vite-plugin-solid`, и только так работает SSR.
// Скомпилированный у нас код на сервере не исполнить.
//
// Типы собирает `rolldown-plugin-dts` — он, в отличие от вкомпилированного в
// tsup `rollup-plugin-dts@6.1.1`, понимает TypeScript 7.

import { existsSync } from 'node:fs'
import { defineConfig } from 'rolldown'
import { dts } from 'rolldown-plugin-dts'

const entry = existsSync('src/index.tsx') ? 'src/index.tsx' : 'src/index.ts'

/** соседей по киту вкомпилируем — причина та же, что в configs/tsup.ts */
const external = [/^solid-js/, /^@tanstack/, /^@solid-primitives/, /^fflate/, /^slug/, /^valibot/]

export default defineConfig([
  // 1. рабочий вариант: JSX скомпилирован
  {
    input: entry,
    external,
    output: { dir: 'dist', format: 'esm', entryFileNames: 'index.js' },
    transform: { jsx: { runtime: 'automatic', importSource: 'solid-js' } },
  },
  // 2. типы отдельным проходом. `[name]` тут обязателен: с жёстким
  // `index.d.ts` плагин отдаёт ДВА чанка (заглушку и настоящие типы в
  // `index2.d.ts`), и `package.json` показывает на пустышку.
  {
    input: { index: entry },
    external,
    plugins: [dts({ emitDtsOnly: true })],
    output: { dir: 'dist', format: 'esm', entryFileNames: '[name].d.ts' },
  },
  // 3. вариант под условие `solid`: JSX остаётся как есть
  {
    input: entry,
    external,
    output: { dir: 'dist', format: 'esm', entryFileNames: 'index.jsx' },
    transform: { jsx: 'preserve' },
  },
])
