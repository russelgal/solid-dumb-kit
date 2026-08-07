import { createRequire } from 'node:module'
import { defineConfig } from 'vitest/config'
import solid from 'vite-plugin-solid'

/** какая линия Solid стоит в репе: от неё зависит адрес рендера */
const solid2 = createRequire(import.meta.url)('solid-js/package.json').version.startsWith('2.')

// Плагин solid нужен только смоук-тестам примеров (они на JSX); утилитам — happy-dom.
export default defineConfig({
  plugins: [solid()],
  resolve: {
    // Solid 2 разобран на пакеты: рендера по адресу solid-js/web там больше нет
    // вовсе («"./web" is not exported»), он переехал в @solidjs/web, а
    // реактивность — в @solidjs/signals.
    //
    // Самого кита это не касается: внутри пакетов сабпуть запрещён правилом
    // репы и не встречается. А вот тестам и витрине нужен render, и чтобы не
    // править полтора десятка файлов при каждой смене линии, подмена делается
    // здесь — одним алиасом. Стоит в репе Solid 2 — тесты идут на нём.
    //
    // Комментарий строчный не случайно: в блочном путь вида packages/<звёздочка>/src
    // закрывает комментарий на своём же слеше, и конфиг перестаёт разбираться.
    alias: solid2 ? { 'solid-js/web': '@solidjs/web' } : {},
    // `solid-dumb-kit-source` — своё условие экспорта: пакеты объявляют по нему
    // путь к `src`, и тесты идут по исходникам, а не по собранному `dist`. Алиасы
    // для этого больше не нужны — пакеты слинкованы воркспейсом, условие просто
    // выбирает у них другую ветку `exports`. Заодно правка в соседнем пакете
    // видна тесту сразу, без пересборки.
    conditions: ['solid-dumb-kit-source', 'development', 'browser'],
  },
  test: {
    environment: 'happy-dom', // zip.ts работает с File/DataTransfer
    setupFiles: ['./vitest.setup.ts'],
    // тесты пакетов лежат рядом с исходниками: packages/<имя>/test
    include: ['packages/*/test/**/*.{test,spec}.{ts,tsx}', 'examples/__tests__/**/*.{test,spec}.{ts,tsx}'],
  },
})
