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
  // Витрина живёт по двум адресам, и корень у них разный: на GitHub Pages это
  // подпуть проекта (`/solid-dumb-kit/`), на Vercel — сам домен. Отсюда база из
  // окружения: `VERCEL` там выставлен всегда, гадать не приходится.
  base: process.env.VERCEL ? '/' : '/solid-dumb-kit/',
  // `devS3` — ручки к хранилищу для вкладок DumbGallery и DumbFinder (подпись
  // на заливку, листинг, удаление, перенос), только в дев: у плагина
  // `apply: 'serve'`, в сборку он не попадает.
  plugins: [tailwindcss(), solid(), devS3()],
  resolve: {
    conditions: ['solid-dumb-kit-source', 'development', 'browser'],
  },
  server: {
    fs: { allow: ['..'] }, // examples/ живут вне корня playground
    // Изоляция страницы: без неё `SharedArrayBuffer` бросает в конструкторе, и
    // вкладка `#virtual` не покажет общий с воркером буфер. В дев-сервере это
    // просто заголовки; на GitHub Pages их взять неоткуда, там ту же пару
    // ставит `public/coi-sw.js`, включаемый кнопкой прямо на вкладке.
    //
    // `credentialless`, а не `require-corp`: под `require-corp` картинки из
    // чужого хранилища (галерея, файловый менеджер) перестали бы грузиться.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
})
