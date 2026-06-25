# Examples

Self-contained, copy-pasteable examples — one per component. Each file default-exports a Solid component.

| File | Component |
| --- | --- |
| [SelectionArea.example.tsx](SelectionArea.example.tsx) | `SelectionArea` — rubber-band select over a card grid |
| [ResizableGrid.example.tsx](ResizableGrid.example.tsx) | `ResizableGrid` — 3 columns + a second row, persisted |
| [DumbSortable.example.tsx](DumbSortable.example.tsx) | `DumbSortable` — reorder a list (by handle) and a grid |

## Run them

These import from the published package name (`solid-dumb-kit`), so they run as-is in any Solid + Vite app:

```bash
npm create vite@latest playground -- --template solid-ts
cd playground
npm i solid-dumb-kit
# copy an example into src/ and render it from src/index.tsx, e.g.:
#   import Example from './SelectionArea.example'
#   render(() => <Example />, document.getElementById('root')!)
npm run dev
```

Working **inside this repo** instead? Change the import to the source:

```ts
import { SelectionArea } from '../src'
```

Inline styles are used to keep the examples dependency-free — swap them for your own classes/Tailwind.
