import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

// Tailwind — ТОЛЬКО здесь, в витрине. В самих пакетах его нет и не будет:
// потребитель волен верстать чем угодно, а кит даёт поведение и структурные
// стили. Примеры же читают люди, и в них классы короче простыни CSS внизу файла.
//
// Витрина собирается из ИСХОДНИКОВ пакетов, а не из их `dist`: условие
// `solid-dumb-kit-source` выбирает в `exports` ветку с `src`, поэтому правка в
// любом пакете видна в демо сразу, без пересборки и без алиасов.
export default defineConfig({
  base: '/solid-dumb-kit/', // project Pages: https://<user>.github.io/solid-dumb-kit/
  plugins: [tailwindcss(), solid()],
  resolve: {
    conditions: ['solid-dumb-kit-source', 'development', 'browser'],
  },
  server: { fs: { allow: ['..'] } }, // examples/ живут вне корня playground
})
