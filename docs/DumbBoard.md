**English** · [Русский](ru/DumbBoard.md)

# DumbBoard

A board of sections holding blocks. Blocks reorder inside a section and move between sections; the sections themselves reorder and resize.

```bash
pnpm add "github:russelgal/solid-dumb-kit#path:/packages/board"
```

## How it works

Inside a section blocks live on a **cell grid**: sizes are whole — `w` zone columns by `h` rows, with a fixed row step (`rowHeight`). Everything else follows from that:

1. **Inside a section the DOM isn't touched** — a block's place is set through explicit `grid-column-start`/`grid-row-start`, computed arithmetically. Explicit rather than auto-flow: otherwise the browser improvises the layout and it drifts from the one the animation is computed against.
2. **Moving to a neighbouring section** can't happen without a DOM change — a block lives inside its own container. That's the only place the DOM changes.
3. **FLIP** plays out both cases, and it doesn't care which happened — it only knows "start here, arrive at zero".

The move gesture is native drag-and-drop: the browser works out the zone under the cursor, so we don't. Resizing is the **opposite** — pointer events: a move answers "where do I put this", while a resize is dragged frame by frame, which `dragover` won't give you.

Whole sizes buy two things for free. Block positions are pure arithmetic, so they never need to be measured: `IntersectionObserver` only watches zone corners and section heights, while column width and padding come from `ResizeObserver`. And the **grid overlay** is drawn with the same lines as [DumbGrid](DumbGrid.md) — see `showGrid`.

## State

One array, yours:

```tsx
const [sections, setSections] = createSignal<Array<BoardSection<Widget>>>([
  { id: 'sales', title: 'Sales', cols: 3, span: 6, items: [{ id: 'w1', title: 'Revenue' }] },
  { id: 'stock', title: 'Stock', cols: 3, span: 6, items: [] },
])
```

Blocks live **inside** their section: `sections[i].items`. Section array order is the on-screen order, `items` order is the order of blocks within a section, and size lives on the section itself.

The component **stores nothing and mutates nothing**: on every step of a gesture it builds a new sections array and hands it to `setSections`. The data always matches the picture — including when the browser fails to deliver `drop`, which it often does.

## Example

```tsx
<DumbBoard
  sections={sections()}
  setSections={setSections}
  id={(w) => w.id}
  blockSpan={(w) => w.w}            // width in zone columns; defaults to 1
  blockRows={(w) => w.h}            // height in zone rows; defaults to 1
  blockLimits={(w) => ({ minW: 1, maxW: 'half', minH: 1, maxH: 4 })}
  onBlockResize={(w, size) => save(w.id, size)}   // no handle without it
  showGrid="drag"                   // grid overlay while a block is dragged
  onMove={(item, toSection, toIndex) => { /* notification only */ }}
>
  {(w) => <article class="card">{w.title}</article>}
</DumbBoard>
```

### Block size is in cells, not pixels

Width is `blockSpan` (zone columns), height is `blockRows` (zone rows, stepped by
`rowHeight`). There's no need to set a pixel height at all: a block fills its
cells, and the board never has to measure it.

Width can also be a fraction — `'half'`, `'third'`, `'2/5'`: it resolves against
the **zone's** column count and rounds down, so that N blocks of `1/N` always fit
in a row.

### Limits and squeezing: `blockLimits`

One prop carries all four numbers:

```tsx
blockLimits={(w) => ({ minW: 1, maxW: 'half', minH: 1, maxH: 4 })}
```

`minW` does **two** jobs. It's the resize floor, and it's the width a block agrees
to shrink to in order to fit the rest of a row instead of moving down: it wants 3
columns, two are free — it lands two wide; one is free and `minW: 1` — it lands
one wide. With no `minW` the block moves down whole.

The squeezed width is **stored nowhere**: it is re-derived from the layout, so on
a roomier spot the block expands back to `blockSpan` on its own. The data never
changes — the board still mutates nothing.

### Resizing a block

A handle appears in the block's bottom-right corner — but **only when
`onBlockResize` is set**: the size lives in your data, and the board won't change
it unasked.

```tsx
onBlockResize={(item, { w, h }) => setSizes({ ...sizes(), [item.id]: { w, h } })}
```

While you drag, only the **preview frame** moves. The block itself changes size
after you've stored the new one: applying every snap live would re-pack the whole
zone frame by frame and fire a burst of animations — the same call as in
[DumbGrid](DumbGrid.md).

The gesture is pointer-based (`pointerdown`), not native DnD: a resize is dragged
frame by frame, which `dragover` won't give you. So unlike moving, resizing works
with a finger too.

Keep sizes **outside the block objects** (a `id → {w,h}` map): a block object must
survive a move between sections, and `{ ...item, w }` is a different object (see
below).

### Your own buttons on a block

Anything inside a block that has to be clickable — delete, a menu, an input —
needs `data-no-drag`, or the press turns into a drag and the click never
happens. Buttons in the section header go through `sectionActions` and need no
marker.

Removal isn't the board's job: `sections` is your array, so dropping a block or
a whole section from it and handing the result to `setSections` is yours to do.

```tsx
<button data-no-drag onClick={() => remove(item.id)}>✕</button>
```

### One requirement on blocks

Block objects must **survive the move**: the board carries the same object from
one section's array into another's and never makes a copy. Don't make one either
— `{ ...item }` is a new object, `<For>` treats it as a different element and
rebuilds the node, and a rebuilt node has nothing to animate: FLIP grabs an
element that no longer exists.

## Props

| prop | type | what it does |
| --- | --- | --- |
| `sections` | `Array<BoardSection<T>>` | sections along with their blocks; array order = on-screen order |
| `setSections` | `(next) => void` | the new layout; called during the gesture, on every step |
| `id` | `(item: T) => string` | stable block id |
| `blockSpan` | `(item: T) => SpanValue` | block width in zone columns (or a fraction), defaults to `1` |
| `blockRows` | `(item: T) => number` | block height in zone rows, defaults to `1` |
| `blockLimits` | `(item: T) => BlockLimits` | `{ minW, maxW, minH, maxH }` in cells; `minW` also drives squeezing |
| `onBlockResize` | `(item, { w, h }) => void` | a block changed size; **no handle without this prop** |
| `showGrid` | `boolean \| 'drag'` | grid overlay inside sections, defaults to `'drag'` |
| `labels` | `{ resizeBlock?: string }` | title for the block resize handle |
| `onMove` | `(item, toSection, toIndex) => void` | a block moved — notification |
| `onSectionMove` | `(from, to) => void` | a section was dragged by its header |
| `onSectionResize` | `(id, { span, rows }) => void` | a section changed size |
| `cols` | `number` | board columns, defaults to `12` |
| `gap` | `number` | board grid gap in px, defaults to `14` |
| `rowHeight` | `number` | zone cell height in px, defaults to `76` |
| `zoneGap` | `number` | grid gap inside a section in px, defaults to `8` |
| `minSpan` | `number` | minimum section width in columns, defaults to `3` |
| `editable` | `boolean` | edit mode; when `false` there are no gestures, no handles, no listeners |
| `animate` | `boolean` | animate; on by default, but not under `prefers-reduced-motion` |
| `resizable` | `boolean` | allow resizing sections |
| `sectionActions` | `(s) => JSX.Element` | your own buttons on the right of the header |

### BoardSection

| field | meaning |
| --- | --- |
| `id` | required |
| `items` | the section's blocks; array order = on-screen order |
| `title` | header, and the drag handle. Not set — no header at all |
| `subtitle` | smaller line underneath |
| `cols` | columns **inside** the section, defaults to `3` |
| `span` | section width in board columns, defaults to half |
| `rows` | height in zone grid rows; not set — occupied rows plus one spare |
| `accepts` | `(from: string) => boolean` — whether blocks from section `from` are allowed |

## Gestures

| action | what it does |
| --- | --- |
| drag a block | reorder within a section, or move it to a neighbour |
| drag a block's corner | resize the block (needs `onBlockResize`); works with a finger too |
| drag a section by its header | reorder sections |
| section's right edge / bottom edge / corner | width, height, both at once |
| double-click the header | full width and back (it returns to the **same** width it had) |

## Styling

The kit injects structural styles only — the grid, handle positions, dimming the source. The injection happens **once per page**, however many boards render. Everything else is yours: override `.dumb-board-zone`, `.dumb-board-head`, `.dumb-board-block` from your own CSS.

## What it doesn't do

- **It doesn't persist the layout.** That's yours (`localStorage`, a server, whatever); the component only reports changes.
- **No touch support for moving** — HTML5 DnD doesn't exist there. Pointer-driven resizing works with a finger.
- **No cascading push.** A block takes its slot and neighbours shift by one — predictability beats cleverness.
