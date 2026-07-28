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
| `rowId` | `(row, index) => string` | index | Stable row id — needed for drag-reorder. |
| `sort` / `order` | `string` / `'asc' \| 'desc'` | — | Active sort, **server mode** (pair with `onSort`). |
| `onSort` | `(key: string \| null, order: 'asc' \| 'desc' \| null) => void` | — | Present → the server sorts (`manualSorting`), row order is left alone. Absent → sorting happens client-side. A third click clears the sort and calls it with `(null, null)`. |
| `noSortRemoval` | `boolean` | `false` | Drop the third click: sorting stays `asc ⇄ desc`. |
| `sortDescFirst` | `boolean` | TanStack default | Direction of the *first* click. By default text columns start `asc` and numeric ones `desc`; see below. |
| `onReorder` | `(from, to) => void` | — | Enables drag-reorder and the handle column. Indices are into the **displayed** order. |
| `handle` | `JSX.Element` | `⠿` | Drag handle content. |
| `onRowClick` | `(row, index) => void` | — | Row click. |
| `loading` | `boolean` | `false` | Dims the table while data is in flight. |
| `empty` | `JSX.Element` | — | Rendered instead of the table when there are no rows. |
| `class` / `tableClass` / `headClass` | `string` | — | Classes on the wrapper, `<table>` and `<thead>`. |
| `rowClass` | `(row, index) => string \| undefined` | — | Class per row. |
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

If you paginate, remember indices are page-local — add the page offset before splicing:

```tsx
onReorder={(from, to) => {
  const offset = (page() - 1) * pageSize()
  const next = rows().slice()
  next.splice(offset + to, 0, next.splice(offset + from, 1)[0])
  setRows(next)
}}
```

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
