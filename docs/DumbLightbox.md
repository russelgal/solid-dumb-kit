[Русский](ru/DumbLightbox.md) · **English**

# DumbLightbox

A viewer: full-screen image, paging, zoom.

```tsx
import { DumbLightbox } from '@solid-dumb-kit/lightbox'
```

Rendered by the native `<dialog>`, i.e. in the **top layer**: above everything on
the page, with focus trapping and Esc handled by the browser. No `position:
fixed` with `z-index: 99999` needed — and it would lose to someone else's modal
in the top layer anyway.

## What matters inside

**Zoom and pan are `transform` only.** Layout is never touched, so wheel zoom
stays within the frame even on a large image.

**Neighbours are prefetched** — one forward, one back, via `new Image()`. Without
it every arrow press shows emptiness and browsing turns into waiting.

**A click on the backdrop closes, on the image doesn't.** Told apart by
`ev.target === ev.currentTarget`.

## Keys

| | |
| --- | --- |
| `←` `→` | page around |
| `+` `−`, wheel | zoom |
| `0` | reset |
| double click | zoom in and back |
| `Esc`, backdrop click | close |

A zoomed image can be dragged.

## Props

`items` (`{url, title, preview}`), `index` / `onIndexChange` for what's open,
`actions` for your own buttons at the bottom (download, delete), `animate`.
