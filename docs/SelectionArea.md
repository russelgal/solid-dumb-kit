**English** · [Русский](ru/SelectionArea.md)

# SelectionArea

Finder-style **rubber-band selection**: drag the mouse to draw a box and select the elements it touches. `Shift` / `Cmd` / `Ctrl` add to the current selection. A thin SolidJS wrapper over [`@viselect/vanilla`](https://github.com/Simonwep/selection).

```tsx
import { SelectionArea } from 'solid-dumb-kit'
import 'solid-dumb-kit/dist/index.css'
```

## Example

```tsx
import { createSignal, For } from 'solid-js'
import { SelectionArea } from 'solid-dumb-kit'

function Files(props: { files: { id: string; name: string }[] }) {
  const [selected, setSelected] = createSignal<Set<string>>(new Set())

  return (
    <SelectionArea
      selectables=".file-card"
      onSelect={({ store }) =>
        setSelected(new Set(
          [...store.stored, ...store.selected].map(el => (el as HTMLElement).dataset.key!),
        ))
      }
    >
      <div class="grid">
        <For each={props.files}>
          {(f) => (
            <div
              class="file-card"
              data-key={f.id}
              classList={{ active: selected().has(f.id) }}
            >
              {f.name}
            </div>
          )}
        </For>
      </div>
    </SelectionArea>
  )
}
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `selectables` | `string` | — (required) | CSS selector of selectable elements. |
| `children` | `JSX.Element` | — (required) | Container content. Rendered inside a `position: relative` wrapper. |
| `onSelect` | `(e: SelectionEvent) => void` | — | Fires on every selection change during drag. |
| `onStop` | `(e: SelectionEvent) => void` | — | Fires when the drag ends. |
| `onBeforeStart` | `(e: SelectionEvent) => boolean \| void` | — | Return `false` to cancel a selection before it starts. |
| `intersect` | `'touch' \| 'cover' \| 'center'` | `'touch'` | How an element counts as selected: `touch` = box touches it, `cover` = box fully covers it, `center` = box covers its center. |
| `class` | `string` | — | Extra class on the container `<div>`. |
| `style` | `JSX.CSSProperties` | — | Inline styles on the container. Put `overflow`/`max-height` **here** if the list scrolls — see below. |
| `selectionAreaClass` | `string` | `'viselect-area'` | Class applied to the rubber-band rectangle. |
| `boundaries` | `(string \| HTMLElement)[]` | `[container]` | Elements that constrain where selection can start/extend. |
| `behaviour` | `Partial<SelectionOptions['behaviour']>` | see below | Passed through to `@viselect/vanilla`. |
| `features` | `Partial<SelectionOptions['features']>` | see below | Passed through to `@viselect/vanilla`. |
| `windowScroll` | `boolean` | `false` | Auto-scroll the **window** while dragging past the viewport edge (for pages without an overflow container). See notes. |

### Built-in defaults

`behaviour`: `{ overlap: 'invert', intersect: 'touch', startThreshold: 10 }`
`features`: `{ touch: true, range: true, singleTap: { allow: true, intersect: 'native' }, deselectOnBlur: false }`

Your `behaviour` / `features` props are shallow-merged on top of these.

## Behaviour baked in

- **Additive modifiers** — holding `Shift`, `Cmd`, or `Ctrl` keeps the existing selection and adds to it; a plain drag clears it first.
- **`.viselect-selected` class** — added/removed automatically on elements as they enter/leave the selection. Style this class to show the selected state.
- **Ignored targets** — a drag starting on `button, a, input, [data-no-select]` is suppressed, so interactive controls keep working. Add `data-no-select` to opt an element out.

## Styling

The bundled CSS (`solid-dumb-kit/dist/index.css`) styles:

- `.viselect-area` — the rubber-band rectangle (uses `currentColor`, so it adopts the surrounding text color).
- `.viselect-window-scroll *::selection` — keeps native text-selection invisible while `windowScroll` is active.

You style the **selected items** yourself via `.viselect-selected` (or your own derived state, as in the example).

## Scrolling lists: the container must be the scroller

The rubber band is measured against the **boundary** — by default the component's own container. If something *inside* it scrolls instead, the box stays pinned to the viewport while the items move under it, and scrolling silently drops everything that left the visible area from the selection.

So put the scroll on the container itself:

```tsx
<SelectionArea
  selectables=".card"
  style={{ 'max-height': '60vh', 'overflow-y': 'auto' }}   // ← here, not on a child
>
  <div class="grid">…</div>
</SelectionArea>
```

Or point `boundaries` at whatever actually scrolls:

```tsx
<SelectionArea selectables=".card" boundaries={['.my-scroll-area']}>
```

**Known limitation.** Even wired correctly, the selection is always “whatever the box currently covers” — that's how `@viselect/vanilla` works (`_updateElementSelection` recomputes from live rects, so anything leaving the box is deselected). Scroll far enough during a drag and earlier items can drop out. The same happens in viselect's own demos; we're not working around it.

If you ever need selection to stick, accumulate it yourself instead of mirroring the store:

```tsx
onSelect={({ store }) =>
  setSelected(prev => new Set([...prev, ...store.changed.added.map(el => el.dataset.key!)]))
}
```

## `windowScroll` notes

When the selectable area isn't inside its own scroll container (the whole page scrolls), set `windowScroll` so dragging near the viewport edge scrolls the window. It works by briefly enabling a native text selection to trigger the browser's built-in autoscroll; the bundled CSS hides that selection, and it's cleared shortly after the drag stops.

## `SelectionEvent`

Re-exported from `@viselect/vanilla`. The most useful field is `store`:

- `store.selected` — elements selected in the current drag.
- `store.stored` — elements selected in previous (additive) drags.
- `store.changed.added` / `store.changed.removed` — delta for the latest move.
