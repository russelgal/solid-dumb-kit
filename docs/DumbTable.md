**English** · [Русский](ru/DumbTable.md)

# DumbTable

A **bring-your-own-columns** table: describe columns as plain objects, get sorting (client-side *or* server-side), row drag-reorder and pagination. Sorting is [`@tanstack/solid-table`](https://tanstack.com/table) under the hood; dragging is the kit's own `sortableCore`, so rows move on `transform` with no reflow.

```tsx
import { DumbTable, DumbPagination, type DumbColumn } from 'solid-dumb-kit'
```

No CSS import needed — only structural styles are inlined, everything cosmetic goes through class props.

## Example

```tsx
const columns: DumbColumn<Product>[] = [
  { key: 'vendor_code', label: 'SKU', sortable: true, width: '130px' },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'price', label: 'Price', sortable: true, align: 'right',
    render: (p) => fmtPrice(p.price) },
  { key: 'buy', label: '', stopClick: true,
    render: (p) => <button onClick={() => addToCart(p)}>buy</button> },
]

<DumbTable
  rows={products()}
  columns={columns}
  rowId={(p) => p.id}
  onRowClick={(p) => open(p)}
  onReorder={(from, to) => reorder(from, to)}
/>
```

## `DumbColumn`

| Field | Type | Description |
| --- | --- | --- |
| `key` | `string` | Column id — used for sorting and as the default value path (`row[key]`). |
| `label` | `JSX.Element` | `<th>` content. Defaults to `key`. |
| `sortable` | `boolean` | Allow sorting by this column. |
| `render` | `(row, index) => JSX.Element` | `<td>` content. Defaults to the raw value. |
| `value` | `(row) => unknown` | Value used for sorting. Defaults to `row[key]`. |
| `class` | `string` | Class on both `<th>` and `<td>`. |
| `headClass` | `string` | Class on `<th>` only. |
| `align` | `'left' \| 'center' \| 'right'` | Cell alignment. |
| `width` | `string` | CSS width, e.g. `'80px'` or `'12%'`. |
| `stopClick` | `boolean` | Stop clicks in this cell from reaching `onRowClick` — for buttons and inputs. |

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `rows` | `Array<T>` | — (required) | Rows to render, in data order. |
| `columns` | `Array<DumbColumn<T>>` | — (required) | Column definitions. |
| `rowId` | `(row, index) => string` | index | Stable row id — used for drag-reorder and emitted as `data-key` on each `<tr>`. |
| `sort` / `order` | `string` / `'asc' \| 'desc'` | — | Active sort, **server mode** (pair with `onSort`). |
| `onSort` | `(key: string \| null, order: 'asc' \| 'desc' \| null) => void` | — | Present → the server sorts (`manualSorting`), row order is left alone. Absent → sorting happens client-side. A third click clears the sort and calls it with `(null, null)`. |
| `noSortRemoval` | `boolean` | `false` | Drop the third click: sorting stays `asc ⇄ desc`. |
| `viewTransition` | `boolean` | `false` | Animate client-side sorting via View Transitions (needs a per-row `view-transition-name`). |
| `animate` | `boolean` | on, minus `prefers-reduced-motion` | Animate row dragging. |
| `sortDescFirst` | `boolean` | TanStack default | Direction of the *first* click. By default text columns start `asc` and numeric ones `desc`; see below. |
| `onReorder` | `(from, to) => void` | — | Enables drag-reorder and the handle column. Indices are into the **displayed** order. |
| `handle` | `JSX.Element \| false` | `⠿` | Drag handle content. `false` drops the handle column and drags the whole row. |
| `dragThreshold` | `number` | `0` | Pixels to move before a drag starts — worth setting when dragging the whole row. |
| `onRowClick` | `(row, index) => void` | — | Row click. |
| `loading` | `boolean` | `false` | Dims the table while data is in flight. |
| `empty` | `JSX.Element` | — | Rendered instead of the table when there are no rows. |
| `class` / `tableClass` / `headClass` | `string` | — | Classes on the wrapper, `<table>` and `<thead>`. |
| `rowClass` | `(row, index) => string \| undefined` | — | Class per row. |
| `rowStyle` | `(row, index) => JSX.CSSProperties \| undefined` | — | Inline style per row — handy for a unique `view-transition-name`. |
| `footer` | `JSX.Element` | — | `<tfoot>` content. |

## Client vs server sorting

Pass `onSort` and the table stops reordering anything itself: it reports the click and renders `rows` exactly as given — that's the mode for Meilisearch/SQL-backed lists where sort state lives in the URL.

```tsx
<DumbTable rows={data()} columns={columns}
  sort={search().sort} order={search().order}
  onSort={(sort, order) => navigate({ search: { sort, order } })} />
```

Omit `onSort` and rows are sorted in the browser via TanStack's sorted row model.

**Three states.** Clicking a header cycles `asc → desc → no sorting`, so you can always get back to the data's own order. In server mode the reset arrives as `onSort(null, null)`. Pass `noSortRemoval` to keep the old two-state toggle.

**First-click direction.** TanStack starts text columns ascending and numeric columns descending (usually what you want: “priciest first”). Set `sortDescFirst={false}` to make every column start ascending, or `true` for the opposite.

**A gotcha worth knowing:** every column gets an `accessorFn` internally even in server mode. Without one TanStack treats a column as a display column, `getCanSort()` returns `false`, and sorting silently does nothing.

## Drag-reorder

`onReorder` adds a handle column and wires rows to `createDumbSortable` — see [DumbSortable](DumbSortable.md#why-it-doesnt-jank) for why it doesn't jank.

The handle **greys out while a sort is active**, in either mode. That's deliberate: `from → to` indices describe the displayed order, and once a sort is applied that no longer maps back to the data order. Reset sorting to reorder again.

Prefer dragging the whole row? Pass `handle={false}` — the handle column disappears and the row itself becomes the grab target:

```tsx
<DumbTable rows={rows()} columns={columns} onReorder={reorder}
           handle={false} dragThreshold={6} />
```

Set `dragThreshold` with it: without a handle, a click on a row and the start of a drag look identical, and rubber-band selection over the table would fight the drag for the same gesture.

If you paginate, remember indices are page-local — add the page offset before splicing:

```tsx
onReorder={(from, to) => {
  const offset = (page() - 1) * pageSize()
  const next = rows().slice()
  next.splice(offset + to, 0, next.splice(offset + from, 1)[0])
  setRows(next)
}}
```

## Selecting rows

Each `<tr>` carries `data-key`, so [SelectionArea](SelectionArea.md) recognises rows with no extra wiring — wrap the table and you get rubber-band selection:

```tsx
<SelectionArea selectables="tbody tr" selected={selected} onChange={setSelected}>
  <DumbTable rows={pageRows()} columns={columns} rowId={(p) => p.id}
             rowClass={(p) => (selected().has(p.id) ? 'row-selected' : '')} />
</SelectionArea>
```

Dragging by the `⠿` handle still reorders rather than selects: the selection gesture ignores anything starting on `[data-drag-handle]`.

## Animating reorders

The table never animates data changes itself — sorting, shuffling or filtering just re-render. For those, hand the change to the browser:

```tsx
const withViewTransition = (fn: () => void) =>
  document.startViewTransition ? document.startViewTransition(fn) : fn()

<DumbTable rows={rows()} columns={columns} rowId={(p) => p.id}
           rowStyle={(p) => ({ 'view-transition-name': `row-${p.id}` })} />

<button onClick={() => withViewTransition(() => setRows(shuffle(rows())))}>shuffle</button>
```

The per-row `view-transition-name` is what makes each row travel to its new place; without it the browser cross-fades the whole table. This only applies to discrete changes — dragging is animated by the kit itself, frame by frame.

## `DumbPagination`

A standalone pager — the table doesn't paginate for you, you slice `rows` yourself.

```tsx
<DumbPagination
  page={page()} total={rows().length} pageSize={pageSize()}
  pageSizes={[10, 20, 50]}
  onPageChange={setPage}
  onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
  summary={({ page, pages, total }) => `${total} items · page ${page} of ${pages}`}
/>
```

| Prop | Type | Description |
| --- | --- | --- |
| `page` / `total` / `pageSize` | `number` | Current page (1-based), total item count, page size. |
| `onPageChange` | `(page) => void` | Page click. |
| `pageSizes` | `Array<number>` | Shows a page-size switcher. |
| `onPageSizeChange` | `(size) => void` | Page-size click. |
| `summary` | `({page, pages, total}) => string` | Left-hand caption. Defaults to `total · page/pages`. |
| `class` / `buttonClass` / `activeClass` | `string` | Classes for styling. |

`buildPageNumbers(current, total)` is exported too, if you'd rather render the pager yourself: it returns `[1, '…', 17, 18, 19, '…', 42]`-shaped arrays.
