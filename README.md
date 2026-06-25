# solid-dumb-kit

A small set of dependency-light **SolidJS** UI primitives that are easy to drop in and fully styleable — you own the markup, the kit wires the behaviour.

- **[SelectionArea](docs/SelectionArea.md)** — Finder-style rubber-band selection over a list/grid (Shift/Cmd to add).
- **[ResizableGrid](docs/ResizableGrid.md)** — resizable columns/rows panel layout, sizes persisted to `localStorage`.
- **[DumbSortable](docs/DumbSortable.md)** — zero-dep FLIP drag-reorder (vertical list **or** grid), no reflow during drag. Ships as a declarative component and a low-level `createDumbSortable` primitive.

## Install

```bash
npm i solid-dumb-kit
# peer dep:
npm i solid-js
```

Installing straight from GitHub also works (the repo ships both `src/` and a prebuilt `dist/`):

```bash
npm i github:russelgal/solid-dumb-kit
```

## Quick start

```tsx
import { SelectionArea, ResizableGrid, DumbSortable } from 'solid-dumb-kit'
import 'solid-dumb-kit/dist/index.css' // only needed for SelectionArea
```

Runnable examples (one per component) live in [`examples/`](examples/).

## Exports

| Export | Kind | Doc |
| --- | --- | --- |
| `SelectionArea` / `SelectionAreaProps` / `SelectionEvent` | component | [docs/SelectionArea.md](docs/SelectionArea.md) |
| `ResizableGrid` / `ResizableGridProps` / `GridPanel` | component | [docs/ResizableGrid.md](docs/ResizableGrid.md) |
| `DumbSortable` / `DumbSortableProps` | component | [docs/DumbSortable.md](docs/DumbSortable.md) |
| `createDumbSortable` / `DumbSortableHandle` / `DumbSortableOptions` | primitive | [docs/DumbSortable.md#createdumbsortable-primitive](docs/DumbSortable.md#createdumbsortable-primitive) |

## CSS

- **SelectionArea** ships a tiny stylesheet (rubber-band box + window-scroll helper) — import `solid-dumb-kit/dist/index.css` once.
- **ResizableGrid** injects its handle styles at runtime — no import needed.
- **DumbSortable** uses inline transforms only — no CSS needed.

## License

MIT
