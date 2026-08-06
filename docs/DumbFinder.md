**English** · [Русский](ru/DumbFinder.md)

# DumbFinder

A file manager over someone else's storage: folders, rubber-band selection,
upload by dropping, move by dragging.

Built from parts that already exist: selection is the kit's
[`SelectionArea`](SelectionArea.md) (one snapshot per gesture, zero element
measurements), uploading is the same queue [`DumbGallery`](DumbGallery.md) uses,
moving is native HTML5 drag-and-drop.

**The component knows nothing about S3.** It asks a `source` for the contents of
a folder and asks it to do things — that's the whole contract. Anything can sit
behind it: a bucket, a disk, a database, WebDAV, IndexedDB.

## How it works

**A folder is a key ending in `/`.** There are no folders in S3 at all, only a
shared prefix, and the finder keeps that convention: `a/b/` is a folder, `a/b` is
a file, and the root is an empty string rather than `/`. Everything else follows
from this — breadcrumbs, "move into", "can't move a folder into itself".

**Selection costs no layout.** The rubber band is `SelectionArea`: positions are
snapshotted once per gesture through `IntersectionObserver`, and the frame does
arithmetic only. Click selects one, Shift/Cmd/Ctrl adds or removes,
Ctrl/Cmd+A takes everything, Esc clears.

**Moving is a native drag.** Drag the selection onto a folder — or onto a
breadcrumb, which is how you move something up a level. The price of a native
gesture is that **it doesn't work with a finger**: HTML5 drag-and-drop doesn't
exist on touch. Everything else — walking folders, selecting, uploading,
deleting — does.

**The folder tree on the left is the finder's own** — markup and styles sit in
the same file. `DumbTree` was tried first and taken back out: it is marked up for
Tailwind/daisyUI, and half the work went into cancelling someone else's paddings,
scrollers and level rails. A tree row is a drop target as well: you can move
something across half the bucket without opening it. The boundary between the
tree and the files is dragged with the mouse — that's
[`ResizableGrid`](ResizableGrid.md), so the width is remembered.
`sidebar={false}` turns the whole column off.

**The whole folder tree is read in one go** when the source can do it. For S3
that's a single recursive listing with no `Delimiter`, and the folders fall out
of the keys by arithmetic — cheaper than a request per branch, and it hands you
the one thing a per-level listing cannot: **what a folder weighs**. Size and file
count are totals over everything nested, shown in the tree and next to the
folder in the list. No `source.tree` — the tree loads branch by branch and
folders show no size at all: better empty than a number that lies.

**In list view a folder unfolds in place** — a disclosure triangle, and its
contents become the next rows, indented. Exactly what the real Finder does, and
the reason the list view exists at all: you can look into three folders at once
without losing where you were. Tiles have no unfolding, same as in Finder.

**Icons are CSS classes you pass in**, not markup baked into the package: pick
Solar, Phosphor, Lucide — whatever your Tailwind/iconify builds. Nothing passed
means emoji, so the package works with no icon set at all.

**Uploads go through a queue.** A few files at a time, the rest wait; removing
the tab aborts the request. Dropping files **onto a folder** puts them inside it,
not into the folder you're currently looking at.

**The listing is re-read, not patched.** After every change the finder asks
`source.list` again instead of guessing what the storage did. Clicking through
folders faster than the storage answers is safe: an in-flight listing is aborted,
so a stale answer can't land on top of a fresh one.

## The finder never sees storage keys

Same rule as the gallery, and for the same reason: a bucket key is a key to the
**whole bucket**. It has no place in a browser, so the way out is through your
own server — and once you're going through a server, the storage behind it can be
anything at all.

```tsx
import { DumbFinder, type FinderSource } from '@solid-dumb-kit/finder'
import { putWithProgress } from '@solid-dumb-kit/shared'

const source: FinderSource = {
  list: (prefix, { signal }) =>
    fetch(`/api/s3/list?prefix=${encodeURIComponent(prefix)}`, { signal })
      .then((r) => r.json())
      .then((r) => r.entries),

  upload: async (file, ctx) => {
    const signed = await fetch('/api/sign', {
      method: 'POST',
      body: JSON.stringify({ name: file.name, type: file.type, prefix: ctx.prefix }),
    }).then((r) => r.json())
    await putWithProgress(file, signed, ctx)      // XHR, so progress actually moves
  },

  remove: (keys) => post('/api/s3/delete', { keys }),
  move: (keys, to) => post('/api/s3/move', { keys, to }),
  mkdir: (prefix) => post('/api/s3/mkdir', { prefix }),
}

<DumbFinder source={source} onOpen={(e) => window.open(e.url, '_blank')} />
```

**Every capability is optional.** No `remove` — no delete button. No `move` —
tiles aren't draggable at all. A read-only viewer is a `source` with nothing but
`list`.

## Ready-made adapters

Writing the adapter by hand is the exception, not the rule — four come with the
package:

| adapter | how it talks | uploading |
| --- | --- | --- |
| `createS3Source` | your own handles to an S3-compatible store (Garage, MinIO, AWS) | the server signs a URL, the file flies **into the bucket past your server** |
| `createNodeSource` | the same handles on a plain server with folders on disk | the file goes **through the server**, as the request body, no multipart |
| `createWebdavSource` | the protocol itself: `PROPFIND` / `MKCOL` / `MOVE` / `DELETE` | `PUT` at the file's address |
| `createMemorySource` | in-tab, flat keys just like S3 | emulated, with progress |

```tsx
import { DumbFinder, createS3Source } from '@solid-dumb-kit/finder'

<DumbFinder source={createS3Source({ base: '/api/s3', sign: '/api/sign' })} />
```

The first two sit on a shared `createHttpSource`, exported as well: use it when
your handles are named differently (`paths`), need auth headers (`headers`), or
the server can't do something (`without: ['move']` — and tiles stop being
draggable).

WebDAV straight from the page only works if the server sends CORS covering those
verbs and `Authorization`; a public one usually doesn't. Then put it behind your
own proxy and use `createHttpSource`.

## What the server has to do

`list` is `ListObjectsV2` with `Delimiter: '/'` — that single parameter is what
makes a flat bucket look like a tree: `CommonPrefixes` are the folders,
`Contents` are the files at this level.

The rest is less obvious, and the showcase plugin (`playground/devS3.ts`) does it
all:

- **Deleting a folder deletes what's inside it.** There are no empty folders in
  S3; "delete the folder but keep the files" would orphan them forever.
- **Moving is copy + delete**, key by key, for the whole subtree. `CopySource`
  must be encoded **segment by segment** — running the whole string through
  `encodeURIComponent` turns the slashes into `%2F` and some stores then fail to
  find the source.
- **Creating a folder means writing an empty object whose key ends in `/`.**
  Otherwise a folder you just created isn't in the listing: there's nothing in it
  to produce a `CommonPrefix`.

## Trying it against a live store

The showcase has this wired up — **for development only**. `pnpm demo` exposes
`/api/s3/*` and `/api/sign` (the `playground/devS3.ts` plugin, `apply: 'serve'`),
signed with keys from the root `.env`. The built showcase and Pages have no
server, so that tab runs on an in-tab store with the same behaviour.

```bash
cp .env.example .env      # S3_ENDPOINT, S3_BUCKET, the keys
pnpm demo                 # prints «дев-подпись: <bucket> on <endpoint>, запись во весь бакет»
```

**Writing goes anywhere in the bucket** — these are dev handles to your own
storage, and locking the owner into a sandbox makes no sense: sorting out real
folders is what the finder is for. Just remember there's no undo: deletion here
is by the batch. If you do need a safety catch (a shared bucket, someone else's
data), `S3_DEV_LOCK` in `.env` confines writing: `1` means the `dumb-kit-dev/`
prefix, any other string is used as the prefix itself. Sweeping up:

```bash
pnpm dev:s3:clean         # look
pnpm dev:s3:clean --yes   # delete
```

Verified against a live Garage: listing the whole tree with folder weights,
creating a folder, moving a file into it and back, deleting a folder, sorting by
size and by date — including Cyrillic names.

## Props

| prop | type | what it does |
| --- | --- | --- |
| `source` | `FinderSource` | how to talk to the storage; the only required prop |
| `path` | `string` | the open folder; absent — the finder navigates itself |
| `onPathChange` | `(prefix) => void` | navigated somewhere |
| `selected` | `Set<string>` | selection; absent — kept internally |
| `onSelectionChange` | `(keys) => void` | selection changed |
| `view` | `'grid' \| 'list'` | tiles or rows; absent — toolbar toggle |
| `onViewChange` | `(view) => void` | view toggled |
| `accept` | `string` | what the file picker allows |
| `concurrency` | `number` | uploads at once, defaults to `3` |
| `rootLabel` | `string` | what the root is called in breadcrumbs, defaults to `Всё` |
| `tile` | `string` | tile width, css track; defaults to `minmax(132px, 1fr)` |
| `height` | `string` | height of the file area, defaults to `60vh` |
| `sidebar` | `boolean` | folder tree on the left; `false` turns it off |
| `sidebarWidth` | `string` | starting tree width; after that it's dragged and remembered |
| `treeKey` | `string` | `localStorage` key for open branches and the split, defaults to `dumb-finder` |
| `icons` | `Partial<Record<FileKind \| 'dir' \| 'dirOpen' \| 'twist' \| 'refresh' \| 'viewGrid' \| 'viewList' \| 'mkdir' \| 'upload' \| 'remove', string>>` | icon classes: file kinds, the chevron, toolbar buttons |
| `editable` | `boolean` | `false` — look only, whatever `source` can do |
| `onOpen` | `(entry) => void` | double click on a file (folders it walks itself) |
| `onError` | `(message) => void` | listing, upload, delete or move failed |
| `children` | `(entry, ctx) => JSX.Element` | your own tile |

### FinderEntry

| field | meaning |
| --- | --- |
| `key` | full path from the root; a folder **must** end in `/` |
| `name` | what to write under the icon |
| `dir` | is it a folder |
| `size` | a file's size; on a folder, the total over everything nested |
| `count` | how many files are inside; folders only |
| `modified` | ms or anything `Date.parse` eats |
| `url` | what to preview with and what `onOpen` gets |

### FinderSource

| method | absent means |
| --- | --- |
| `list(prefix, { signal })` | required |
| `tree({ signal })` | the tree loads branch by branch and folders show no size |
| `upload(file, { prefix, onProgress, signal })` | no uploading at all |
| `remove(keys)` | no delete button |
| `move(keys, toPrefix)` | tiles aren't draggable |
| `mkdir(prefix)` | no "new folder" |

## Keyboard

| key | what happens |
| --- | --- |
| `Backspace` | up one level |
| `Delete` | delete the selection (with a confirmation in the toolbar) |
| `Ctrl/Cmd+A` | select everything in the folder |
| `Esc` | clear the selection |
| `Enter` | open the selected entry |

## Why the confirmation is in the toolbar

`confirm()` blocks the whole tab — an upload in flight stops with it — it looks
foreign in any theme, and you can't write *what exactly* is about to be deleted
in it. So the question is a row in the toolbar, listing the names.

## Dragging a tile vs dropping files

Both are native drag-and-drop and have to be told apart. The finder does it
through `dataTransfer.types`: files carry `Files`, a tile doesn't. That's what
decides whether a folder lights up as "move here" or the whole area lights up as
"drop files here".

One more subtlety, in case you write your own tile: a gesture that starts on an
**already selected** tile doesn't start the rubber band. The browser fires
`pointercancel` when a native drag begins, and the selection engine would read
that as a click and collapse a multi-selection down to one — right as you were
dragging all of it.

## Pure parts

Paths and ordering are ordinary functions, exported because you'll be splitting
the same keys in your own adapter:

```ts
import { crumbs, nameOf, parentOf, canMove, sortEntries, kindOf } from '@solid-dumb-kit/finder'

nameOf('a/b/c.jpg')        // 'c.jpg'
parentOf('a/b/c.jpg')      // 'a/b/'
crumbs('a/b/')             // [{ name: 'Всё', prefix: '' }, { name: 'a', … }, …]
canMove('a/b/', 'a/b/c/')  // false — a folder can't go inside its own child
kindOf('photo.WEBP')       // 'image'
```

`sortEntries` keeps folders on top even when sorting by size, and compares names
with `numeric: true` — otherwise `файл10` sorts before `файл2` and everyone
notices immediately.
