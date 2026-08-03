[Русский](ru/DumbGallery.md) · **English**

# DumbGallery

Images: pick, look, reorder, upload.

Assembled from things that already exist: file picking and drop-into-window come
from [`@solid-primitives/upload`](https://primitives.solidjs.community/package/upload),
reordering from [`DumbSortableDnd`](DumbSortableDnd.md), uploading from a queue
with a transport you supply.

**Order comes from CSS `order`; the markup doesn't move.** The browser relocates
zero nodes during a gesture — verified with a mutation counter. Hence the
requirement on the container: it has to be a grid or a flex box, and the
gallery's own grid is exactly that.

The price of a native gesture is that **you can't reorder with a finger**: HTML5
drag-and-drop doesn't exist on touch. Picking, viewing and removing all work with
a finger; if you need the order too, take `DumbSortable` and draw the tiles
yourself.

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

### The `requestChecksumCalculation` trap

A recent `@aws-sdk/client-s3` (verified on 3.1101) adds checksum headers to the
signature by default — `x-amz-sdk-checksum-algorithm` and
`x-amz-checksum-crc32`. The browser doesn't compute them, so the store answers:

```
400 InvalidDigest: Failed to validate checksum for algorithm Crc32
```

One line on the signing client fixes it:

```ts
const s3 = new S3Client({
  endpoint, region, credentials,
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',   // ← without this a presigned PUT fails
})
```

Verified against a live Garage: without the line `400 InvalidDigest`, with it
`200` and the object reads back.

**Headers that went into the signature must be repeated exactly.** If you signed
`ContentType`, the browser has to send precisely that `Content-Type` or the
store answers `403`. That's what `headers` in the response is for.

### After upload the tile shows the REMOTE address

As soon as a file arrives, the local `objectURL` is released and the item's
`url` switches to whatever the transport returned. If `publicUrl` is configured
wrongly the tile goes blank — deliberately: a blank tile says the address
doesn't work, rather than hiding the mistake behind a local copy the consumer
won't have after a reload.

### Why XHR and not fetch

`fetch` has no upload progress: a `ReadableStream` request body isn't supported
everywhere, and where it is you need HTTP/2 and `duplex: 'half'`.
`XMLHttpRequest.upload.onprogress` works everywhere and exists for exactly this.
That's what `createPresignedUploader` uses.

## Trying it against a live store

The kit's showcase already has this wired up — **for development only**. The dev
server exposes `/api/sign` (the `playground/devSign.ts` plugin, `apply: 'serve'`)
which signs a URL with keys from the root `.env`. The built showcase and Pages
have no server, hence no signing: there the tab honestly runs on the fake
transport.

```bash
cp .env.example .env      # fill in S3_ENDPOINT, S3_BUCKET, the keys
pnpm demo                 # the console prints «дев-подпись: <bucket> on <endpoint>»
```

Everything goes under the `dumb-kit-dev/` prefix so it can be told apart and
swept away:

```bash
pnpm dev:s3:clean         # look
pnpm dev:s3:clean --yes   # delete
```

The script touches **that prefix only** — it won't hurt anything else even if
`.env` points at a production bucket.

Verified against a live Garage: Cyrillic file names survive, both images land,
and the public address serves them.

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
| `tile` | `string` | tile width, css track; defaults to `minmax(120px, 1fr)` |
| `gap` | `number` | grid gap in px, defaults to `10` |
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
| `error` | the message if it failed |
| `key` | storage key — comes from the transport |

## Dropped a file or dragged a tile

Both gestures are native drag-and-drop and have to be told apart. The gallery
does it through `dataTransfer.types`: files carry `Files`, a tile doesn't. That's
why the "drop here" outline doesn't light up when you're merely reordering.

Worth knowing if you draw your own tile: the primitive's dropzone also listens
to `dragstart`, and without that check it would react to reordering.

## Progress lives outside `items`

An upload fires dozens of progress events a second. Put them on the item and
every tick would mint a new object; `<For>` compares by reference and would
rebuild the whole tile — node, image, handlers. So progress lives in internal
state and reaches your own tile as a third argument:

```tsx
<DumbGallery …>
  {(item, index, progress) => <MyTile item={item} pct={progress()} />}
</DumbGallery>
```

Verified: across a full upload the tile nodes stay the same ones, and exactly one
rebuild happens per file — on the `uploading → done` transition, where the item's
address genuinely changes.

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
