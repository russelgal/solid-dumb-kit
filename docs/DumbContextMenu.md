[Русский](ru/DumbContextMenu.md) · **English**

# DumbContextMenu and DumbPopover

A right-click menu and a card at a point.

```tsx
import { DumbContextMenu, DumbPopover } from '@solid-dumb-kit/context-menu'
```

## The browser picks the side

The usual way to find out where to open is to insert the menu, measure it
(`getBoundingClientRect`) and move it. That's a forced layout at exactly the
moment the browser is busiest.

Here there are two platform mechanisms and no measurements:

- **Popover API** (`popover="manual"`) — the menu lives in the **top layer**:
  above everything including other people's modals, not clipped by an ancestor's
  `overflow`, no `z-index` auction;
- **anchor positioning** — a one-pixel invisible anchor is placed at the click
  point, the menu attaches to it, and near a window edge the browser picks the
  side (`position-try-fallbacks`).

A trap on that path: Chrome silently drops `position-area: bottom
span-inline-end` as invalid and the menu flies to the top-left corner. Binding
goes through `anchor()`.

## A macOS-style gesture

Press the right button, drag onto an item without releasing, let go — the item
fires and the menu closes. Let go elsewhere and it just closes.

The "click and the menu stays" habit still works: a short press without movement
leaves it open. The two are told apart by hold time and distance — **250 ms and
6 px**, the same thresholds as long-press elsewhere in the kit.

A subtlety: the menu is in the top layer, and on release `ev.target` points
anywhere but the item. We ask the browser what's under the cursor —
`document.elementFromPoint()`.

## Items

```tsx
<DumbContextMenu
  target={() => area}
  items={() => [
    { label: 'Open', icon: 'icon-[solar--eye-bold]', run: open },
    { label: 'Copy', hint: '⌘C', run: copy },
    { kind: 'separator' },
    { label: 'Delete', danger: true, disabled: !picked(), run: remove },
  ]}
/>
```

Items are recomputed on every open, so they can depend on the selection. Arrows
walk the items (separators and disabled ones are skipped), Enter picks, Esc
closes, focus moves into the menu and returns afterwards.

Over an input the menu is **not intercepted**: the browser's own, with "paste",
is better there.

## DumbPopover

The same top-layer placement and the same anchoring, but with arbitrary content:
`at`, `title`, `footer`, `children`. Use it where a centred modal breaks the link
with what it describes — a booking card belongs next to the booking.
