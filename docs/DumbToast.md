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
