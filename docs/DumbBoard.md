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

Positions are arithmetic over a single snapshot (`IntersectionObserver`, off-main-thread): blocks are identical and the step is known, so slot `k` is `left + (k % cols) * stepX`. The snapshot refreshes on mount, after a drop and on resize — but **never mid-gesture**.

## State

Two arrays, both yours:

```tsx
const [sections, setSections] = createSignal<Array<BoardSection>>([
  { id: 'sales', title: 'Sales', cols: 3, span: 6 },
  { id: 'stock', title: 'Stock', cols: 3, span: 6 },
])
const [widgets, setWidgets] = createSignal([
  { id: 'w1', section: 'sales', title: 'Revenue' },
])
```

Order in `items` *is* the order of blocks; order in `sections` is the order of sections; size lives on the section itself. The component **stores nothing** — it reports what happened and you edit the arrays.

## Example

```tsx
<DumbBoard
  sections={sections()}
  items={widgets()}
  id={(w) => w.id}
  section={(w) => w.section}
  onMove={(item, toSection, toIndex) => { /* rearrange the array */ }}
  onSectionMove={(from, to) => { /* reorder sections */ }}
  onSectionResize={(id, { span, rows }) => { /* store the size */ }}
>
  {(w) => <article class="card">{w.title}</article>}
</DumbBoard>
```

## Props

| prop | type | what it does |
| --- | --- | --- |
| `sections` | `Array<BoardSection>` | sections; array order = on-screen order |
| `items` | `Array<T>` | blocks; array order = order within a section |
| `id` | `(item: T) => string` | stable block id |
| `section` | `(item: T) => string` | which section a block is in |
| `onMove` | `(item, toSection, toIndex) => void` | a block moved |
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
