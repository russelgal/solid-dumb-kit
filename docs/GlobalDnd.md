**English** · [Русский](ru/GlobalDnd.md)

# Global DnD: dragging between unlike things

A problem write-up and a proposal, not a description of something that exists. None of this is implemented yet.

## What's missing

The kit has three "between" mechanisms, and all three move like into like:

| mechanism | what it moves |
| --- | --- |
| `createSortableGroup` | an item from one list into another list |
| `createDumbGridGroup` | a block from one grid into another grid |
| `createDumbGridDndGroup` | the same over native DnD |

Each group knows its members by name and carries exactly one kind of cargo. You can't drag a table row into a dashboard block, or a tree node into a kanban column. And that's usually what gets asked for: "drag the product from the table into the order", "drop the file from the tree onto the widget".

Folding the three groups into one won't do it: they differ not in details but in **what drives the gesture**, and that separation is deliberate (see "Two grids: pointer and native" in `CLAUDE.md`).

## What should be shared

The **contract**, not the code. A source declares what it offers; a zone declares what it takes; a type string links them. Then the table knows nothing about the grid, the grid nothing about the tree, and dragging between them works.

```
source: type 'order/row',  cargo { id: 'r42' }
zone:   accepts 'order/row' and 'catalog/item'
```

No central registry, no common parent, no knowledge of each other — just matching strings.

## Transport one: native DnD

Nothing to invent here: **the browser already is that shared bus**. `dragstart` on anything, `dragover` anywhere, `dataTransfer` carries the cargo. It works across components, across frames, across windows, even across applications.

```ts
// source
ev.dataTransfer.setData('application/x-dumb-kit+order/row', JSON.stringify({ id }))
ev.dataTransfer.setData('text/plain', 'Order #42')   // so it can be dropped into a plain field

// zone
const accepted = [...ev.dataTransfer.types].some((t) => zone.accepts(t))
```

**The gotcha that shapes the whole API.** During `dragover` the cargo CANNOT be read — `getData()` returns an empty string there, as a privacy measure. Only the list of **types** is available (`dataTransfer.types`). So the accept-or-not decision has to be made from the type, which makes the type the contract. Cargo is readable in `drop` only.

Which means:

- the type must carry enough to decide without the cargo (`order/row`, not `row`);
- case isn't preserved everywhere — Chrome lowercases types, so write them lowercase;
- always include `text/plain`: without it Firefox won't start the gesture, and the cargo can't be dropped into an ordinary text field.

## Transport two: pointer events

Native DnD has no touch, so a finger needs its own transport. There's no shared bus here — we have to keep one: a module-level registry of zones with rects taken via `IntersectionObserver`, and a hit test done arithmetically per frame. That's exactly what `sortableGroup` and `gridGroup` already do.

The only difference from the native transport is who answers "what is the cursor over". The contract is the same.

| | native | pointer |
| --- | --- | --- |
| hit test | the browser | our zone registry |
| touch | no | yes |
| across windows | yes | no |
| cargo while moving | type only | all of it |
| cost | zero | one zone snapshot per gesture |

## What it looks like without Solid

The core is two functions, with no framework import at all — the same layering as `sortableCore` and `gridCore`.

```ts
import { createDragSource, createDropZone } from '@solid-dumb-kit/dnd-core'

const stopSource = createDragSource(rowEl, {
  type: () => 'order/row',
  data: () => ({ id: row.id }),
  text: () => row.title,          // for foreign fields and for Firefox
})

const stopZone = createDropZone(basketEl, {
  accepts: (type) => type === 'order/row',
  onOver: (pos) => highlight(pos),
  onDrop: (payload, pos) => addToBasket(payload.data, pos),
})
```

Both return an unsubscribe function — the only thing a framework needs afterwards.

Transport is a prop, not a separate package:

```ts
createDropZone(el, { transport: 'pointer', ... })   // defaults to 'native'
```

## What it looks like with Solid

Solid has `use:` directives, and this contract fits them exactly, because a directive *is* "attach something to an element and detach it on unmount".

```tsx
import { dragSource, dropZone } from '@solid-dumb-kit/dnd'

<tr use:dragSource={{ type: 'order/row', data: () => row }} />

<div use:dropZone={{
  accepts: (t) => t === 'order/row',
  onDrop: (p) => setBasket((b) => [...b, p.data]),
}} />
```

Underneath are the same `createDragSource`/`createDropZone`, wrapped in `onCleanup`. A three-line layer, like `solid.ts` in the other packages: under Solid 2, or another framework, only that gets rewritten.

Reactivity falls out naturally: `accepts` and `data` are functions, so they read at call time and see fresh signals without subscriptions.

## What has to be decided

**Zone highlighting.** Native `dragenter`/`dragleave` can't count nesting: entering a child looks like leaving the parent, and the highlight flickers. The fix is an entry counter — precisely the part Atlassian's library did for us and that we'd now write ourselves (a dozen lines).

**Position within a zone.** A list wants "between which two", a grid wants "which cell". That isn't the shared layer's business: the zone gets coordinates and decides for itself. Otherwise the shared layer starts knowing about lists and grids, and we're back where we started.

**Cancelling.** Escape, and a drop outside any zone, must put everything back. On the native transport that's `dragend` with no preceding `drop`; on the pointer one it's our own check.

**Motion.** FLIP is already shared (`@solid-dumb-kit/shared`) and suits both transports unchanged.

## What the kit gets out of it

The three current groups become special cases of one contract: a list accepts `list/item`, a grid accepts `grid/block`. The existing APIs can stay as they are and the shared layer sits beside them — they don't conflict.

And something appears that doesn't exist today at all: dragging between **different kinds** of widget, without a single line that knows about both.

## What not to do

- **One app-wide "DnD manager".** It turns into global state you have to reset, and it breaks on two independent gestures.
- **Cargo inside the type.** Encoding data into the type string (`order/row?id=42`) is tempting because it *is* readable during `dragover`. But types reach the system clipboard and are visible to other applications.
- **Position in the contract.** Only the zone knows "where exactly"; the shared layer should pass coordinates and nothing more.

## Order of work, if it happens

1. `dnd-core` — the contract and the native transport, framework-free;
2. a probe in `examples/lab/` — a table and a grid, dragging a row into a block;
3. the pointer transport on the same contract;
4. `use:` directives for Solid;
5. and only then decide whether to move the existing groups onto the shared layer.
