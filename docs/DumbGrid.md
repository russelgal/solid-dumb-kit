**English** · [Русский](ru/DumbGrid.md)

# DumbGrid

A **dashboard grid** for SolidJS: `N` columns, blocks sized in **whole columns and rows**, draggable to reorder and resizable in grid steps, with layout persisted to `localStorage`. **Zero element measurements during a gesture.**

```tsx
import { DumbGrid, createDumbGrid } from 'solid-dumb-kit'
```

Two flavours:

- **`DumbGrid`** — the component: give it `items`, get a working dashboard.
- **`createDumbGrid`** — the primitive (manual refs), when the markup must be yours.

No CSS needed — movement is inline `transform`, positions are inline `grid-column` / `grid-row`.

## Three layout modes

| `mode` | Position comes from | Holes | Drag does |
|---|---|---|---|
| `flow` (default) | index in the array | stay where a wide block left them | reorder |
| `dense` | index in the array | filled by later blocks | reorder |
| `free` | the block's own `{x, y}` | stay exactly as you leave them | move to a cell |

```tsx
<DumbGrid mode="dense" items={items} />
<DumbGrid mode="free" showGrid items={items} />
```

`flow` and `dense` are the same one-dimensional model — the difference is only whether the packer may go back and fill a gap. `free` is the "put it anywhere" mode: drag a block into the empty space below the last row and it stays there.

In `free` mode a drop onto an occupied spot is **refused** — the frame turns red and the block flies home. Neighbours are never pushed aside: cascading shoves are exactly what breaks the predictability you turned free mode on for. Resizing is clamped to the space actually available (`fitSpan`), so a block grows until it touches its neighbour and then stops.

## What it is not

Even in `free` mode this is **not** `react-grid-layout`: there is no compaction pass and no collision cascade. In `flow`/`dense` blocks flow in order, the way `grid-auto-flow: row` does: the layout is a one-dimensional array plus two numbers per block.

That constraint is the whole point:

| | react-grid-layout | DumbGrid |
|---|---|---|
| Model | `{i, x, y, w, h}` + compaction | ordered array + `{w, h}` (+ `{x, y}` in `free`) |
| Reorder | recompute the packing | `splice` |
| Persisted state | full layout per breakpoint | `[{id, w, h, x?, y?}]` |
| Measurements per frame | `getBoundingClientRect` per item | none |

If you need arbitrary holes ("this block sits at column 7, row 4, and nothing fills the gap"), use `mode="free"` — that is exactly what it is for. What you will not get in any mode is neighbours being pushed out of the way to make room: a blocked drop is refused instead.

## Why it doesn't jank

Because sizes are whole units and the column width is known, **every position is arithmetic** — there is nothing to measure. Over an entire gesture the kit touches layout exactly twice, and neither time per block:

1. `ResizeObserver` on the container — content width (delivered by the browser, no reflow; `contentRect.left/top` gives padding too);
2. `IntersectionObserver` on the container at gesture start — its viewport position (`boundingClientRect` is computed off-main-thread, no reflow).

After that, each frame only reads `scrollTop`/`scrollLeft` and writes `transform`. The cost of a drag does not depend on how many blocks are on screen.

Neighbours part by **subtracting two layouts**: pack the current order, pack the order with the dragged block at its new index, and the difference is each block's `dx/dy`. That handles a block wrapping to another row for free.

Resizing shows a **dashed preview frame** instead of resizing the block live: changing a block's `width`/`height` every frame would re-lay-out the whole grid. The frame is a single element, and its size is written only when the snapped span actually changes.

## `DumbGrid` component

```tsx
import { DumbGrid } from 'solid-dumb-kit'

<DumbGrid
  cols={12}
  rowHeight={92}
  gap={12}
  storageKey="dashboard"
  items={[
    { id: 'revenue', w: 'half', h: 2, minW: 'quarter', content: () => <Revenue /> },
    { id: 'orders',  w: 'quarter',    content: () => <Kpi value="1 284" /> },
    { id: 'stock',   w: 3, h: 2,      content: () => <LowStock /> },
    { id: 'pinned',  w: 'quarter', locked: true, content: () => <Pinned /> },
  ]}
/>
```

Drag a block anywhere on its body, or add `data-drag-handle` to a child to restrict dragging to that handle:

```tsx
{ id: 'revenue', w: 6, h: 2, content: () => (
  <div class="card">
    <div class="card-head" data-drag-handle>⠿ Revenue</div>
    <Chart />
  </div>
) }
```

Without a handle, pointer-downs on `input`, `button`, `a`, `select`, `label`, `[contenteditable]` and `[data-no-drag]` do not start a drag — and neither does anything while a focused element sits inside the block.

### Props

| Prop | Type | Default | Meaning |
|---|---|---|---|
| `items` | `DumbGridItem[]` | — | blocks; `content` is a render prop |
| `mode` | `'flow' \| 'dense' \| 'free'` | `'flow'` | how blocks are placed (see above) |
| `cols` | `number` | `12` | columns in the grid (reactive — pass a signal value) |
| `rowHeight` | `number` | `80` | row height, px |
| `gap` / `gapX` / `gapY` | `number` | `12` | gaps; the axis-specific ones win |
| `storageKey` | `string` | — | `localStorage` key; without it the layout lives in memory only |
| `layout` | `DumbGridLayout` | — | controlled mode: you own the layout |
| `onLayout` | `(l: DumbGridLayout) => void` | — | called after every reorder/resize |
| `onRemove` | `(id: string) => void` | — | pass it to get a ✕ button on blocks |
| `labels` | `{ remove?, resize? }` | ru | button titles / aria-labels |
| `resizable` | `boolean` | `true` | show resize handles |
| `editable` | `boolean` | `true` | `false` → plain grid: no chrome, no listeners |
| `disabled` | `boolean` | `false` | gestures off, editor chrome stays |
| `animate` | `boolean` | `true`\* | animate parting and landing |
| `pressDelay` | `number` | `350` | touch: hold before a drag starts, ms |
| `mouseThreshold` | `number` | `0` | mouse: distance before a drag starts, px |
| `showGrid` | `boolean \| 'drag'` | `'drag'` | draw the grid: while dragging / always / never |
| `spareRows` | `number` | `2` in `free`, `0` in flow | empty rows kept below, so a block can be dragged into nothing (constant — see below) |
| `class` / `style` | — | — | on the grid container |
| `blockClass` / `blockStyle` | — | — | on each block wrapper |

\* by default animations respect `prefers-reduced-motion: reduce`; an explicit `animate={true}` overrides even that.

## Edit mode

A dashboard is edited rarely and looked at constantly, so the editing chrome is a mode, not a permanent fixture:

```tsx
const [edit, setEdit] = createSignal(false)

<DumbGrid editable={edit()} items={items} onRemove={remove} />
```

With `editable={false}` the component renders **the plain grid and nothing else** — no resize handles, no ✕ buttons, no grid overlay, no `cursor`/`touch-action`, and not a single listener on the blocks. The blocks keep exactly the positions they had, because the placement is the same arithmetic either way.

That is deliberately stronger than `disabled`:

| | `disabled` | `editable={false}` |
|---|---|---|
| Editing chrome | rendered | not rendered |
| Listeners on blocks | attached, gestures rejected | none attached |
| Grid overlay | rendered, hidden | not rendered |
| Spare rows below | kept | dropped |
| Good for | a save is in flight | the production screen |

Switching the flag re-creates the blocks (that is how refs get attached or left off), so flipping it back restores everything.

## Size presets

Width takes a **number of columns or a fraction of the grid** — both are first-class:

```tsx
{ id: 'hero',  w: 'full', h: 2 }        // whole width, two rows
{ id: 'chart', w: 'half' }              // half the columns
{ id: 'kpi',   w: 'quarter' }
{ id: 'odd',   w: '5/12' }              // any fraction
{ id: 'exact', w: 7 }                   // plain numbers still work
```

Presets: `full`, `half`, `third`, `quarter`, `two-thirds`, `three-quarters`, plus any `'n/d'` fraction. They work in `minW`/`maxW` too (`minW: 'quarter'`).

A fraction is rounded **down**, so N blocks of `1/N` always fit one row even when the grid does not divide evenly (`half` of 5 columns is 2, not 3). A preset resolves against the current `cols`, so the same item is 6 columns wide on a 12-column grid and 3 on a 6-column one. Unknown strings resolve to 1 column — a typo should be obvious, not silently full-width.

`h` stays a plain row count: rows are unbounded, so there is nothing to take a fraction of.

## Adding and removing blocks

The set of blocks belongs to you — `items` is the source of truth, so adding is just pushing to your own array. What the kit does is clean up after a block that disappeared and find a spot for one that appeared:

```tsx
const [items, setItems] = createSignal(initial)

const add = () => setItems((l) => [...l, { id: `w-${l.length}`, w: 'half', content: () => <New /> }])

<DumbGrid items={items()} onRemove={(id) => setItems((l) => l.filter((i) => i.id !== id))} />
```

- `onRemove` — pass it and every block gets a ✕ button; per-item `removable: false` opts out (handy for pinned blocks). The button is a `<button data-no-drag>`, so pressing it never starts a drag. Style it via `[data-grid-remove]`, relabel it via `labels.remove`.
- A block missing from `items` is dropped from the layout and from the store.
- A new block is appended in `items` order. In `free` mode it also gets the **first free cell** (`firstFreeCell`), so it lands in the first hole instead of on top of a neighbour; give it explicit `x`/`y` to override.

### `DumbGridItem`

| Field | Type | Meaning |
|---|---|---|
| `id` | `string` | stable identity — the persisted key |
| `content` | `() => JSX.Element` | render prop |
| `w` | `number \| SpanPreset` | initial width: columns or a fraction (default `1`) |
| `h` | `number` | initial height in rows (default `1`) |
| `x` / `y` | `number` | initial cell in `free` mode; omit and it is placed by flow |
| `minW` / `maxW` | `number \| SpanPreset` | width limits: columns or a fraction |
| `minH` / `maxH` | `number` | height limits, in rows |
| `locked` | `boolean` | neither draggable nor resizable (still shifts when neighbours move) |
| `removable` | `boolean` | show the ✕ button for this block (default `true` when `onRemove` is set) |

## The visible grid

`showGrid` draws the cell map on a **single** background element — no per-cell nodes:

```tsx
<DumbGrid showGrid items={items} />        {/* always */}
<DumbGrid showGrid="drag" items={items} /> {/* only while dragging (default) */}
<DumbGrid showGrid={false} items={items} />
```

The column width in that background is not measured in JS — it is `calc((100% - gaps) / cols)`, so the browser computes it and the lines stay correct through any window resize. Visibility toggles via `opacity`, which is composited: switching the grid on at gesture start re-lays out nothing.

## Scrollbars: keep the gutter

The spare rows (`spareRows`) are kept **permanently**, not added for the duration of a drag. Otherwise the container grows the moment a gesture starts, the page gains a scrollbar, the content gets narrower by its width — and `ResizeObserver` dutifully recomputes the column step mid-gesture, making blocks drift on their own.

For the same reason the grid container asks for `scrollbar-gutter: stable`, and the page is worth doing yourself:

```css
html { scrollbar-gutter: stable }
```

## Persistence

With `storageKey` the layout is stored as `[{id, w, h, x?, y?}]` — order included, since in flow modes order *is* the position; in `free` mode the coordinates are written for **every** block at once, so nothing jumps on the next drop.

`storageKey` is read when the component mounts. Switching stores at runtime (e.g. one store per mode) means remounting — `<Show when={mode()} keyed>` is enough.

The stored snapshot is always merged against the current `items` (`mergeLayout`, exported for tests):

- blocks that vanished from `items` are dropped;
- blocks missing from the store are appended in `items` order;
- sizes are clamped to `minW/maxW/minH/maxH` and to `cols`;
- a corrupt or non-conforming store (validated with valibot) falls back to the defaults.

Without that merge an outdated store either paints holes or silently swallows new blocks.

To reset a layout, clear the key and remount, or switch to controlled mode:

```tsx
const [layout, setLayout] = createSignal<DumbGridLayout | undefined>(undefined)
<DumbGrid layout={layout()} onLayout={setLayout} items={items} />
```

## Responsive

`cols` is reactive, so breakpoints are one line of your own:

```tsx
const cols = () => (width() < 700 ? 4 : width() < 1100 ? 6 : 12)
<DumbGrid cols={cols()} items={items} />
```

Sizes wider than `cols` are clamped, so a 6-wide block becomes full-width on a 4-column layout instead of overflowing.

## `createDumbGrid` primitive

When the markup must be yours:

```tsx
import { createDumbGrid, packFlow, cellRect } from 'solid-dumb-kit'

const g = createDumbGrid({
  blocks: () => layout(),          // [{id, w, h, minW?, …, locked?}]
  cols: () => 12,
  rowHeight: () => 92,
  gapX: () => 12,
  gapY: () => 12,
  onReorder: (from, to) => setLayout(reorder(layout(), from, to)),
  onResize: (id, w, h) => setLayout(/* … */),
})

<div ref={g.container} style={{ display: 'grid', /* … */ }}>
  <For each={placed()}>
    {(p) => (
      <div ref={g.bind(p.id)} style={{ 'grid-column': `${p.col + 1} / span ${p.w}` /* … */ }}>
        …
        <div ref={g.resize(p.id)} />
      </div>
    )}
  </For>
</div>
```

`g.active()` is a signal: `{ id, kind: 'move' | 'resize' }` while a gesture runs, `null` otherwise — handy for highlighting.

The container ref is **required**: it is where the column width and the coordinate system come from. Position blocks explicitly (`grid-column-start`), not by auto-flow, so the browser's placement can never disagree with the arithmetic.

## Engine without a framework

`createGridEngine` (in `gridCore.ts`) imports no `solid-js` at all — it takes elements and returns unsubscribe functions. `createDumbGrid` is a thin wrapper that hangs those on `onCleanup`. The maths lives in `gridMath.ts` as pure functions:

| Function | Does |
|---|---|
| `packFlow(items, cols, mode)` | order + sizes → `{col, row}` per block (`flow` / `dense`) |
| `placeFree(items, cols)` | own `{x, y}` → `{col, row}`, clamped, conflicts resolved |
| `pointToCell({x, y, w, m})` | pixel corner → grid cell, clamped |
| `overlaps({placed, id, col, row, w, h})` | is the spot taken |
| `fitSpan({placed, id, col, row, want})` | shrink a wanted size to what is free |
| `cellRect(placed, metrics)` | grid units → px rectangle |
| `colWidth(contentW, cols, gapX)` | column width from container width |
| `insertIndex({base, dragId, m, pointerX, pointerY})` | where the dragged block lands |
| `moveDeltas({base, next, m, skipId})` | how far each neighbour travels |
| `snapSpan({start, dx, dy, m, limits})` | pointer delta → new `{w, h}` |
| `resolveSpan(value, cols)` | `'half'` / `'5/12'` / `7` → columns |
| `firstFreeCell({placed, cols, w, h})` | where a new block fits |
| `rowCount(placed)` | rows occupied |

All of them are covered by tests that need no DOM.
