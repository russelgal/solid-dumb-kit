**English** · [Русский](ru/DumbTree.md)

# DumbTree

A sidebar **tree** (hierarchy by `parent`) **or flat list**, with fuzzy search, index/name sorting, persisted expand state, and optional drag-reorder (powered by [`createDumbSortable`](DumbSortable.md#createdumbsortable-primitive)).

```tsx
import { DumbTree } from 'solid-dumb-kit'
```

> **Styling note — read first.** Unlike the rest of the kit, `DumbTree` is *styled-but-configurable*: it renders **Tailwind + daisyUI** class names (`btn`, `input`, `bg-base-100`, `text-primary`, …). It looks right out of the box in a daisyUI app; anywhere else you get unstyled markup. The other components in this kit are style-agnostic — this one trades that for a ready-made look.

## Icons are required

The kit ships **no icon set**. You pass class names, so the icon strings live in *your* sources and *your* Tailwind/iconify pass compiles them — no scanning of `node_modules`.

```tsx
<DumbTree
  nodes={cats()}
  title="Catalogue"
  storageKey="cat"
  activeId={() => active()}
  onSelect={(id) => go(id)}
  icons={{
    folder: 'icon-[solar--folder-outline]',
    folderOpen: 'icon-[solar--folder-open-outline]',
    leaf: 'icon-[solar--file-outline]',
    expanded: 'icon-[solar--alt-arrow-down-outline]',
    collapsed: 'icon-[solar--alt-arrow-right-outline]',
    search: 'icon-[solar--magnifer-outline]',
    sortIndex: 'icon-[solar--sort-outline]',
    sortName: 'icon-[solar--text-outline]',
    dragHandle: 'icon-[solar--menu-dots-outline]',
  }}
/>
```

## The node shape

```ts
type DumbTreeNode = {
  id: number | string
  parent: number | string   // id of the parent node
  title: string
  index?: number            // order among siblings (used by "index" sorting)
  meta?: string | null      // extra searchable/tooltip line
}
```

Nodes come in as a **flat array**; the hierarchy is derived from `parent`. The root is the node whose `parent` points outside the set (falls back to the first node).

Your own domain fields never leak into the kit — express them through `rowExtra` / `rowClass` / `titleClass` / `rowTitle`.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `nodes` | `Array<T>` | — | Flat node array. `undefined` renders a loading spinner. |
| `icons` | `DumbTreeIcons` | — (required) | Icon class names, see above. |
| `title` | `string` | — | Small caption above the sidebar. |
| `activeId` | `() => Id \| null \| undefined` | — | Reactive accessor for the selected id. |
| `onSelect` | `(id, node) => void` | — | Row click. |
| `flat` | `boolean` | `false` | Render a flat list instead of a tree (no nesting, no expanding). |
| `hideSearch` | `boolean` | `false` | Hide the search field. |
| `placeholder` | `string` | `labels.search` | Search input placeholder. |
| `match` | `(node, query) => boolean` | fuzzy | Custom matcher. Default: fuzzy over `title`, `meta` and `id`. |
| `hideSort` | `boolean` | `false` | Hide the sort toggle and keep strict `index` order. |
| `locale` | `string` | browser | Locale for `localeCompare` when sorting by name. |
| `storageKey` | `string` | `'dumb-tree'` | `localStorage` key prefix for expanded folders (`:expanded`) and sort mode (`:sort`). |
| `sortable` | `(from: number, to: number) => void` | — | Enables drag-reorder in `flat` mode; indices are into the **displayed** order. |
| `rowExtra` | `(node) => JSX.Element` | — | Extra content pinned to the right of a row (badges, status icons). |
| `rowClass` | `(node) => string \| undefined` | — | Extra class on the row link (e.g. `opacity-50` for hidden items). |
| `titleClass` | `(node) => string \| undefined` | — | Extra class on the row text (e.g. `line-through`). |
| `rowTitle` | `(node) => string` | `title · meta · id N` | Custom row tooltip. |
| `class` | `string` | — | Extra class on the root `<aside>`. |
| `labels` | `DumbTreeLabels` | ru | Button/placeholder captions — `{ search, sortIndex, sortName }`. **Defaults are Russian** (`Поиск`, `Индекс`, `Название`); pass your own for other languages. |

## Search

Matching is fuzzy: a substring **or** a subsequence, case-insensitive, over `title`, `meta` and the stringified `id`. While a query is active:

- in tree mode every match is shown together with its ancestors, and everything is force-expanded (your saved expand state is untouched);
- drag-reorder is disabled — the displayed order no longer maps to the source order.

## Sorting

Two modes, toggled in the UI and persisted per `storageKey`:

- **index** — `index` ascending, ties broken by title;
- **name** — `localeCompare(title)`, ties broken by `index`.

Set `hideSort` to lock it to `index` and drop the toggle.

## Drag-reorder

Pass `sortable` **and** `flat` to get drag handles. Reordering runs on `createDumbSortable`, so it inherits the no-reflow behaviour described in [DumbSortable](DumbSortable.md#why-it-doesnt-jank): positions are snapshotted once via `IntersectionObserver`, movement is pure `transform`.

```tsx
<DumbTree
  nodes={items()}
  flat
  icons={icons}
  sortable={(from, to) => {
    const next = items().slice()
    next.splice(to, 0, next.splice(from, 1)[0])
    setItems(next)
  }}
/>
```

Reordering is intentionally **flat-only** — in a tree the displayed rows span several parents, so a single `from → to` pair would be ambiguous.

## Persistence

Expanded folders and the sort mode go to `localStorage` under `${storageKey}:expanded` and `${storageKey}:sort` (via `@solid-primitives/storage`). Use a distinct `storageKey` per tree instance, otherwise two sidebars share one state.
