import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { fileURLToPath } from 'node:url'

// Live demo built from source: the examples/ import 'solid-dumb-kit', we alias that
// to ../src so vite-plugin-solid compiles the components (the lib's runtime deps —
// @viselect/vanilla, @solid-primitives/storage, valibot — come via the file:.. dep).
const src = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  base: '/solid-dumb-kit/', // project Pages: https://<user>.github.io/solid-dumb-kit/
  plugins: [solid()],
  resolve: {
    alias: [
      { find: /^solid-dumb-kit\/dist\/index\.css$/, replacement: src('../src/SelectionArea.css') },
      { find: /^solid-dumb-kit$/, replacement: src('../src/index.tsx') },
    ],
  },
  server: { fs: { allow: ['..'] } }, // examples/ live outside playground root
})
