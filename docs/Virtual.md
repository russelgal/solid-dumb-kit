**English** · [Русский](ru/Virtual.md)

# Long lists

Two primitives from `@solid-dumb-kit/shared`: `createVirtualizer` decides
**which** items to render, `createRowIndex` decides **what** sits under an item's
number when there are a million rows and they have to be sorted or filtered.

```tsx
import { createVirtualizer, createRowIndex } from '@solid-dumb-kit/shared'
```

Live — the [`#virtual`](https://russelgal.github.io/solid-dumb-kit/#virtual) tab,
source in [`examples/data/virtual.example.tsx`](../examples/data/virtual.example.tsx).

## `createVirtualizer` — a window without a single measurement

Mainstream virtualizers measure elements: `getBoundingClientRect` per row to
learn its height. On a thousand rows that is a thousand forced layouts — exactly
what this kit [forbids](../CLAUDE.md). Here the row size is **declared**, and the
window is plain arithmetic.

The only things read from the DOM are `scrollTop` (not a forced layout — the
browser serves it from the layout it already computed) and the viewport size via
`ResizeObserver`. Elements are never measured.

```tsx
const [range, setRange] = createSignal<VirtualRange>({ start: 0, end: 0, offset: 0, total: 0 })

const v = createVirtualizer({
  count: () => rows().length,
  itemSize: () => 28,          // row height including the gap
  scroller: () => scrollerEl,
  onChange: setRange,
})
onCleanup(() => v.destroy())
```

`VirtualRange` is four numbers: `start`/`end` (which indices to draw), `offset`
(how far to shift what you drew along the axis) and `total` (the size of the
spacer that holds the scrollbar).

| Option | What it is for |
| --- | --- |
| `count` / `itemSize` | how many items and how big each one is — the basis of the arithmetic |
| `itemSizes` | **per-item** sizes when rows differ in height but that height is known in advance (say, "row × number of floors"): prefix sums and binary search instead of division |
| `columns` | how many items per row — for tile grids |
| `axis` | `'x'` — the window is computed from `scrollLeft` and width; for time scales and anything that travels sideways |
| `lead` | how many pixels sit **before** the first row inside the same scroller: a sticky column, a header. Without the correction the window is off by exactly that much |
| `overscan` | how many spare rows to draw (3 by default); going below two shows a white band on fast scrolling |
| `maxHeight` | the spacer ceiling, see below |

`refresh()` recomputes the window on demand — call it when the item count or the
row size changed; the engine only learns about scrolling and viewport size by
itself.

### The height ceiling

An element's height is not unbounded: Chrome clips at roughly 33.5 million
pixels, Firefox at about 17.8 million. With a 28px row that is only ~600 thousand
rows; past that the spacer quietly stops growing and the scrollbar stops matching
the content.

So the spacer is clamped to `MAX_SCROLL_HEIGHT` (15 million, with room to spare
for the strictest browser) and scrolling stops being one-to-one: `scrollTop` is
stretched up to the list's virtual height. The price is that rows within a single
scrollbar pixel jump several positions at once — at these sizes that is exactly
what the native scrollbar does anyway, only stated honestly.

`scrollOffsetFor` can do the reverse mapping — pass it `count`, otherwise
scrolling to a row misses by more the longer the list gets.

### A pool of nodes

Virtualization on its own only cuts the node count. If you render the window with
a plain `<For>` over indices, scrolling removes old rows and creates new ones —
and the created-nodes counter climbs the whole way.

A pool creates exactly as many nodes as fit the window and then only changes
their text and `transform`: a slot holds the window position whose remainder
modulo the pool size equals the slot's number, so shifting the window by one row
changes one slot instead of the whole window. Measured over identical scrolling
(20 steps of 40 rows):

| How we render | Nodes in the markup | Nodes created while scrolling |
| --- | --- | --- |
| `<For>` over the window | 27 | 594 |
| slot pool | 29 | **29** |

The implementation lives in the example rather than the kit: everyone's row
layout differs, and the trick itself is twenty lines of code.

## `createRowIndex` — sorting and filtering off the main thread

On a thousand rows the question does not arise: sort the array however you like.
On a million, `array.sort` occupies the main thread for seconds, and for all that
time the page is unresponsive — it does not scroll, does not repaint, does not
react to clicks.

```tsx
const index = createRowIndex({
  onResult: (r) => { setOrder(r.order); setShown(r.matched) },
  onProgress: (p) => setProgress(p.done),
})

index.setData({
  count: values.length,
  columns: { value: { kind: 'number', values } },   // Float64Array or string[]
})

index.query({
  filter: { column: 'value', contains: '137' },     // or min/max
  sort: { column: 'value', dir: 'desc' },
})
```

The result is a `Uint32Array` of **row numbers**, not reordered data: 4 bytes per
row against copying objects around. Nobody moves the data itself.

The work happens in a worker assembled from a string inside the package (a
separate file would have to ship next to the bundle, and every bundler would need
to be told where to find it). If the worker will not start, the same chunked work
runs on the main thread; `threaded` tells you which one you got.

### Why the sort is hand-written

The built-in `sort` cannot be stopped, and while it runs the worker reads no
incoming messages and cannot cancel a stale request. Typing in a filter field
sends a request per keystroke — without cancellation, by the last letter there is
a dozen dead sorts queued up.

Hence bottom-up merge sort that keeps its state between chunks: the work can be
dropped mid-sentence. Between chunks the worker yields to its message queue, and
cancellation gets its chance.

### Shared memory

When the page is isolated (`crossOriginIsolated`), the columns and the order
array live in a `SharedArrayBuffer`: nothing is copied into the worker at all,
and rows that passed the filter are visible **while the filter is still running**
— such a result arrives with `partial: true`. Without isolation the same thing
works on copies, with the result travelling back by `transfer`. The `shared`
field tells you which one you got.

Isolation is switched on by `COOP`/`COEP` headers on every server response. Static
hosting like GitHub Pages has no way to add them, so the playground installs them
itself through a service worker
([`playground/public/coi-sw.js`](../playground/public/coi-sw.js)) — a well-known
trick, the one WASM builds live by. `COEP` there is `credentialless` rather than
`require-corp`: under `require-corp` any third-party image without a `CORP` header
simply fails to load.

### Numbers

A million rows, the value being a number, filtering by a substring of its digits:

| What | Worker | Main thread |
| --- | --- | --- |
| sort descending | 106–114 ms | 122 ms |
| filter (1003 matches out of 1,000,000) | 17 ms | — |

The difference is not in the numbers themselves — it is the same work. The
difference is that in the first case those hundred milliseconds are not taken
away from scrolling.

## What is deliberately missing

- **Variable-height lists without declared sizes.** If a row's height can only be
  learned by measuring it, that is a different primitive with a different price,
  and it is absent on purpose. `itemSizes` takes sizes from the consumer, not
  from the DOM.
- **Text columns in shared memory.** Strings cannot go into a
  `SharedArrayBuffer`, so they travel as a copy; numeric columns do not.
- **Text sorting** compares code points (`<`, `>`) rather than going through
  `localeCompare`: on a million rows the latter costs more than all the rest of
  the work combined.
