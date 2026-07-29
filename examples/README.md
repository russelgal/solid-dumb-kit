# Examples

Self-contained, copy-pasteable examples — one per component. Each file default-exports a Solid component.

| File | Component |
| --- | --- |
| [SelectionArea.example.tsx](SelectionArea.example.tsx) | `SelectionArea` — rubber-band select over a card grid |
| [ResizableGrid.example.tsx](ResizableGrid.example.tsx) | `ResizableGrid` — 3 columns + a second row, persisted |
| [DumbSortable.example.tsx](DumbSortable.example.tsx) | `DumbSortable` — reorder a list (by handle) and a grid |
| [Kanban.example.tsx](Kanban.example.tsx) | `createSortableGroup` — dragging **between** scrollable columns (top layer via Popover API) |
| [DumbTree.example.tsx](DumbTree.example.tsx) | `DumbTree` — tree + flat drag-reorderable list, search, sorting |
| [DumbTable.example.tsx](DumbTable.example.tsx) | `DumbTable` — sortable columns, row drag-reorder, pagination |
| [utils.example.tsx](utils.example.tsx) | `utils` — live playground for fmt / genSlug / imgproxyUrl / extractImagesFromZip |

> `DumbTree` normally expects Tailwind + daisyUI. To keep this example standalone it ships a ~60-line CSS shim faking just the classes the component touches, plus emoji "icons" — delete both in a real daisyUI app and pass your own icon classes.

Every example is smoke-tested (`pnpm test`): each one is mounted into a DOM and asserted to render, so an example can't silently drift away from the API.

## Run them

These import from the published package name (`solid-dumb-kit`), so they run as-is in any Solid + Vite app:

```bash
npm create vite@latest playground -- --template solid-ts
cd playground
pnpm add github:russelgal/solid-dumb-kit   # в npm пока нет
# copy an example into src/ and render it from src/index.tsx, e.g.:
#   import Example from './SelectionArea.example'
#   render(() => <Example />, document.getElementById('root')!)
npm run dev
```

Working **inside this repo** instead? Change the import to the source:

```ts
import { SelectionArea } from '../src'
```

Each example keeps its looks in a single `<style>` block at the bottom and uses plain class names, so the markup shows the kit's API rather than a wall of inline objects. Nothing but the browser is required — swap the block for your own CSS/Tailwind.

Inline styles are left only where a value genuinely comes from data (a colour derived from an item, a per-row `view-transition-name`).
