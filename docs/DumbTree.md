**English** · [Русский](ru/DumbTree.md)

# DumbTree

A tree: nested nodes, a branch loaded on demand, search, selection.

```tsx
import { DumbTree, type TreeNode } from '@solid-dumb-kit/tree'
```

Nodes are **nested** (`children`), not a flat list with `parent`: that's how a
tree comes back from storage, and flattening it just for the component is work
on every response.

## How it works

**A branch doesn't have to be there up front.** `loadChildren(id)` is called the
moment a branch is expanded, so a tree of ten thousand nodes opens instantly and
fetches only what you actually walked into. Both given — `children` wins.

**Stripes are one gradient over the whole tree**, stepped by a line (`1lh`),
rather than a class on every other row. Expand a nested branch and the count
would otherwise start over inside each level and lose the rhythm.
`background-attachment: local` keeps them moving with the scroll.

**The row is exactly `1lh` tall.** That's what the stripes ride on, and it's why
the size of the tree is a single `size` prop: change the type size and rows,
stripes and indents follow by themselves.

**One chevron for both states.** Expanded is the same glyph rotated 90°, so it
doesn't jump between two different icons and animates for free.

The component ships **no icons and no colours of its own**: icons arrive as class
names (`icons`), colours are CSS variables with contrasty fallbacks. Tailwind and
daisyUI are neither required nor in the way.

## Icons are class names

```tsx
const icons = {
  twist: 'icon-[solar--alt-arrow-right-outline]',
  folder: 'icon-[solar--folder-bold] text-sky-600',
  folderOpen: 'icon-[solar--folder-open-bold] text-sky-600',
  leaf: 'icon-[solar--document-text-outline]',
}

<DumbTree roots={nodes()} icons={icons} selected={picked} onSelect={(n) => go(n.id)} />
```

The strings live in *your* sources, so *your* Tailwind/iconify pass compiles
them — nothing has to scan `node_modules`. Nothing passed at all: the chevron
falls back to `▸`/`▾` and rows go without icons.

## A branch on demand

```tsx
<DumbTree
  loadChildren={(parentId) =>
    fetch(`/api/tree?parent=${parentId}`).then((r) => r.json())
  }
  refreshKey={() => version()}   // changed — already-loaded branches are re-read
  icons={icons}
/>
```

`loadChildren('')` fetches the roots. A branch is fetched on its first expand;
the request goes out exactly when someone walks in, because a branch is only
rendered while it's open.

## Props

| prop | type | what it does |
| --- | --- | --- |
| `roots` | `Array<TreeNode>` | the tree as given; absent — fetched via `loadChildren('')` |
| `loadChildren` | `(parentId) => Promise<Array<TreeNode>>` | a branch on demand |
| `selected` | `() => string \| null` | the chosen node |
| `onSelect` | `(node) => void` | row click |
| `onContextMenu` | `(ev, node) => void` | right click on a row |
| `storageKey` | `string` | `localStorage` key for open branches; absent — not remembered |
| `refreshKey` | `() => number \| string` | changed — loaded branches are re-read |
| `query` | `() => string` | filter by label: matches and the path to them |
| `match` | `(node, query) => boolean` | your own matcher; default is a case-insensitive substring |
| `icons` | `DumbTreeIcons` | `twist` · `folder` · `folderOpen` · `leaf`, all class names |
| `size` | `string` | the whole tree in one type size |
| `stripes` | `boolean` | zebra rows; on by default |
| `renderAction` | `(node) => JSX.Element` | your content on the right of a row |
| `getDragData` | `(node) => {type, id, label} \| null` | makes the row draggable |

### TreeNode

| field | meaning |
| --- | --- |
| `id` | required, unique |
| `label` | what's written in the row |
| `isFolder` | is it a branch; a node with `children` counts as one anyway |
| `children` | nested nodes |
| `badge` | small on the right: a count, a size, a status |
| `icon` | this row's own icon class |
| `href` | turns the row into a link; navigation is yours |
| `class` | extra class on the row |

## Colours

| variable | what it paints |
| --- | --- |
| `--dumb-tree-size` | type size (or the `size` prop) |
| `--dumb-tree-zebra` | the stripe |
| `--dumb-tree-hover` | row under the cursor |
| `--dumb-tree-sel` · `--dumb-tree-accent` | the selected row |
| `--dumb-tree-dim` | badge and chevron |

Defaults are contrasty on purpose: a label people read and a chevron people aim
at have no business being grey-on-grey.

## What went away in the rewrite

The old `DumbTree` took a **flat** `nodes` array with `parent`, drew its own
search field and index/name sort toggle, could work as a flat drag-reorderable
list, and was styled with daisyUI class names. All of that is gone: the search
field is yours to draw (there's a `query` prop for the filtering itself), a
sortable flat list is [`DumbSortable`](DumbSortable.md), and the look is no
longer tied to daisyUI.
