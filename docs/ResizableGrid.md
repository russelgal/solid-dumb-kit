**English** · [Русский](ru/ResizableGrid.md)

# ResizableGrid

A panel layout with **drag-to-resize** columns (and an optional second row), with sizes **persisted to `localStorage`**. Sizes are kept in `fr` units, so the layout stays proportional when the container resizes.

```tsx
import { ResizableGrid } from 'solid-dumb-kit'
```

No CSS import needed — handle styles are injected once at runtime.

## Example

```tsx
import { ResizableGrid } from 'solid-dumb-kit'

<div style={{ height: '100vh' }}>
  <ResizableGrid
    storageKey="app:layout"
    cols={[
      { id: 'tree',   min: 180, initial: 1, content: () => <Tree /> },
      { id: 'main',   min: 320, initial: 3, content: () => <Main /> },
      { id: 'aside',  min: 200, initial: 1, content: () => <Aside /> },
    ]}
    rows={[
      { id: 'log',    min: 120, initial: 1, content: () => <Log /> },
    ]}
    rowInitial={2}   // top row gets 2fr of height
    row2Initial={1}  // bottom row gets 1fr
    rowMin={120}
  />
</div>
```

> The grid fills its parent (`h-full w-full`). Give the **parent** a height.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `cols` | `GridPanel[]` | — (required) | Columns of the first row (2–3 recommended). |
| `storageKey` | `string` | — (required) | `localStorage` key the sizes are saved under. |
| `rows` | `GridPanel[]` | — | Optional second row of panels (1–3). Enables a horizontal splitter. |
| `rowInitial` | `number` | `1` | First row height, in `fr`. |
| `row2Initial` | `number` | `1` | Second row height, in `fr`. |
| `rowMin` | `number` | `100` | Min row height, px. |
| `class` | `string` | — | Extra class on the grid container. |

### `GridPanel`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | `string` | — (required) | Unique panel id. |
| `content` | `() => JSX.Element` | — (required) | Render prop for the panel body. |
| `min` | `number` | `100` | Minimum size in px (width for columns, width for second-row columns). |
| `max` | `number` | — | Maximum width in px (first-row columns): the handle won't drag past it. For a sidebar — the longest row. |
| `initial` | `number` | `1` | Initial size in `fr`. |
| `collapseAt` | `number` | — | Collapse by gesture (first-row columns only): release the handle while the panel is narrower than this many px and it folds into a 32px rail. While dragging, the panel follows the cursor smoothly. |
| `collapsedContent` | `() => JSX.Element` | `›` | What the rail of a collapsed panel shows (icon, label). |

> `content` is a **function** (`() => <Panel/>`), not a JSX value. The component intentionally never reads panel JSX in resize handlers, so dragging never re-creates your panels.

## How it works

- Columns/rows are laid out with CSS Grid using `fr` tracks separated by a 6px handle.
- Dragging a handle redistributes `fr` between the two adjacent tracks, clamped so neither drops below its `min` nor grows past its `max` (converted from px to `fr` against the live container size). At a boundary the handle snaps to it instead of freezing.
- Each panel body is `overflow: auto` with `min-width/height: 0`, so long content scrolls instead of blowing out the track.
- While dragging, a column with `collapseAt` shrinks smoothly all the way down to the rail width — no jumps. Release decides: narrower than the threshold folds it into the rail, between the threshold and `min` snaps it to `min`. The rail of a collapsed panel is a full-height button: a click restores the width you started the drag from. There is no handle next to a collapsed column.

## Persistence

Sizes are stored as `{ cols, rows?, rowSplit?, collapsed? }` under `storageKey` (`collapsed` lists collapsed column ids; their `cols` entry keeps the width to restore). On load they're validated with `valibot`; if the stored data is corrupt **or its column count no longer matches** the current `cols`, it falls back to the defaults from `initial`. Change `storageKey` (or your `cols` length) to invalidate old saved layouts.

## Notes & limits

- Resizing is **mouse-only** (uses `mousedown`/`mousemove`); no touch handles.
- Designed for 2–3 columns and an optional second row — not an arbitrary nested split tree.
- Handle hover/active tint uses `currentColor` at low opacity, so it blends with your theme.
