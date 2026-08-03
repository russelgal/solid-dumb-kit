import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'
import { devS3 } from './devS3'

// Tailwind — ТОЛЬКО здесь, в витрине. В самих пакетах его нет и не будет:
// потребитель волен верстать чем угодно, а кит даёт поведение и структурные
// стили. Примеры же читают люди, и в них классы короче простыни CSS внизу файла.
//
// Витрина собирается из ИСХОДНИКОВ пакетов, а не из их `dist`: условие
// `solid-dumb-kit-source` выбирает в `exports` ветку с `src`, поэтому правка в
// любом пакете видна в демо сразу, без пересборки и без алиасов.
export default defineConfig({
  // `.env` лежит в корне репы, а корень витрины — `playground/`
  envDir: '..',
  base: '/solid-dumb-kit/', // project Pages: https://<user>.github.io/solid-dumb-kit/
  // `devS3` — ручки к хранилищу для вкладок DumbGallery и DumbFinder (подпись
  // на заливку, листинг, удаление, перенос), только в дев: у плагина
  // `apply: 'serve'`, в сборку он не попадает.
  plugins: [tailwindcss(), solid(), devS3()],
  resolve: {
    conditions: ['solid-dumb-kit-source', 'development', 'browser'],
  },
  server: { fs: { allow: ['..'] } }, // examples/ живут вне корня playground
})
