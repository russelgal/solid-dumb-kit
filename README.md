**English** · [Русский](README.ru.md)

# solid-dumb-kit

A small set of dependency-light **SolidJS** UI primitives that are easy to drop in and fully styleable — you own the markup, the kit wires the behaviour.

- **[SelectionArea](docs/SelectionArea.md)** — Finder-style rubber-band selection over a list/grid (Shift/Cmd to add). Zero-dep, no reflow.
- **[ResizableGrid](docs/ResizableGrid.md)** — resizable columns/rows panel layout, sizes persisted to `localStorage`.
- **[DumbSortable](docs/DumbSortable.md)** — zero-dep FLIP drag-reorder (vertical list **or** grid), no reflow during drag. Ships as a declarative component and a low-level `createDumbSortable` primitive.
- **[DumbTree](docs/DumbTree.md)** — sidebar tree *or* flat list with fuzzy search, sorting, persisted expand state and optional drag-reorder. Styled for Tailwind + daisyUI.
- **[DumbTable](docs/DumbTable.md)** — bring-your-own-columns table: sorting (client or server) on TanStack Table, row drag-reorder, pagination.
- **[DumbGallery](docs/DumbGallery.md)** — an image gallery: pick or drop files, look, reorder, upload. Uploads run through a queue and can be cancelled; the gallery never sees storage keys — only a signed URL from your server.
- **[DumbBoard](docs/DumbBoard.md)** — a board of sections: blocks move between sections, the sections themselves reorder and resize. Inside a section the DOM is never touched — only CSS `order` moves, and FLIP plays out the rest.
- **[DumbGrid](docs/DumbGrid.md)** — dashboard grid: blocks sized in whole columns/rows, drag and resize in grid steps, three layout modes (`flow` / `dense` / free `{x,y}`), optional visible grid, layout persisted. No element measurements during a gesture.
- **[utils](docs/utils.md)** — framework-free helpers: `ru-RU` number/date/size formatting, slugs, image extraction from a ZIP, imgproxy URLs.
- **[DumbFinder](docs/DumbFinder.md)** — a file manager over someone else's storage: folders, rubber-band selection, upload by dropping, move by dragging. Knows nothing about S3 — it talks to a `source` adapter, so anything can sit behind it.
- **[DumbTimeline](docs/DumbTimeline.md)** — a booking chart: resource rows × time columns. Nights, hours and day-long rentals on one grid; no measurements during a drag, and overlapping neighbours is impossible by construction.
- **[DumbDateRange](docs/DumbDateRange.md)** — a calendar for a day or a range, with occupancy shown before the click. Dates are strings, so timezones can't shift a night.
- **[DumbModal](docs/DumbModal.md)** · **[DumbLightbox](docs/DumbLightbox.md)** · **[DumbContextMenu](docs/DumbContextMenu.md)** · **[DumbToast](docs/DumbToast.md)** — the top-layer family: native `<dialog>` and the Popover API with anchor positioning, so nothing fights over `z-index`.
- **[Odata1C](docs/Odata1C.md)** — framework-free client for the 1C standard OData interface: Basic auth, request building, and the platform's quirks handled for you. Runs in the browser and in Node.

**🔗 Live demo:** https://russelgal.github.io/solid-dumb-kit/ · runnable source in [`examples/`](examples/).

Version `0.x` targets **SolidJS 1.x** (`peerDependencies: solid-js ^1.8.0`).

**📓 Changelog:** [CHANGELOG.md](CHANGELOG.md)

**🧭 Write-ups:** [What turned out to be true](docs/Findings.md) — verified claims, with how they were verified · [Global DnD](docs/GlobalDnd.md) — dragging between unlike things (a proposal, not implemented)

## Install

The kit ships as one package per component, each with its own version and its own tag. Install only what you need: `@solid-dumb-kit/table` won't drag `@tanstack/solid-table` into a project that just wants a sortable list, and the DnD packages have no runtime deps at all — they run on bare browser events.

**Not on npm yet** — packages install straight from GitHub, as a subdirectory of the repo:

```bash
pnpm add "github:russelgal/solid-dumb-kit#path:/packages/table"
# peer dep:
pnpm add solid-js
```

The `#path:/packages/<name>` tail is all you need — it picks the package. Pinning a version is optional: pnpm records the resolved commit in the lockfile, so installs stay reproducible. A prebuilt `dist/` is committed, so nothing needs building on your side.

Packages update **one at a time** — that's the whole point of the split:

```bash
pnpm up @solid-dumb-kit/table
```

Want a hard pin, add a tag; they're short, named after the folder:

```bash
pnpm add "github:russelgal/solid-dumb-kit#table@0.5.0&path:/packages/table"
```

Links between packages are compiled into the build rather than declared as dependencies: `workspace:` specifiers don't resolve over a git install. The cost is 0.1–5 KB gzip per package, and it buys the ability to install them separately.

Packages split by **how the gesture is driven**. That's the one division that matters here: pointer events and native drag-and-drop are two separate implementations, and half the components exist in both.

**Pointer** — works with a finger, we work out the drop zone ourselves:

| package | what's inside | pulls in |
| --- | --- | --- |
| `@solid-dumb-kit/sortable` | `DumbSortable`, `createSortableGroup` — list, grid, dragging between columns | — |
| `@solid-dumb-kit/selection` | `SelectionArea` — marquee selection | — |
| `@solid-dumb-kit/grid` | `DumbGrid` — dashboard grid, nesting, transfer between grids | `@solid-primitives/storage`, `valibot` |
| `@solid-dumb-kit/resizable-grid` | `ResizableGrid` — resizable panels | `@solid-primitives/storage`, `valibot` |

**Native DnD** — the browser picks the zone, no touch support:

| package | what's inside | pulls in |
| --- | --- | --- |
| `@solid-dumb-kit/sortable-dnd` | `DumbSortableDnd` — list and tile grid | — |
| `@solid-dumb-kit/grid-dnd` | `DumbGridDnd` — grid, two boards, transfer between them | — |
| `@solid-dumb-kit/gallery` | `DumbGallery` — images: picking, order, queued uploads | `@solid-primitives/upload` |
| `@solid-dumb-kit/board` | `DumbBoard` — sections with blocks, moves between them, section resize | — |

**Data and utilities** — the gesture isn't the point:

| package | what's inside | pulls in |
| --- | --- | --- |
| `@solid-dumb-kit/table` | `DumbTable`, `DumbPagination` | `@tanstack/solid-table` |
| `@solid-dumb-kit/tree` | `DumbTree` — tree and flat list | `@solid-primitives/storage` |
| `@solid-dumb-kit/timeline` | `DumbTimeline` — booking chart: nights, hours, day rentals | — |
| `@solid-dumb-kit/date-range` | `DumbDateRange` — calendar for a day or a range | — |
| `@solid-dumb-kit/modal` | `DumbModal` — native `<dialog>` in the top layer | — |
| `@solid-dumb-kit/lightbox` | `DumbLightbox` — full-screen image viewer | — |
| `@solid-dumb-kit/context-menu` | `DumbContextMenu`, `DumbPopover` — right click and cards at a point | — |
| `@solid-dumb-kit/toast` | `DumbToaster`, `toast` — messages and questions | — |
| `@solid-dumb-kit/finder` | `DumbFinder` — files in a store: folders, selection, upload, move | `@solid-primitives/upload` |
| `@solid-dumb-kit/odata-1c` | 1C OData client — no Solid needed | — |
| `@solid-dumb-kit/utils` | format, slug, zip, imgproxy | `fflate`, `slug` |

**Foundation** — everything else stands on it, installs itself as a dependency:

| package | what's inside | pulls in |
| --- | --- | --- |
| `@solid-dumb-kit/shared` | FLIP, autoscroll, viewport, gesture rules | — |

## Quick start

```tsx
import { SelectionArea, ResizableGrid, DumbSortable } from 'solid-dumb-kit'
```

Runnable examples (one per component) live in [`examples/`](examples/).

## Exports

| Export | Kind | Doc |
| --- | --- | --- |
| `SelectionArea` / `SelectionAreaProps` / `IntersectMode` | component | [docs/SelectionArea.md](docs/SelectionArea.md) |
| `ResizableGrid` / `ResizableGridProps` / `GridPanel` | component | [docs/ResizableGrid.md](docs/ResizableGrid.md) |
| `DumbSortable` / `DumbSortableProps` | component | [docs/DumbSortable.md](docs/DumbSortable.md) |
| `createSelectionArea` / `SelectionCoreOptions` | primitive | [docs/SelectionArea.md](docs/SelectionArea.md) |
| `createDumbSortable` / `DumbSortableHandle` / `DumbSortableOptions` | primitive | [docs/DumbSortable.md#createdumbsortable-primitive](docs/DumbSortable.md#createdumbsortable-primitive) |
| `DumbTree` / `DumbTreeProps` / `DumbTreeNode` / `DumbTreeIcons` / `DumbTreeLabels` | component | [docs/DumbTree.md](docs/DumbTree.md) |
| `DumbTable` / `DumbTableProps` / `DumbColumn` | component | [docs/DumbTable.md](docs/DumbTable.md) |
| `DumbPagination` / `DumbPaginationProps` / `buildPageNumbers` | component | [docs/DumbTable.md#dumbpagination](docs/DumbTable.md#dumbpagination) |
| `DumbGrid` / `DumbGridProps` / `DumbGridItem` / `DumbGridLayout` / `mergeLayout` | component | [docs/DumbGrid.md](docs/DumbGrid.md) |
| `createDumbGrid` / `DumbGridHandle` / `createGridEngine` / `DumbGridOptions` / `DumbGridBlock` | primitive | [docs/DumbGrid.md#createdumbgrid-primitive](docs/DumbGrid.md#createdumbgrid-primitive) |
| `packFlow` / `cellRect` / `colWidth` / `spanSize` / `rowCount` / `insertIndex` / `moveDeltas` / `snapSpan` | grid maths | [docs/DumbGrid.md#engine-without-a-framework](docs/DumbGrid.md#engine-without-a-framework) |
| `Rub0` / `Rub2` / `Rub4` / `Rub0R` / `RubR2` / `fmtNum` / `fmtPrice` | formatting | [docs/utils.md#fmt--numbers-dates-sizes](docs/utils.md#fmt--numbers-dates-sizes) |
| `fmtDate` / `fmtDateTime` / `fmtDateTimeShort` / `fmtTime` / `fmtDateMonth` / `timeAgo` / `fmtSize` | formatting | [docs/utils.md#dates](docs/utils.md#dates) |
| `genSlug` | util | [docs/utils.md#genslug--url-slugs](docs/utils.md#genslug--url-slugs) |
| `extractImagesFromZip` | util | [docs/utils.md#extractimagesfromzip--images-out-of-a-zip](docs/utils.md#extractimagesfromzip--images-out-of-a-zip) |
| `imgproxyUrl` / `configureImgproxy` / `ImgproxyOps` / `ImgproxyConfig` | util | [docs/utils.md#imgproxyurl--imgproxy-url-builder](docs/utils.md#imgproxyurl--imgproxy-url-builder) |
| `OdataClient` / `createOdataClient` / `OdataClientOptions` / `OdataListResponse` | client | [docs/Odata1C.md](docs/Odata1C.md) |
| `OdataError` / `odataString` / `toBase64` | client | [docs/Odata1C.md#helpers](docs/Odata1C.md#helpers) |

## CSS

- **SelectionArea** draws its rubber band inline — nothing to import.
- **ResizableGrid** injects its handle styles at runtime — no import needed.
- **DumbSortable** uses inline transforms only — no CSS needed.
- **DumbTable** inlines structural styles only — colours, borders and hovers come from your `tableClass`/`headClass`/`rowClass`.
- **DumbTree** is the exception: it renders Tailwind + daisyUI class names, so it expects those in your app. Icons are passed in as class names (the kit bundles no icon set).

## Dependencies

`solid-js ^1.8.0` is the only peer. Runtime deps are small and scoped: `@solid-primitives/storage` + `valibot` (ResizableGrid, DumbTree, DumbGrid), `@tanstack/solid-table` (DumbTable), `slug` (`genSlug`), and `fflate` — the latter behind a dynamic `import()`, so it loads only when a ZIP is actually unpacked. `Odata1C` adds nothing at all — it is plain `fetch`.

## License

MIT
