**English** · [Русский](ru/SelectionArea.md)

# SelectionArea

Finder-style **rubber-band selection**: drag to draw a box and select what it touches. `Shift` / `Cmd` / `Ctrl` add to the selection. Clicking works too — plain click selects one item, modifier-click toggles it.

```tsx
import { SelectionArea } from 'solid-dumb-kit'
```

No CSS to import, no dependencies. Element positions are snapshotted **once** per gesture via `IntersectionObserver`, and each frame only does arithmetic — so the hot path never touches layout.

> Previously this wrapped `@viselect/vanilla`. That library calls `getBoundingClientRect()` on *every* selectable on *every* move — hundreds of forced layouts per frame, which is exactly what this kit forbids. The engine is now our own; the API changed with it (see [Migrating](#migrating-from-the-viselect-based-version)).

## Example

```tsx
import { createSignal, For } from 'solid-js'
import { SelectionArea } from 'solid-dumb-kit'

function Files(props: { files: { id: string; name: string }[] }) {
  const [selected, setSelected] = createSignal<Set<string>>(new Set())

  return (
    <SelectionArea
      selectables=".file-card"
      selected={selected}
      onChange={setSelected}
      style={{ 'max-height': '60vh', 'overflow-y': 'auto' }}
    >
      <div class="grid">
        <For each={props.files}>
          {(f) => (
            <div class="file-card" data-key={f.id} classList={{ active: selected().has(f.id) }}>
              {f.name}
            </div>
          )}
        </For>
      </div>
    </SelectionArea>
  )
}
```

Selection state lives in **your** signal — the component never owns it. Each item is identified by `data-key`.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `selectables` | `string` | — (required) | CSS selector of selectable elements. |
| `selected` | `() => Set<string>` | — (required) | Current selection (keys). |
| `onChange` | `(selected: Set<string>) => void` | — (required) | Fires whenever the selection changes, during the drag too. |
| `onStop` | `(selected: Set<string>) => void` | — | Gesture finished. |
| `onBeforeStart` | `(ev: PointerEvent) => boolean \| void` | — | Return `false` to prevent a gesture. |
| `keyAttr` | `string` | `'data-key'` | Attribute holding an item's key. |
| `intersect` | `'touch' \| 'cover' \| 'center'` | `'touch'` | How an element counts as selected: box touches it, covers it fully, or covers its centre. |
| `threshold` | `number` | `10` | Pixels to move before the band appears; below that it's a click. |
| `areaClass` | `string` | — | Class on the band (structural styles are inline already). |
| `class` | `string` | — | Extra class on the container. |
| `style` | `JSX.CSSProperties` | — | Container styles — put `overflow`/`max-height` here if the list scrolls. |

## Behaviour

- **Modifiers** — holding `Shift`/`Cmd`/`Ctrl` while dragging only ever **adds** to the existing selection; sweeping over already-selected items never clears them. A plain drag replaces the selection.
- **Clicks** — a click on an item selects just it; with a modifier it toggles. A click on empty space clears the selection (with a modifier, nothing happens).
- **Ignored targets** — a gesture starting on `button, a, input, select, textarea, [data-no-select]` is skipped, so controls keep working. Add `data-no-select` to opt an element out.
- **Auto-scroll** — dragging near the container edge scrolls it, speeding up the further you push.
- **Scrolling keeps the selection** — the band lives in *content* coordinates, so it grows with the scroll and items you already swept don't fall out. (The viselect-based version dropped them; that's fixed by construction now.)

## Styling

The band is drawn inline using `currentColor`, so it adapts to the surrounding theme out of the box. Pass `areaClass` if you want your own look — structural styles (`position`, `pointer-events`) stay inline regardless.

Selected items are styled by **you**, from your own state — as in the example's `classList`.

## `createSelectionArea` primitive

The component is a thin wrapper; the engine is usable directly when you own the markup:

```tsx
import { createSelectionArea } from 'solid-dumb-kit'

const area = createSelectionArea({
  container: () => hostEl,
  selectables: '.row',
  current: () => selected(),
  onChange: (next) => setSelected(next),
})
area.attach(hostEl)
```

## Migrating from the viselect-based version

| Before | Now |
| --- | --- |
| `onSelect={({ store }) => …}` with `store.stored`/`store.selected` | `selected={sig}` + `onChange={setSig}` — plain `Set<string>` |
| element lookup via `el.dataset.key` in your handler | keys resolved for you (`keyAttr`, default `data-key`) |
| `import 'solid-dumb-kit/dist/index.css'` | not needed, band is inline |
| `behaviour` / `features` / `boundaries` / `windowScroll` | dropped — `intersect`, `threshold`, `areaClass` cover the useful parts |
| `SelectionEvent` type | gone with viselect |
