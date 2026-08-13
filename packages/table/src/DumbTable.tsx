import { For, Show, createSignal, createMemo, untrack } from 'solid-js'
import type { JSX } from '@solidjs/web'
// TanStack отсюда убран. Восьмая версия тянет `solid-js/store`, которого во
// второй линии Solid нет вовсе, а в девятой API переписан целиком (фичи,
// атомы, модели строк) — и всё это ради одной сортировки по колонке.
// Собственной сортировки тут на тридцать строк, зато у пакета не осталось
// рантайм-зависимостей.
import { createDumbSortable } from '@solid-dumb-kit/sortable'
import { shouldAnimate } from '@solid-dumb-kit/shared'

// Таблица «принеси свои колонки»: описание колонки — простой объект. Сортировка
// своя (клиентская ИЛИ серверная), перетаскивание строк — на нашем sortableCore
// (без reflow).
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
   * Направление ПЕРВОГО клика по заголовку. По умолчанию текстовые колонки
   * начинают с asc, числовые — с desc. `false` заставляет все колонки
   * начинать с asc, `true` — с desc.
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

/** порядок сортировки: колонка и направление; `null` — без сортировки */
type Sort = { key: string; desc: boolean } | null

export function DumbTable<T extends Record<string, unknown>>(props: DumbTableProps<T>) {
  // внутреннее состояние сортировки — только для клиентского режима
  const [localSort, setLocalSort] = createSignal<Sort>(null)
  const serverMode = () => !!props.onSort

  const colFor = (key: string) => props.columns.find((c) => c.key === key)
  const valueOf = (c: DumbColumn<T>, row: T): unknown =>
    c.value ? c.value(row) : (row as Record<string, unknown>)[c.key]

  /**
   * Первый клик по заголовку: текст начинает с возрастания, ЧИСЛА — с убывания.
   * Так вело себя прежнее решение, и это разумно: у чисел обычно интересен
   * максимум (цена, остаток, просрочка), у текста — алфавит.
   * Перебивается пропом `sortDescFirst`.
   */
  const firstDesc = (c: DumbColumn<T>) => {
    if (props.sortDescFirst !== undefined) return props.sortDescFirst
    const sample = props.rows.find((r) => valueOf(c, r) != null)
    return sample !== undefined && typeof valueOf(c, sample) === 'number'
  }

  /** следующее состояние заголовка: asc ⇄ desc, а третьим кликом — сброс */
  const nextSort = (c: DumbColumn<T>, cur: Sort): Sort => {
    if (!cur || cur.key !== c.key) return { key: c.key, desc: firstDesc(c) }
    if (cur.desc === firstDesc(c)) return { key: c.key, desc: !cur.desc }
    return props.noSortRemoval ? { key: c.key, desc: firstDesc(c) } : null
  }

  const sortOf = (): Sort =>
    serverMode()
      ? (props.sort ? { key: props.sort, desc: props.order === 'desc' } : null)
      : localSort()

  function toggleSort(c: DumbColumn<T>) {
    if (!c.sortable) return
    const next = nextSort(c, sortOf())
    if (serverMode()) {
      if (next) props.onSort!(next.key, next.desc ? 'desc' : 'asc')
      else props.onSort!(null, null)
      return
    }
    withViewTransition(props.viewTransition, () => {
      setLocalSort(next)
    })
  }

  /**
   * Сравнение значений. Числа и даты идут по величине, остальное — строкой с
   * учётом локали и цифр внутри («файл2» раньше «файл10»). `null` и `undefined`
   * всегда в конце: пустая ячейка не должна возглавлять список ни в одну
   * сторону.
   */
  const compare = (a: unknown, b: unknown): number => {
    const aNil = a === null || a === undefined || a === ''
    const bNil = b === null || b === undefined || b === ''
    if (aNil || bNil) return aNil && bNil ? 0 : aNil ? 1 : -1
    if (typeof a === 'number' && typeof b === 'number') return a - b
    if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
    if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
    return String(a).localeCompare(String(b), 'ru', { numeric: true, sensitivity: 'base' })
  }

  /**
   * Строки в показанном порядке. Сортировка СТАБИЛЬНАЯ: равные значения
   * сохраняют исходный порядок, иначе строки прыгают между кликами на ровном
   * месте. Серверный режим ничего не сортирует — что дали, то и рисуем.
   */
  const visibleRows = createMemo(() => {
    const s = sortOf()
    if (!s || serverMode()) return props.rows
    const c = colFor(s.key)
    if (!c) return props.rows
    return props.rows
      .map((row, i) => ({ row, i }))
      .sort((x, y) => {
        const d = compare(valueOf(c, x.row), valueOf(c, y.row))
        return (d !== 0 ? (s.desc ? -d : d) : x.i - y.i)
      })
      .map((x) => x.row)
  })

  const idOf = (row: T, index: number) => props.rowId?.(row, index) ?? String(index)

  // Перетаскивание отключается, пока активна сортировка: показанный порядок
  // больше не совпадает с порядком данных, и пара from→to соврала бы.
  const dragDisabled = () => !props.onReorder || sortOf() !== null
  const withHandle = () => props.handle !== false
  const sortable = createDumbSortable({
    order: () => visibleRows().map((r, i) => idOf(r, i)),
    disabled: dragDisabled,
    get mouseThreshold() { return untrack(() => props.dragThreshold) },
    get animate() { return untrack(() => props.animate) },
    onEnd: (from, to) => props.onReorder?.(from, to),
  })

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
            <tr>
              <Show when={props.onReorder && withHandle()}>
                <th class="w-px" />
              </Show>
              <For each={props.columns}>
                {(c) => (
                  <th
                    class={`${c.class ?? ''} ${c.headClass ?? ''} ${
                      c.sortable ? 'cursor-pointer select-none' : ''
                    }`.trim() || undefined}
                    style={{ ...cellStyle(c), 'white-space': 'nowrap' }}
                    onClick={() => toggleSort(c)}
                  >
                    {c.label ?? c.key}
                    <Show when={c.sortable}>
                      <SortMark
                        dir={sortOf()?.key === c.key ? (sortOf()!.desc ? 'desc' : 'asc') : false}
                      />
                    </Show>
                  </th>
                )}
              </For>
            </tr>
          </thead>

          <tbody>
            <Show when={props.spacerTop}>
              <tr aria-hidden="true" style={{ height: `${props.spacerTop}px` }} />
            </Show>
            <For each={visibleRows()}>
              {(row, index) => {
                // id для движка — разово и untracked: тело колбэка For вне
                // tracking scope, чтение index() там Solid 2 отбивает
                const rowId = untrack(() => idOf(row, index()))
                return (
                <tr
                  // Строка только регистрируется в движке; старт драга приходит
                  // из JSX ниже — `pointerdown` у Solid делегирован, поэтому на
                  // тысяче строк висит один слушатель на документ, а не тысяча.
                  // БЕЗ условия по props.onReorder: чтение пропа при создании
                  // строки untracked (STRICT_READ_UNTRACKED), а движок и так
                  // молчит, когда перетаскивание выключено (opts.disabled).
                  ref={sortable.row(rowId)}
                  onPointerDown={sortable.press(rowId)}
                  data-key={idOf(row, index())}
                  class={props.rowClass?.(row, index())}
                  style={{
                    cursor: props.onReorder && !withHandle() && !dragDisabled()
                      ? 'grab'
                      : props.onRowClick ? 'pointer' : undefined,
                    ...props.rowStyle?.(row, index()),
                  }}
                  onClick={() => props.onRowClick?.(row, index())}
                >
                  <Show when={props.onReorder && withHandle()}>
                    <td class="w-px" onClick={(e) => e.stopPropagation()}>
                      <span
                        data-drag-handle
                        class={`inline-block touch-none ${
                          dragDisabled() ? 'cursor-not-allowed' : 'cursor-grab'
                        }`}
                        title={dragDisabled() ? 'reset sorting to reorder' : 'drag'}
                      >
                        {props.handle ?? '⠿'}
                      </span>
                    </td>
                  </Show>
                  <For each={props.columns}>
                    {(c) => (
                      <td
                        class={c.class}
                        style={cellStyle(c)}
                        onClick={c.stopClick ? (e: Event) => e.stopPropagation() : undefined}
                      >
                        {c.render ? c.render(row, index()) : String(valueOf(c, row) ?? '')}
                      </td>
                    )}
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
