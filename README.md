**English** · [Русский](README.ru.md)

# solid-dumb-kit

A small set of dependency-light **SolidJS** UI primitives that are easy to drop in and fully styleable — you own the markup, the kit wires the behaviour.

- **[SelectionArea](docs/SelectionArea.md)** — Finder-style rubber-band selection over a list/grid (Shift/Cmd to add). Zero-dep, no reflow.
- **[ResizableGrid](docs/ResizableGrid.md)** — resizable columns/rows panel layout, sizes persisted to `localStorage`.
- **[DumbSortable](docs/DumbSortable.md)** — zero-dep FLIP drag-reorder (vertical list **or** grid), no reflow during drag. Ships as a declarative component and a low-level `createDumbSortable` primitive.
- **[DumbTree](docs/DumbTree.md)** — sidebar tree *or* flat list with fuzzy search, sorting, persisted expand state and optional drag-reorder. Styled for Tailwind + daisyUI.
- **[DumbTable](docs/DumbTable.md)** — bring-your-own-columns table: sorting (client or server) on TanStack Table, row drag-reorder, pagination.
- **[utils](docs/utils.md)** — framework-free helpers: `ru-RU` number/date/size formatting, slugs, image extraction from a ZIP, imgproxy URLs.

**🔗 Live demo:** https://russelgal.github.io/solid-dumb-kit/ · runnable source in [`examples/`](examples/).

Version `0.x` targets **SolidJS 1.x** (`peerDependencies: solid-js ^1.8.0`).

**📓 Changelog:** [CHANGELOG.md](CHANGELOG.md)

## Install

**Not on npm yet** — install straight from GitHub. The repo ships both `src/` and a prebuilt `dist/`, so nothing needs building on your side:

```bash
pnpm add github:russelgal/solid-dumb-kit
# peer dep:
pnpm add solid-js
```

Pin a commit for reproducible installs (the repo has no tags yet):

```bash
pnpm add github:russelgal/solid-dumb-kit#<commit-sha>
```

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
| `Rub0` / `Rub2` / `Rub4` / `Rub0R` / `RubR2` / `fmtNum` / `fmtPrice` | formatting | [docs/utils.md#fmt--numbers-dates-sizes](docs/utils.md#fmt--numbers-dates-sizes) |
| `fmtDate` / `fmtDateTime` / `fmtDateTimeShort` / `fmtTime` / `fmtDateMonth` / `timeAgo` / `fmtSize` | formatting | [docs/utils.md#dates](docs/utils.md#dates) |
| `genSlug` | util | [docs/utils.md#genslug--url-slugs](docs/utils.md#genslug--url-slugs) |
| `extractImagesFromZip` | util | [docs/utils.md#extractimagesfromzip--images-out-of-a-zip](docs/utils.md#extractimagesfromzip--images-out-of-a-zip) |
| `imgproxyUrl` / `configureImgproxy` / `ImgproxyOps` / `ImgproxyConfig` | util | [docs/utils.md#imgproxyurl--imgproxy-url-builder](docs/utils.md#imgproxyurl--imgproxy-url-builder) |

## CSS

- **SelectionArea** draws its rubber band inline — nothing to import.
- **ResizableGrid** injects its handle styles at runtime — no import needed.
- **DumbSortable** uses inline transforms only — no CSS needed.
- **DumbTable** inlines structural styles only — colours, borders and hovers come from your `tableClass`/`headClass`/`rowClass`.
- **DumbTree** is the exception: it renders Tailwind + daisyUI class names, so it expects those in your app. Icons are passed in as class names (the kit bundles no icon set).

## Dependencies

`solid-js ^1.8.0` is the only peer. Runtime deps are small and scoped: `@solid-primitives/storage` + `valibot` (ResizableGrid, DumbTree), `@tanstack/solid-table` (DumbTable), `slug` (`genSlug`), and `fflate` — the latter behind a dynamic `import()`, so it loads only when a ZIP is actually unpacked.

## License

MIT
