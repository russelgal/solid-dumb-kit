import { For, Show, createSignal, createMemo, type JSX } from 'solid-js'
import {
  createSolidTable,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
} from '@tanstack/solid-table'
import { createDumbSortable } from '@solid-dumb-kit/sortable'
import { shouldAnimate } from '@solid-dumb-kit/shared'

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

/**
 * Стрелка сортировки. У сортируемой колонки она видна ВСЕГДА: иначе колонку с
 * сортировкой не отличить от обычной, пока по ней не щёлкнешь. Неактивная — не
 * блёклая (правило контраста), а другой значок: ⇅ против ▲/▼.
 */
function SortMark(props: { dir: false | 'asc' | 'desc' }) {
  return (
    <span aria-hidden="true" class="ml-1 inline-block">
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

  /**
   * TanStack пересоздаёт объекты Row на каждую смену data, а <For> сравнивает
   * элементы по ссылке — из-за этого при виртуальном скролле пересоздавались
   * ВСЕ <tr> на каждый шаг прокрутки. Держимся за исходные объекты строк: они
   * не меняются, значит уже отрисованные строки переиспользуются, а меняются
   * только края окна.
   */
  const visibleRows = createMemo(() => table.getRowModel().rows.map(r => r.original))
  const rowOf = (original: T) => table.getRowModel().rows.find(r => r.original === original)!

  // Перетаскивание отключается, пока активна сортировка: показанный порядок
  // больше не совпадает с порядком данных, и пара from→to соврала бы.
  const dragDisabled = () => !props.onReorder || sorting().length > 0
  const withHandle = () => props.handle !== false
  const sortable = createDumbSortable({
    order: () => table.getRowModel().rows.map(r => r.id),
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
    <div class={props.class}>
      {/* Пока данные едут, таблица не выцветает (её всё равно читают) — сверху
          кладётся полоса прогресса daisyUI. */}
      <Show when={props.loading}>
        <progress class="progress progress-primary mb-1 h-1 w-full" />
      </Show>
      <Show when={visibleRows().length} fallback={props.empty}>
        <table class={`table ${props.tableClass ?? ''}`}>
          <thead class={props.headClass}>
            <For each={table.getHeaderGroups()}>
              {(hg) => (
                <tr>
                  <Show when={props.onReorder && withHandle()}>
                    <th class="w-px" />
                  </Show>
                  <For each={hg.headers}>
                    {(header) => {
                      const c = () => colOf(header.column.columnDef)
                      const canSort = () => header.column.getCanSort()
                      return (
                        <th
                          class={`${c().class ?? ''} ${c().headClass ?? ''}`.trim() || undefined}
                          classList={{ 'cursor-pointer select-none': canSort() }}
                          style={{ ...cellStyle(c()), 'white-space': 'nowrap' }}
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
              {(original) => {
                const row = () => rowOf(original)
                return (
                <tr
                  ref={props.onReorder ? sortable.bind(row().id) : undefined}
                  data-key={row().id}
                  class={props.rowClass?.(original, row().index)}
                  style={{
                    cursor: props.onReorder && !withHandle() && !dragDisabled()
                      ? 'grab'
                      : props.onRowClick ? 'pointer' : undefined,
                    ...props.rowStyle?.(original, row().index),
                  }}
                  onClick={() => props.onRowClick?.(original, row().index)}
                >
                  <Show when={props.onReorder && withHandle()}>
                    <td class="w-px" onClick={(e) => e.stopPropagation()}>
                      <span
                        data-drag-handle
                        class="inline-block touch-none"
                        classList={{
                          'cursor-not-allowed text-base-content': dragDisabled(),
                          'cursor-grab': !dragDisabled(),
                        }}
                        title={dragDisabled() ? 'reset sorting to reorder' : 'drag'}
                      >
                        {props.handle ?? '⠿'}
                      </span>
                    </td>
                  </Show>
                  <For each={row().getVisibleCells()}>
                    {(cell) => {
                      const c = () => colOf(cell.column.columnDef)
                      return (
                        <td
                          class={c().class}
                          style={cellStyle(c())}
                          onClick={c().stopClick ? (e: Event) => e.stopPropagation() : undefined}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      )
                    }}
                  </For>
                </tr>
                )
              }}
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
