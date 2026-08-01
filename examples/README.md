# Examples

Self-contained, copy-pasteable examples — one per component, each file default-exports a Solid component.

Folders follow the one split that matters in this kit: **how the gesture is driven**. Pointer events and HTML5 drag-and-drop are two separate implementations that never mix, and half the components exist in both.

| Folder | What's in it |
| --- | --- |
| [`pointer/`](pointer) | Pointer events — works with a finger, we work out the drop zone ourselves |
| [`dnd/`](dnd) | Native HTML5 drag-and-drop — the browser picks the zone, no touch support |
| [`data/`](data) | Tables, trees, utilities — the gesture isn't the point here |
| [`lab/`](lab) | No kit at all: ideas tried on bare browser events |

## pointer/

| File | Package | What it shows |
| --- | --- | --- |
| [SelectionArea](pointer/SelectionArea.example.tsx) | `selection` | Rubber-band select over a card grid |
| [DumbSortable](pointer/DumbSortable.example.tsx) | `sortable` | Reorder a list (by handle) and a grid |
| [Kanban](pointer/Kanban.example.tsx) | `sortable` | `createSortableGroup` — dragging **between** scrollable columns |
| [ResizableGrid](pointer/ResizableGrid.example.tsx) | `resizable-grid` | 3 columns + a second row, persisted |
| [DumbGrid](pointer/DumbGrid.example.tsx) | `grid` | Dashboard grid: flow/dense/free, snap resize, add/remove |
| [Board](pointer/Board.example.tsx) | `grid` | Nested grids and transfer between them |

## dnd/

| File | Package | What it shows |
| --- | --- | --- |
| [DumbGridDnd](dnd/DumbGridDnd.example.tsx) | `grid-dnd` | The same grid on HTML5 DnD, two boards, transfer between them |
| [DumbSortableDnd](dnd/DumbSortableDnd.example.tsx) | `sortable-dnd` | 300-row list and a 200-tile grid, autoscroll |

## data/

| File | Package | What it shows |
| --- | --- | --- |
| [DumbTree](data/DumbTree.example.tsx) | `tree` | Tree + flat drag-reorderable list, search, sorting |
| [DumbTable](data/DumbTable.example.tsx) | `table` | Sortable columns, row drag-reorder, pagination |
| [Odata1C](data/Odata1C.example.tsx) | `odata-1c` | 1C OData client — URL building, no Solid needed |
| [utils](data/utils.example.tsx) | `utils` | fmt / genSlug / imgproxyUrl / extractImagesFromZip |

## lab/

Not part of the kit's API — these exist to answer a question with numbers rather than opinion. Several of them talked us out of a dependency.

| File | What question it answers |
| --- | --- |
| [RawDnd](lab/RawDnd.example.tsx) | How little does native DnD actually need? Three handlers, no animation |
| [CssOrder](lab/CssOrder.example.tsx) | Can you sort without ever touching the DOM? CSS `order` + FLIP |
| [FlipBench](lab/FlipBench.example.tsx) | What does "just measure it" cost? Live measurement vs one snapshot |
| [OrderKanban](lab/OrderKanban.example.tsx) | Columns and moves between them, on `order` |
| [OrderBoard](lab/OrderBoard.example.tsx) | Nested grids, sortable sections, resize on the pointer |
| [OrderTable](lab/OrderTable.example.tsx) | `order` doesn't work on `<tr>` — `subgrid` does. Animated sorting |
| [OrderTree](lab/OrderTree.example.tsx) | Moving a branch between levels, drop targets picked by the browser |

> `DumbTree` normally expects Tailwind + daisyUI. To keep its example standalone it ships a ~60-line CSS shim faking just the classes the component touches, plus emoji "icons" — delete both in a real daisyUI app and pass your own icon classes.

Every example is smoke-tested (`pnpm test`): each one is mounted into a DOM and asserted to render, so an example can't silently drift away from the API.

## Run them

```bash
pnpm demo
```

Then pick a tab in the sidebar — each one names the package you need to install for it.
