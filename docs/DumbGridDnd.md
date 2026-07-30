**English** · [Русский](ru/DumbGridDnd.md)

# DumbGridDnd

The dashboard grid, but the drag is run by the **native HTML5 drag-and-drop API**.

```tsx
import { DumbGridDnd, createDumbGridDndGroup } from 'solid-dumb-kit'
```

This is a **separate component**, not a mode of [`DumbGrid`](DumbGrid.md). The two have different gesture mechanics and different trade-offs; mixing them in one code path is how you break both. They share only the layout maths.

## Which one to take

| | [`DumbGrid`](DumbGrid.md) | `DumbGridDnd` |
|---|---|---|
| Gesture | ours, on pointer events | the browser's, on `dragstart`/`dragover`/`drop` |
| Which grid is under the pointer | we hit-test snapshotted rects | the browser — `dragover` arrives at the container |
| Touch | works | **not supported** — HTML5 DnD does not exist there |
| Drag image | ours, a live clone in the top layer | the browser's static snapshot |
| Edge auto-scroll | ours | the browser's |
| Leaving the page | no | yes — the block is announced via `dataTransfer` |

Everything else is identical, because it is the same code: layout arithmetic, neighbours parting via `transform`, the dashed preview frame, resize snapping, three modes, presets, persistence, edit mode.

Resize is on pointer events in both: it is not a transfer, never leaves its grid, and needs per-frame precision `dragover` does not give.

## Usage

Identical to `DumbGrid` — same props, same items:

```tsx
<DumbGridDnd
  cols={12}
  rowHeight={92}
  storageKey="dashboard"
  items={[
    { id: 'revenue', w: 'half', h: 2, content: () => <Revenue /> },
    { id: 'orders',  w: 'quarter',   content: () => <Kpi /> },
  ]}
/>
```

`mode` (`flow` / `dense` / `free`), `showGrid`, `editable`, `onRemove`, `layout`/`onLayout`, `spareRows`, size presets — all behave as documented for [`DumbGrid`](DumbGrid.md).

## Moving a block between grids

```tsx
const group = createDumbGridDndGroup({
  onTransfer: (from, to) => { /* from: {grid, id, index} → to: {grid, index, x, y} */ },
})

<DumbGridDnd group={group} name="sales" items={salesItems()} />
<DumbGridDnd group={group} name="ops"   items={opsItems()} />
```

`accepts: (from) => boolean` on a grid refuses incoming blocks — it is checked twice, in `dragover` (no `preventDefault`, so the browser will not drop) and again in `drop`, because the rule should not live in the handler that merely delivers the event.

`group.over()` is a signal with the name of the grid under the pointer — use it to highlight the receiver.

## What leaves the page

On `dragstart` the block is written to `dataTransfer` as:

- `application/x-dumb-grid` — `{"grid": "...", "id": "..."}` (exported as `DND_MIME`);
- `text/plain` — the id, so a plain text target gets something meaningful.

That is what makes a block legible to another window or a non-kit drop target, and it is also why Firefox starts the drag at all — it refuses without data.

## Engine without a framework

`createGridDndEngine` (`dndCore.ts`) imports no `solid-js`: it takes elements and returns unsubscribe functions. `createDumbGridDndGroup` is the thin Solid wrapper. `dndSupported()` reports whether the API exists at all.
