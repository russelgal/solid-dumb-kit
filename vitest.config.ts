import { defineConfig } from 'vitest/config'
import solid from 'vite-plugin-solid'
import { fileURLToPath } from 'node:url'

// Плагин solid нужен только смоук-тестам примеров (они на JSX); утилитам — happy-dom.
export default defineConfig({
  plugins: [solid()],
  resolve: {
    alias: [
      // examples/ импортируют пакет по имени — заворачиваем на исходники (как в playground)
      { find: /^solid-dumb-kit\/dist\/index\.css$/, replacement: fileURLToPath(new URL('./src/SelectionArea/SelectionArea.css', import.meta.url)) },
      { find: /^solid-dumb-kit$/, replacement: fileURLToPath(new URL('./src/index.tsx', import.meta.url)) },
    ],
    conditions: ['development', 'browser'],
  },
  test: {
    environment: 'happy-dom', // zip.ts работает с File/DataTransfer
    setupFiles: ['./vitest.setup.ts'],
  },
})
