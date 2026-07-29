[English](../DumbTable.md) · **Русский**

# DumbTable

Таблица **«принеси свои колонки»**: колонки описываются обычными объектами, а на выходе — сортировка (клиентская *или* серверная), перетаскивание строк и пагинация. Под сортировкой [`@tanstack/solid-table`](https://tanstack.com/table), под перетаскиванием — собственный `sortableCore` кита, поэтому строки едут на `transform` без reflow.

```tsx
import { DumbTable, DumbPagination, type DumbColumn } from 'solid-dumb-kit'
```

CSS импортировать не нужно — инлайном идут только структурные стили, всё оформление задаётся классами через пропсы.

## Пример

```tsx
const columns: DumbColumn<Product>[] = [
  { key: 'vendor_code', label: 'Артикул', sortable: true, width: '130px' },
  { key: 'name', label: 'Название', sortable: true },
  { key: 'price', label: 'Цена', sortable: true, align: 'right',
    render: (p) => fmtPrice(p.price) },
  { key: 'buy', label: '', stopClick: true,
    render: (p) => <button onClick={() => addToCart(p)}>заказать</button> },
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

| Поле | Тип | Описание |
| --- | --- | --- |
| `key` | `string` | Id колонки — используется для сортировки и как путь к значению по умолчанию (`row[key]`). |
| `label` | `JSX.Element` | Содержимое `<th>`. По умолчанию — сам `key`. |
| `sortable` | `boolean` | Разрешить сортировку по колонке. |
| `render` | `(row, index) => JSX.Element` | Содержимое `<td>`. По умолчанию — сырое значение. |
| `value` | `(row) => unknown` | Значение для сортировки. По умолчанию — `row[key]`. |
| `class` | `string` | Класс и на `<th>`, и на `<td>`. |
| `headClass` | `string` | Класс только на `<th>`. |
| `align` | `'left' \| 'center' \| 'right'` | Выравнивание содержимого. |
| `width` | `string` | Ширина в CSS, например `'80px'` или `'12%'`. |
| `stopClick` | `boolean` | Не пускать клик из этой ячейки в `onRowClick` — для кнопок и инпутов. |

## Пропсы

| Проп | Тип | По умолчанию | Описание |
| --- | --- | --- | --- |
| `rows` | `Array<T>` | — (обязательный) | Строки в порядке данных. |
| `columns` | `Array<DumbColumn<T>>` | — (обязательный) | Описание колонок. |
| `rowId` | `(row, index) => string` | индекс | Стабильный id строки — нужен перетаскиванию и проставляется на `<tr>` как `data-key`. |
| `sort` / `order` | `string` / `'asc' \| 'desc'` | — | Активная сортировка, **серверный режим** (в паре с `onSort`). |
| `onSort` | `(key: string \| null, order: 'asc' \| 'desc' \| null) => void` | — | Задан → сортирует сервер (`manualSorting`), порядок строк не трогается. Не задан → сортировка на клиенте. Третий клик снимает сортировку и зовёт с `(null, null)`. |
| `noSortRemoval` | `boolean` | `false` | Убрать третий клик: сортировка только `asc ⇄ desc`. |
| `viewTransition` | `boolean` | `false` | Анимировать клиентскую сортировку через View Transitions (нужен `view-transition-name` на строке). |
| `animate` | `boolean` | вкл, минус `prefers-reduced-motion` | Анимировать перетаскивание строк. |
| `sortDescFirst` | `boolean` | как в TanStack | Направление *первого* клика. По умолчанию текстовые колонки начинают с `asc`, числовые — с `desc`; см. ниже. |
| `onReorder` | `(from, to) => void` | — | Включает перетаскивание и колонку с ручкой. Индексы — в **отображаемом** порядке. |
| `handle` | `JSX.Element` | `⠿` | Содержимое ручки перетаскивания. |
| `onRowClick` | `(row, index) => void` | — | Клик по строке. |
| `loading` | `boolean` | `false` | Приглушает таблицу, пока данные едут. |
| `empty` | `JSX.Element` | — | Показывается вместо таблицы, когда строк нет. |
| `class` / `tableClass` / `headClass` | `string` | — | Классы на обёртку, `<table>` и `<thead>`. |
| `rowClass` | `(row, index) => string \| undefined` | — | Класс на строку. |
| `rowStyle` | `(row, index) => JSX.CSSProperties \| undefined` | — | Инлайн-стиль на строку — например уникальный `view-transition-name`. |
| `footer` | `JSX.Element` | — | Содержимое `<tfoot>`. |

## Клиентская сортировка против серверной

Передал `onSort` — и таблица перестаёт что-либо переставлять сама: она сообщает о клике и рисует `rows` ровно так, как дали. Это режим для списков на Meilisearch/SQL, где состояние сортировки живёт в URL.

```tsx
<DumbTable rows={data()} columns={columns}
  sort={search().sort} order={search().order}
  onSort={(sort, order) => navigate({ search: { sort, order } })} />
```

Не передал `onSort` — строки сортируются в браузере через sorted row model из TanStack.

**Три положения.** Клик по заголовку идёт по кругу `asc → desc → без сортировки`, поэтому к исходному порядку данных всегда можно вернуться. В серверном режиме сброс приходит как `onSort(null, null)`. Нужен старый двухпозиционный переключатель — передай `noSortRemoval`.

**Направление первого клика.** TanStack начинает текстовые колонки по возрастанию, а числовые — по убыванию (обычно это и нужно: «сначала самые дорогие»). `sortDescFirst={false}` заставит все колонки начинать с возрастания, `true` — наоборот.

**Грабля, о которой стоит знать:** каждой колонке внутри проставляется `accessorFn`, даже в серверном режиме. Без него TanStack считает колонку display-колонкой, `getCanSort()` возвращает `false`, и сортировка молча перестаёт работать.

## Перетаскивание строк

`onReorder` добавляет колонку с ручкой и связывает строки с `createDumbSortable` — почему это не дёргается, описано в [DumbSortable](DumbSortable.md#почему-не-дёргается).

Ручка **гаснет, пока активна сортировка**, в любом из режимов. Это намеренно: индексы `from → to` описывают отображаемый порядок, а при включённой сортировке он больше не соответствует порядку данных. Сбрось сортировку, чтобы снова переставлять.

Если есть пагинация, помни: индексы локальны для страницы — прибавь смещение перед перестановкой:

```tsx
onReorder={(from, to) => {
  const offset = (page() - 1) * pageSize()
  const next = rows().slice()
  next.splice(offset + to, 0, next.splice(offset + from, 1)[0])
  setRows(next)
}}
```

## Выделение строк

Каждый `<tr>` несёт `data-key`, поэтому [SelectionArea](SelectionArea.md) опознаёт строки без дополнительной возни — оберни таблицу и получишь выделение рамкой:

```tsx
<SelectionArea selectables="tbody tr" selected={selected} onChange={setSelected}>
  <DumbTable rows={pageRows()} columns={columns} rowId={(p) => p.id}
             rowClass={(p) => (selected().has(p.id) ? 'row-selected' : '')} />
</SelectionArea>
```

Протяжка за ручку `⠿` по-прежнему переставляет строку, а не выделяет: жест выделения не стартует с `[data-drag-handle]`.

## Анимация перестановок

Изменения данных таблица сама не анимирует — сортировка, перемешивание или фильтр просто перерисовываются. Для них отдай изменение браузеру:

```tsx
const withViewTransition = (fn: () => void) =>
  document.startViewTransition ? document.startViewTransition(fn) : fn()

<DumbTable rows={rows()} columns={columns} rowId={(p) => p.id}
           rowStyle={(p) => ({ 'view-transition-name': `row-${p.id}` })} />

<button onClick={() => withViewTransition(() => setRows(shuffle(rows())))}>перемешать</button>
```

Именно `view-transition-name` на строке заставляет каждую ехать на своё новое место; без него браузер сделает кроссфейд всей таблицы. Это только про дискретные изменения — перетаскивание кит анимирует сам, покадрово.

## `DumbPagination`

Самостоятельный пагинатор — таблица не режет данные за тебя, строки нарезаешь сам.

```tsx
<DumbPagination
  page={page()} total={rows().length} pageSize={pageSize()}
  pageSizes={[10, 20, 50]}
  onPageChange={setPage}
  onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
  summary={({ page, pages, total }) => `${total} товаров · страница ${page} из ${pages}`}
/>
```

| Проп | Тип | Описание |
| --- | --- | --- |
| `page` / `total` / `pageSize` | `number` | Текущая страница (с единицы), всего элементов, размер страницы. |
| `onPageChange` | `(page) => void` | Клик по номеру страницы. |
| `pageSizes` | `Array<number>` | Показывает переключатель размера страницы. |
| `onPageSizeChange` | `(size) => void` | Клик по размеру страницы. |
| `summary` | `({page, pages, total}) => string` | Подпись слева. По умолчанию `total · page/pages`. |
| `class` / `buttonClass` / `activeClass` | `string` | Классы для оформления. |

`buildPageNumbers(current, total)` тоже экспортируется, если хочется нарисовать пагинатор самому: возвращает массивы вида `[1, '…', 17, 18, 19, '…', 42]`.
