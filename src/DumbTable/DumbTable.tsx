import { For, Show, createSignal, type JSX } from 'solid-js'
import {
  createSolidTable,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
} from '@tanstack/solid-table'
import { createDumbSortable } from '../Sortable/solid'
import { shouldAnimate } from '../shared/motion'

// Таблица «принеси свои колонки»: описание колонки — простой объект, а не сырой
// ColumnDef. Сортировка на @tanstack/solid-table (клиентская ИЛИ серверная),
// перетаскивание строк — на нашем sortableCore (без reflow).
//
//   <DumbTable rows={items()} columns={[
//     { key: 'name',  label: 'Название', sortable: true },
//     { key: 'price', label: 'Цена', sortable: true, align: 'right',
//       render: r => fmtPrice(r.price) },
//   ]} />

export type DumbColumn<T> = {
  /** ключ колонки: id для сортировки и путь к значению по умолчанию */
  key: string
  /** содержимое `<th>` */
  label?: JSX.Element
  /** разрешить сортировку по этой колонке */
  sortable?: boolean
  /** класс на `<th>` и `<td>` */
  class?: string
  /** класс только на `<th>` */
  headClass?: string
  /** выравнивание содержимого */
  align?: 'left' | 'center' | 'right'
  /** ширина колонки (CSS-значение, напр. '80px' или '12%') */
  width?: string
  /** не пускать клик по ячейке в onRowClick (для кнопок/инпутов внутри) */
  stopClick?: boolean
  /** содержимое `<td>`; по умолчанию — значение по `key` */
  render?: (row: T, index: number) => JSX.Element
  /** значение для сортировки; по умолчанию — `row[key]` */
  value?: (row: T) => unknown
}

export type DumbTableProps<T> = {
  rows: Array<T>
  columns: Array<DumbColumn<T>>
  /** стабильный id строки (нужен перетаскиванию); по умолчанию — индекс */
  rowId?: (row: T, index: number) => string

  /** активная колонка сортировки — задаёт СЕРВЕРНЫЙ режим (вместе с onSort) */
  sort?: string
  order?: 'asc' | 'desc'
  /**
   * Есть onSort → сортирует сервер (manualSorting); нет → сортируем на клиенте.
   * Третий клик по колонке сбрасывает сортировку — тогда придёт (null, null).
   */
  onSort?: (key: string | null, order: 'asc' | 'desc' | null) => void
  /** убрать третий клик-сброс: сортировка будет только asc ⇄ desc */
  noSortRemoval?: boolean
  /**
   * Анимировать смену сортировки через View Transitions.
   * Смысл только в клиентском режиме: там состояние меняется внутри таблицы и
   * снаружи его не обернуть. В серверном режиме оборачивай сам — данные всё
   * равно приходят от тебя. Строкам нужен уникальный `view-transition-name`
   * (см. `rowStyle`), иначе браузер сделает кроссфейд всей таблицы.
   */
  viewTransition?: boolean
  /** анимировать перетаскивание строк; по умолчанию да, но не при prefers-reduced-motion */
  animate?: boolean
  /**
   * Направление ПЕРВОГО клика по заголовку. По умолчанию — как у TanStack:
   * текстовые колонки начинают с asc, числовые с desc. `false` заставляет
   * все колонки начинать с asc, `true` — с desc.
   */
  sortDescFirst?: boolean

  /** включает перетаскивание строк за ручку; индексы — в текущем показанном порядке */
  onReorder?: (from: number, to: number) => void
  /**
   * Содержимое ручки перетаскивания. `false` — ручки нет вовсе, строка тянется
   * целиком; тогда стоит задать `dragThreshold`, иначе клик по строке и начало
   * драга неотличимы (а поверх таблицы ещё может быть выделение рамкой).
   */
  handle?: JSX.Element | false
  /** сколько px пройти мышью до старта драга (по умолчанию 0 — сразу) */
  dragThreshold?: number

  onRowClick?: (row: T, index: number) => void
  /** приглушить таблицу на время загрузки */
  loading?: boolean
  /** показывается вместо таблицы, когда строк нет */
  empty?: JSX.Element

  class?: string
  tableClass?: string
  headClass?: string
  rowClass?: (row: T, index: number) => string | undefined
  /** стиль на строку — например уникальный `view-transition-name` */
  rowStyle?: (row: T, index: number) => JSX.CSSProperties | undefined
  /** содержимое `<tfoot>` */
  footer?: JSX.Element
  /**
   * Распорки для виртуализации: сколько пикселей «съедено» строками выше и ниже
   * окна. Само окно режешь снаружи — как и страницу, таблица рисует что дали.
   * Перетаскивание при этом лучше выключать: снимок позиций делается один раз,
   * а строки за пределами окна в DOM просто отсутствуют.
   */
  spacerTop?: number
  spacerBottom?: number
}

const withViewTransition = (on: boolean | undefined, fn: () => void) => {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  // системная настройка сильнее: просили меньше движения — не анимируем
  if (on && shouldAnimate() && typeof doc.startViewTransition === 'function') doc.startViewTransition(fn)
  else fn()
}

// Стрелка сортировки: у сортируемой колонки видна всегда, неактивная — бледная.
function SortMark(props: { dir: false | 'asc' | 'desc' }) {
  return (
    <span aria-hidden="true" style={{ 'margin-left': '4px', opacity: props.dir ? '1' : '.3' }}>
      {props.dir === 'asc' ? '▲' : props.dir === 'desc' ? '▼' : '⇅'}
    </span>
  )
}

export function DumbTable<T>(props: DumbTableProps<T>) {
  // внутреннее состояние сортировки — только для клиентского режима
  const [localSort, setLocalSort] = createSignal<SortingState>([])
  const serverMode = () => !!props.onSort

  const sorting = (): SortingState =>
    serverMode()
      ? (props.sort ? [{ id: props.sort, desc: props.order === 'desc' }] : [])
      : localSort()

  const defs = (): ColumnDef<T>[] =>
    props.columns.map(c => ({
      id: c.key,
      // accessorFn обязателен: без него TanStack считает колонку display-колонкой,
      // getCanSort() всегда false и сортировка молча выключается — даже когда
      // сортирует сервер и само значение не используется.
      accessorFn: (row: T) => (c.value ? c.value(row) : (row as Record<string, unknown>)[c.key]),
      header: () => c.label ?? c.key,
      enableSorting: !!c.sortable,
      ...(props.sortDescFirst === undefined ? {} : { sortDescFirst: props.sortDescFirst }),
      cell: (ctx) => (c.render ? c.render(ctx.row.original, ctx.row.index) : String(ctx.getValue() ?? '')),
      meta: { col: c },
    }))

  const table = createSolidTable({
    get data() { return props.rows },
    get columns() { return defs() },
    state: {
      get sorting() { return sorting() },
    },
    get manualSorting() { return serverMode() },
    // третий клик по заголовку снимает сортировку (asc → desc → без сортировки)
    get enableSortingRemoval() { return !props.noSortRemoval },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting()) : updater
      if (serverMode()) {
        if (next.length) props.onSort!(next[0].id, next[0].desc ? 'desc' : 'asc')
        else props.onSort!(null, null)          // сброс к порядку по умолчанию
      } else {
        withViewTransition(props.viewTransition, () => setLocalSort(next))
      }
    },
    getRowId: (row, index) => props.rowId?.(row, index) ?? String(index),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const visibleRows = () => table.getRowModel().rows

  // Перетаскивание отключается, пока активна сортировка: показанный порядок
  // больше не совпадает с порядком данных, и пара from→to соврала бы.
  const dragDisabled = () => !props.onReorder || sorting().length > 0
  const withHandle = () => props.handle !== false
  const sortable = createDumbSortable({
    order: () => visibleRows().map(r => r.id),
    disabled: dragDisabled,
    mouseThreshold: props.dragThreshold,
    get animate() { return props.animate },
    onEnd: (from, to) => props.onReorder?.(from, to),
  })

  const colOf = (columnDef: { meta?: unknown }) => (columnDef.meta as { col: DumbColumn<T> }).col
  const cellStyle = (c: DumbColumn<T>) => ({
    'text-align': c.align ?? 'left',
    ...(c.width ? { width: c.width } : {}),
  })

  return (
    <div
      class={props.class}
      style={{ opacity: props.loading ? '.5' : '1', transition: 'opacity .15s' }}
    >
      <Show when={visibleRows().length} fallback={props.empty}>
        <table
          class={props.tableClass}
          style={{ width: '100%', 'border-collapse': 'collapse' }}
        >
          <thead class={props.headClass}>
            <For each={table.getHeaderGroups()}>
              {(hg) => (
                <tr>
                  <Show when={props.onReorder && withHandle()}>
                    <th style={{ width: '1%' }} />
                  </Show>
                  <For each={hg.headers}>
                    {(header) => {
                      const c = () => colOf(header.column.columnDef)
                      const canSort = () => header.column.getCanSort()
                      return (
                        <th
                          class={`${c().class ?? ''} ${c().headClass ?? ''}`.trim() || undefined}
                          style={{
                            ...cellStyle(c()),
                            padding: '6px 8px',
                            'white-space': 'nowrap',
                            cursor: canSort() ? 'pointer' : undefined,
                            'user-select': canSort() ? 'none' : undefined,
                          }}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <Show when={canSort()}>
                            <SortMark dir={header.column.getIsSorted()} />
                          </Show>
                        </th>
                      )
                    }}
                  </For>
                </tr>
              )}
            </For>
          </thead>

          <tbody>
            <Show when={props.spacerTop}>
              <tr aria-hidden="true" style={{ height: `${props.spacerTop}px` }} />
            </Show>
            <For each={visibleRows()}>
              {(row) => (
                <tr
                  ref={props.onReorder ? sortable.bind(row.id) : undefined}
                  data-key={row.id}
                  class={props.rowClass?.(row.original, row.index)}
                  style={{
                    cursor: props.onReorder && !withHandle() && !dragDisabled()
                      ? 'grab'
                      : props.onRowClick ? 'pointer' : undefined,
                    ...props.rowStyle?.(row.original, row.index),
                  }}
                  onClick={() => props.onRowClick?.(row.original, row.index)}
                >
                  <Show when={props.onReorder && withHandle()}>
                    <td style={{ padding: '6px 4px', width: '1%' }} onClick={(e) => e.stopPropagation()}>
                      <span
                        data-drag-handle
                        style={{
                          display: 'inline-block',
                          cursor: dragDisabled() ? 'not-allowed' : 'grab',
                          opacity: dragDisabled() ? '.3' : '1',
                          'touch-action': 'none',
                        }}
                        title={dragDisabled() ? 'reset sorting to reorder' : 'drag'}
                      >
                        {props.handle ?? '⠿'}
                      </span>
                    </td>
                  </Show>
                  <For each={row.getVisibleCells()}>
                    {(cell) => {
                      const c = () => colOf(cell.column.columnDef)
                      return (
                        <td
                          class={c().class}
                          style={{ ...cellStyle(c()), padding: '6px 8px' }}
                          onClick={c().stopClick ? (e: Event) => e.stopPropagation() : undefined}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      )
                    }}
                  </For>
                </tr>
              )}
            </For>
            <Show when={props.spacerBottom}>
              <tr aria-hidden="true" style={{ height: `${props.spacerBottom}px` }} />
            </Show>
          </tbody>

          <Show when={props.footer}>
            <tfoot>{props.footer}</tfoot>
          </Show>
        </table>
      </Show>
    </div>
  )
}
