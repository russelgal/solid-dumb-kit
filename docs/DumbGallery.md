[Русский](ru/DumbGallery.md) · **English**

# DumbGallery

Images: pick, look, reorder, upload.

Assembled from things that already exist: file picking and drop-into-window come
from [`@solid-primitives/upload`](https://primitives.solidjs.community/package/upload),
reordering from [`DumbSortable`](DumbSortable.md) (the pointer engine, so it
works with a finger too), uploading from a queue with a transport you supply.

## How it works

**The picture shows up immediately.** A picked file is displayed from its
`objectURL` without waiting for any upload. With no transport that's all the
gallery is — a local set that goes nowhere.

**Uploads go through a queue.** Twenty files won't fly as twenty requests: the
browser holds about six connections to one host anyway, and twenty "in flight"
bars of which six actually move are simply a lie. The queue runs a few at a
time, the rest wait as `queued` and can be dropped instantly — removing a tile
**aborts** the request rather than letting it finish into nowhere.

**The order is your data.** The component stores nothing: added, reordered,
removed, finished uploading — every change goes to `setItems`.

## The gallery never sees storage keys

A bucket key is a key to the **whole bucket**: delete, overwrite, read what
isn't yours. It has no place in a browser in any form — not in build-time
variables, not "just for a moment". Its place is on the server, and the browser
gets a URL signed for one object and a few minutes.

So the gallery knows nothing about the bucket, the region or the endpoint. The
one thing it reaches out for is a signature:

```tsx
import { DumbGallery, createPresignedUploader } from '@solid-dumb-kit/gallery'

const upload = createPresignedUploader({
  sign: (file) =>
    fetch('/api/sign', {
      method: 'POST',
      body: JSON.stringify({ name: file.name, type: file.type }),
    }).then((r) => r.json()),   // → { url, headers?, key?, publicUrl? }
})

<DumbGallery items={items()} setItems={setItems} upload={upload} />
```

Signing is your server's job. For Garage (and any S3-compatible store) that's
`getSignedUrl` from `@aws-sdk/s3-request-presigner`:

```ts
// on the server; the keys live only here
const url = await getSignedUrl(
  s3,                                   // S3Client with endpoint and forcePathStyle
  new PutObjectCommand({ Bucket, Key: key, ContentType: type }),
  { expiresIn: 300 },
)
return { url, key, publicUrl: `${PUBLIC_BASE}/${key}` }
```

**Headers that went into the signature must be repeated exactly.** If you signed
`ContentType`, the browser has to send precisely that `Content-Type` or the
store answers `403`. That's what `headers` in the response is for.

### Why XHR and not fetch

`fetch` has no upload progress: a `ReadableStream` request body isn't supported
everywhere, and where it is you need HTTP/2 and `duplex: 'half'`.
`XMLHttpRequest.upload.onprogress` works everywhere and exists for exactly this.
That's what `createPresignedUploader` uses.

## Your own transport

`upload` is an ordinary function. If you post to your own endpoint rather than
S3, write it yourself:

```ts
const upload: Uploader = async (file, { onProgress, signal }) => {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body, signal })
  if (!res.ok) throw new Error(`server answered ${res.status}`)
  return await res.json()      // → { url, key? }
}
```

Progress won't move here (see above); everything else works as usual.

## Props

| prop | type | what it does |
| --- | --- | --- |
| `items` | `Array<GalleryItem>` | the set; array order = on-screen order |
| `setItems` | `(next) => void` | the new set: added, reordered, removed, uploaded |
| `upload` | `Uploader` | what to upload with; absent — the gallery is local |
| `concurrency` | `number` | how many at once, defaults to `3` |
| `accept` | `string` | what to allow, defaults to `image/*` |
| `multiple` | `boolean` | allow picking several at once |
| `max` | `number` | take no more than this many |
| `tile` | `string` | tile width, css; defaults to `minmax(120px, 1fr)` |
| `editable` | `boolean` | edit mode; `false` means no picking, no reorder, no removal |
| `animate` | `boolean` | animate reordering |
| `onOpen` | `(item, index) => void` | tile click |
| `children` | `(item, index) => JSX.Element` | your own tile |

### GalleryItem

| field | meaning |
| --- | --- |
| `id` | required, stable |
| `url` | where the picture really lives (after upload) |
| `preview` | the picked file's `objectURL`; shown while it exists |
| `name`, `size` | from the file |
| `status` | `local` · `queued` · `uploading` · `done` · `error` |
| `progress` | `0…1` while uploading |
| `error` | the message if it failed |
| `key` | storage key — comes from the transport |

## The queue on its own

`createUploadQueue` knows nothing about the DOM or Solid — if you're drawing
your own gallery, take just that:

```ts
const q = createUploadQueue(upload, { onStart, onProgress, onDone, onError }, 3)
q.add(id, file)
q.cancel(id)     // drops a waiting one, aborts a running one
q.destroy()      // on unmount
```

## What it doesn't do

- **No resizing or compression.** Want smaller previews — that's `imgproxy` or
  whatever else on your side; the kit has `imgproxyUrl` in
  `@solid-dumb-kit/utils` for building the URLs.
- **No lightbox.** `onOpen` fires; the viewer is yours.
- **No persistence.** `items` is your array, and so is storing it.
- **No automatic retry.** The `error` status is visible; whether to retry is
  your call — call `upload` for the same files again.
