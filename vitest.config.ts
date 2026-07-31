import { defineConfig } from 'vitest/config'
import solid from 'vite-plugin-solid'

// Плагин solid нужен только смоук-тестам примеров (они на JSX); утилитам — happy-dom.
export default defineConfig({
  plugins: [solid()],
  resolve: {
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
