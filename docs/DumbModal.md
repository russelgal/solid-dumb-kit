[Русский](ru/DumbModal.md) · **English**

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
