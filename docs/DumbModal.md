**English** · [Русский](ru/DumbModal.md)

# DumbModal

A modal window on the native `<dialog>`.

```tsx
import { DumbModal } from '@solid-dumb-kit/modal'
```

## What the browser gives you for free

Everything people usually write two hundred lines for is already in
`showModal()`:

- the window is in the **top layer** — above everything, including other
  people's modals, and it isn't clipped by an ancestor's `overflow: hidden`;
- `::backdrop` is the overlay — no extra `div`;
- focus is trapped inside, Tab cycles;
- Esc closes it;
- the page underneath doesn't scroll.

## What had to be added

Exactly what the browser doesn't do:

- **returning focus** to where you came from. Captured BEFORE opening:
  `showModal()` has already moved it;
- **backdrop click**. It doesn't work natively: `::backdrop` has no target of its
  own and the event lands on the `<dialog>` itself — hence `ev.target ===
  ev.currentTarget`;
- **guarding the close** (`onBeforeClose`). Esc closes silently, and unsaved
  edits are gone.

## Props

| prop | type | what it does |
| --- | --- | --- |
| `open` | `() => boolean` | is it open |
| `onClose` | `() => void` | close it |
| `title`, `footer` | `JSX.Element` | header and footer; absent — not rendered |
| `onBeforeClose` | `() => boolean \| Promise<boolean>` | `false` keeps it open |
| `keepOnBackdrop`, `keepOnEsc` | `boolean` | don't close on outside click / Esc |
| `width` | `string` | width; defaults to `min(560px, 92vw)` |
| `animate` | `boolean` | animate; silently off under `prefers-reduced-motion` |

## When NOT a modal

If the window is about a specific element on the page, use
[`DumbPopover`](DumbContextMenu.md). A modal in the middle of a booking chart
covers the very booking it describes, and you have to find it again afterwards.

## A modal question: `modal.confirm`

The browser's `confirm()` blocks the whole tab and gives you no way to spell out
what will actually happen. `modal.confirm` means the same thing, but as a window
and a promise.

```tsx
import { DumbModalHost, modal } from '@solid-dumb-kit/modal'

// ONCE per app, next to the root
<DumbModalHost />

// ask from anywhere: the bus lives in a module and knows nothing about markup
const ok = await modal.confirm('Delete the booking permanently?', {
  title: 'Deletion',
  yes: 'Delete',
  no: 'Cancel',
  danger: true,
})
```

Questions form a **queue** and never interrupt each other: `current()` tells what
is on screen, `pending()` how many are waiting.

| | |
| --- | --- |
| `modal.confirm(text, opts)` | `Promise<boolean>`; dismissed without an answer — `false` |
| `modal.ask(text, actions, opts)` | several answers; returns the pressed `value`, or `opts.dismiss` |
| `modal.alert(text, opts)` | a message with one button |
| `modal.current() / pending()` | what is on screen and how many are queued |
| `createModalBus()` | your own bus: tests, two independent areas |

`dismissible: false` — the question has no safe default, so it cannot be closed
without answering.

A corner toast (`toast.confirm` from [`@solid-dumb-kit/toast`](DumbToast.md)) is
for when work continues; a window is for when it has stopped.
