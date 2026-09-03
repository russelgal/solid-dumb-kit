# Locator — alt-click an element, open its markup in your editor

You see a button on the page, alt-click it, and the editor opens exactly at the
line where that button is written. No class hunting, no "which component was
that again".

Two halves, both needed:

- **the bundler half** — the Vite plugin `locator()`
  (`@solid-dumb-kit/locator/vite`): gives every markup element a
  `data-loc="file:line:column"` attribute;
- **the browser half** — `createLocator()` (`@solid-dumb-kit/locator`): catches
  the alt-click, reads the attribute off the closest ancestor and asks the dev
  server to open that spot.

**Vite itself opens the file**: the dev server already serves
`/__open-in-editor` (`launch-editor`), and it also picks the editor — from the
running process or from the `LAUNCH_EDITOR` variable. This package adds no
endpoint of its own.

All of it is dev-server only (`apply: 'serve'`): a production build carries
neither the attributes nor the browser half.

```bash
pnpm add -D @solid-dumb-kit/locator
```

## Wiring it up

```ts
// vite.config.ts
import { locator } from '@solid-dumb-kit/locator/vite'

export default defineConfig({
  plugins: [
    // ⚠️ BEFORE the framework plugin: it folds markup into templates, and
    // after that there is nowhere left to put the attribute.
    locator({ entry: 'src/App.tsx', editor: 'webstorm' }),
    solid(),
  ],
})
```

Name the entry and the plugin injects the browser half into it, so your app
never mentions the locator. Leave it out and call `createLocator()` yourself:

```ts
if (import.meta.env.DEV) createLocator()
```

## `locator(options)` — the bundler half

| prop | type | default | what it does |
| --- | --- | --- | --- |
| `attribute` | `string` | `'data-loc'` | attribute holding the source location |
| `entry` | `string` | — | path from the project root to inject the browser half into; omitted means the plugin touches no code of yours |
| `editor` | `string` | — | what to open when `launch-editor` cannot guess it from a running process (`webstorm`, `code`, `cursor`); an existing environment value wins |
| `include` | `(id: string) => boolean` | own `.tsx`, tests excluded | which files get marked |

`markLocations(code, file, attribute?)` is exported too — handy when the plugin
does not fit and you want to call the marking from your own.

## `createLocator(options)` — the browser half

| prop | type | default | what it does |
| --- | --- | --- | --- |
| `attribute` | `string` | `'data-loc'` | the same attribute the plugin writes |
| `endpoint` | `string` | `'/__open-in-editor'` | the URL that opens a file |
| `target` | `EventTarget` | `window` | where clicks are listened for |
| `key` | `'altKey' \| 'ctrlKey' \| 'metaKey' \| 'shiftKey'` | `'altKey'` | the modifier that opens the editor |

Returns an unsubscribe function. No Solid needed: it is a framework-free engine,
like the kit's other engines.

## Things worth knowing

- **Components are not marked** — `<DumbTable/>` creates nothing in the DOM. The
  alt-click lands on the closest element ancestor, i.e. on the **usage site**,
  which is usually what you were after.
- **Line numbers do not move.** Marking is string-level: the parser gives tag
  positions and the attribute goes into the same line. The code is never
  re-printed, so both line numbers and source maps stay correct.
- **The click is consumed** (`preventDefault` + `stopPropagation`, capture
  phase): a "delete" button may sit under the cursor, and opening an editor is
  no reason to press it.
- **Cost** — about 3 ms per file on first transform, dev server only. Measured
  on a real project: 64 files, 852 attributes, 169 ms for the whole `src`.
