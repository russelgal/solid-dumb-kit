**English** · [Русский](ru/DumbToast.md)

# DumbToast

Toast messages: a queue, auto-dismiss, and questions with buttons.

```tsx
import { DumbToaster, toast } from '@solid-dumb-kit/toast'
```

The bus lives **in the module**, not in the component: `toast.error(...)` has to
be callable from anywhere — a storage adapter, an error handler, code that knows
nothing about markup. The component only draws the queue.

## Four things that make this more than ten lines

**Identical messages collapse.** Twenty files failing to upload is one message
with a counter, not twenty stacked toasts. Toasts with buttons don't collapse:
each has its own handler, and "×3" on a question would mean two answers went
missing.

**The timer lives outside.** Hovering pauses it: text sliding away from under
your eyes can't be read.

**Errors don't fade on their own.** They get read and acted on, so
`toast.error` defaults to zero time-to-live.

**We re-enter the top layer on every message.** The top layer is a stack, and
whoever entered later sits above. A toaster hanging there since page load would
end up BELOW a modal opened afterwards — exactly where it's useless, since errors
most often come from modals.

## A question instead of `confirm()`

```tsx
const ok = await toast.confirm('Delete permanently?', {
  yes: 'Delete', danger: true, at: 'pointer',
})
```

A question has **no timer and no close button**: closing without answering is an
implicit answer, and nobody knows which one. You answer with buttons.

`at: 'pointer'` puts the toast **by the cursor**, using the same technique as the
context menu: an invisible anchor at the point plus `anchor()`. A question about
a particular row is easier to read next to it than in a screen corner.

Why not `confirm()`: it blocks the whole tab — along with an upload in flight —
looks foreign in any theme, and you can't write in it what exactly will happen.

## API

| | |
| --- | --- |
| `toast.info / success / error` | ordinary messages |
| `toast.ask(text, actions)` | a question with arbitrary buttons |
| `toast.confirm(text, opts)` | `Promise<boolean>` |
| `toast.dismiss / clear` | close one / all |
| `createToastBus()` | your own bus: tests, two independent areas |

A button is `{ label, run, kind: 'primary' | 'danger', keepOpen }`.
`DumbToaster` takes `position`, `max`, its own `bus`, and a custom toast via
`children`.

## Notification center

A dismissed toast doesn't disappear — it flies to the edge, into a history
panel, like on macOS. The panel and its bell with an unread counter live in the
same top layer (Popover API), so they sit above modals without a single
`z-index`.

```tsx
// both are mounted ONCE per app, usually next to the root
<DumbToaster position="bottom-right" max={6} />
<DumbToastCenter />
```

The bell can be turned off (`bell={false}`) and the panel opened by your own
button — `toast.toggleHistory()` is callable from anywhere, the bus lives in a
module.

| | |
| --- | --- |
| `toast.history()` | what has been read and dismissed |
| `toast.unread()` | unread counter |
| `toast.forget(id)` / `toast.clearHistory()` | drop one entry / clear history |
| `toast.toggleHistory()` | open or close the panel |
| `toast.pause() / resume()` | stop timers (the toaster does this under the cursor) |

`DumbToastCenter` takes `side`, `bell`, `title`, `closeSide`, `animate`, and a
custom history row via `children`.

## A toast question or a modal question

`toast.confirm` is for when work continues: you asked about a row in a list,
answered, moved on. When work has stopped and an answer is mandatory — closing a
window with unsaved changes, wiping data — the question must be modal, on top of
what it is about: `modal.confirm` from
[`@solid-dumb-kit/modal`](DumbModal.md).
