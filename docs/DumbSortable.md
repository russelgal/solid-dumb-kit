# DumbSortable

Zero-dependency **drag-to-reorder** for SolidJS — a vertical list **or** a 2D grid, with auto-scroll, variable row heights, and **no layout reflow during drag**.

Comes in two flavours:

- **`DumbSortable`** — declarative component, you return your own element for each item.
- **`createDumbSortable`** — the underlying primitive (manual refs), for when you need full control (custom tables, existing markup).

```tsx
import { DumbSortable, createDumbSortable } from 'solid-dumb-kit'
```

No CSS needed — movement is pure inline `transform`.

## Why it doesn't jank

Most drag libs call `getBoundingClientRect()` per frame during the drag → forced reflow → jank (that's why optimistic moves often have to be disabled). `DumbSortable` snapshots every cell's position **once** at drag start via `IntersectionObserver` (bounds computed off-main-thread, no reflow), then only writes `transform` (GPU/compositor) while moving. The array order is committed once on drop.

## `DumbSortable` component

```tsx
import { createSignal } from 'solid-js'
import { DumbSortable } from 'solid-dumb-kit'

const [list, setList] = createSignal([
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Bravo' },
  { id: 'c', label: 'Charlie' },
])

// the CONTAINER is yours
<div class="space-y-2 overflow-auto max-h-[60vh]">
  <DumbSortable items={list()} setItems={setList} id={(x) => x.id}>
    {(item) => (
      // the ELEMENT is yours — any tag/classes/per-item styles
      <div class="row">
        <button data-drag-handle>⠿</button>
        {item.label}
      </div>
    )}
  </DumbSortable>
</div>
```

The component renders a `<For>` over `items`, takes the **real DOM node** your `children` returns, and attaches drag to it directly — no wrapper element, no ref plumbing.

### Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `Array<T>` | — (required) | Current items, in visual order. |
| `setItems` | `(next: Array<T>) => void` | — (required) | Called on drop with the reordered array. |
| `id` | `(item: T) => string` | — (required) | Stable id for an item. |
| `children` | `(item: T, index: () => number) => JSX.Element` | — (required) | **Must return one root DOM element** — drag binds to it. |
| `axis` | `'y' \| 'grid'` | `'y'` | `y` = vertical list, `grid` = 2D grid (delta on X and Y, diagonal jump across rows). |
| `disabled` | `() => boolean` | — | Disable dragging (e.g. while a column sort is active). |
| `pressDelay` | `number` | `350` | Touch: long-press hold (ms) before drag starts; moving earlier = scroll. `0` = start immediately. |
| `mousePressDelay` | `number` | `0` | Mouse: long-press (ms) before start. Takes priority over `mouseThreshold`. |
| `mouseThreshold` | `number` | `0` | Mouse: distance (px) to move before drag starts. `0` = start immediately. |

### The drag handle

Put `data-drag-handle` on a child to drag only by that handle. Omit it and the **whole element** is draggable.

```tsx
{(item) => (
  <div class="row">
    <button data-drag-handle>⠿</button>   {/* drag by this */}
    <span>{item.label}</span>             {/* clicks here don't drag */}
  </div>
)}
```

## `createDumbSortable` primitive

Use this when you can't return the element from a single render prop — e.g. a headless table where rows and handles are wired separately. It returns refs you attach yourself.

```tsx
import { For } from 'solid-js'
import { createDumbSortable } from 'solid-dumb-kit'

const s = createDumbSortable({
  order: () => rows().map(r => r.id),
  onEnd: (from, to) => {
    const next = rows().slice()
    next.splice(to, 0, next.splice(from, 1)[0])
    setRows(next)
  },
})

<For each={rows()}>
  {(r) => (
    <div ref={s.bind(r.id)} class="row">
      <button ref={el => {}} data-drag-handle>⠿</button>
      {r.label}
    </div>
  )}
</For>
```

### Options (`DumbSortableOptions`)

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `order` | `() => string[]` | — (required) | Current visual order of ids (must match your data order). |
| `onEnd` | `(fromIndex, toIndex) => void` | — (required) | Commit the move (indices into `order()`). |
| `axis` | `'y' \| 'grid'` | `'y'` | List or grid. |
| `disabled` | `() => boolean` | — | Block dragging when true. |
| `pressDelay` | `number` | `350` | Touch long-press, ms. |
| `mousePressDelay` | `number` | `0` | Mouse long-press, ms (priority over `mouseThreshold`). |
| `mouseThreshold` | `number` | `0` | Mouse start distance, px. |

### Handle (`DumbSortableHandle`)

| Ref | Signature | Use |
| --- | --- | --- |
| `bind(id)` | `(el: HTMLElement) => void` | **All-in-one**: registers the cell *and* attaches drag-start. Looks for a `[data-drag-handle]` child (delegated); if none, the whole element is the handle. Preferred. |
| `row(id)` | `(el: HTMLElement) => void` | Low-level: register the cell element only. |
| `handle(id)` | `(el: HTMLElement) => void` | Low-level: attach drag-start to a separate handle element. Pair with `row`. |

Use **either** `bind` alone, **or** `row` + `handle` together (when the handle isn't a DOM child of the cell).

## Behaviour details

- **Variable row heights** (`axis: 'y'`) — neighbours shift by their real measured heights, not an averaged step.
- **Grid** (`axis: 'grid'`) — items reflow by X/Y delta and jump diagonally when crossing a row boundary (assumes uniform cell size).
- **Auto-scroll** — dragging near a container/viewport edge scrolls it; speed ramps up the further you push past the edge. Works against the nearest scrollable ancestor, else the window.
- **Lift affordance** — the dragged element gets a subtle scale + shadow; on touch, a short haptic `vibrate(8)` fires when the long-press triggers.
- **Coordinates** are computed in container-content space (minus top/left, plus scroll), so hit-testing and shifts are immune to scrolling mid-drag.
