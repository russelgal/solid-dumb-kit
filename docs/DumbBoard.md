**English** · [Русский](ru/DumbBoard.md)

# DumbBoard

A board of sections holding blocks. Blocks reorder inside a section and move between sections; the sections themselves reorder and resize.

```bash
pnpm add "github:russelgal/solid-dumb-kit#path:/packages/board"
```

## How it works

Three things make up the whole mechanic:

1. **Inside a section the DOM isn't touched** — only CSS `order` moves. Block order in the markup stays as it was; the browser does the layout.
2. **Moving to a neighbouring section** can't happen without a DOM change: `order` lives inside a single container. That's the only place the DOM changes.
3. **FLIP** plays out both cases, and it doesn't care which happened — it only knows "start here, arrive at zero".

The move gesture is native drag-and-drop: the browser works out the zone under the cursor, so we don't. Resizing is the **opposite** — pointer events: a move answers "where do I put this", while a resize is dragged frame by frame, which `dragover` won't give you.

Positions come from a single snapshot (`IntersectionObserver`, off-main-thread) plus flow packing: blocks differ in width and height, so a row is as tall as the tallest block in it and slot `k` depends on who stands before it. The snapshot refreshes on mount, after a drop and on resize — but **never mid-gesture**, and never while a FLIP animation is still playing (`boundingClientRect` includes transforms, so an early snapshot records where blocks are *travelling*, not where they live).

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
  blockSpan={(w) => w.w}            // block width in zone columns; defaults to 1
  onMove={(item, toSection, toIndex) => { /* notification only */ }}
>
  {(w) => <article class="card">{w.title}</article>}
</DumbBoard>
```

### Block size is in cells, not pixels

Width comes from `blockSpan` (zone columns); height comes from the block's own
content, but take it as a **multiple of the row step**, or rows end up with
ragged gaps: a neighbour turns out taller and the short block reaches no boundary
at all.

```tsx
const ROW = 76, GAP = 8
const cellH = (h: number) => h * ROW + (h - 1) * GAP   // 1 row → 76, 2 → 160
```

Height is **measured** — one snapshot through `IntersectionObserver`, the same
way the list in `sortable-dnd` snapshots its row heights. Not a single forced
layout happens during a gesture.

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
| `blockSpan` | `(item: T) => number` | block width in zone columns, defaults to `1` |
| `onMove` | `(item, toSection, toIndex) => void` | a block moved — notification |
| `onSectionMove` | `(from, to) => void` | a section was dragged by its header |
| `onSectionResize` | `(id, { span, rows }) => void` | a section changed size |
| `cols` | `number` | board columns, defaults to `12` |
| `gap` | `number` | grid gap in px, defaults to `14` |
| `rowHeight` | `number` | row step in px — height is measured in these while resizing, defaults to `76` |
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
| `rows` | height in rows; not set — sized by content |
| `accepts` | `(from: string) => boolean` — whether blocks from section `from` are allowed |

## Gestures

| action | what it does |
| --- | --- |
| drag a block | reorder within a section, or move it to a neighbour |
| drag a section by its header | reorder sections |
| right edge / bottom edge / corner | width, height, both at once |
| double-click the header | full width and back (it returns to the **same** width it had) |

## Styling

The kit injects structural styles only — the grid, handle positions, dimming the source. The injection happens **once per page**, however many boards render. Everything else is yours: override `.dumb-board-zone`, `.dumb-board-head`, `.dumb-board-block` from your own CSS.

## What it doesn't do

- **It doesn't persist the layout.** That's yours (`localStorage`, a server, whatever); the component only reports changes.
- **No touch support for moving** — HTML5 DnD doesn't exist there. Pointer-driven resizing works with a finger.
- **No cascading push.** A block takes its slot and neighbours shift by one — predictability beats cleverness.
