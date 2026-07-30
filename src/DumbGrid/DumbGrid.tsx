import { createMemo, createSignal, For, Show, type JSX } from 'solid-js'
import { makePersisted } from '@solid-primitives/storage'
import * as v from 'valibot'
import { createDumbGridGroup, type DumbGridGroupHandle } from './solid'
import {
  cellRect, firstFreeCell, packFlow, placeFree, reorder, resolveSpan, rowCount,
  type GridSpan, type LayoutMode, type SpanValue,
} from './gridMath'

// Дашборд-сетка: N колонок, блоки размером в целое число колонок и строк,
// перетаскиваемые и ресайзимые кратно сетке, с персистом раскладки.
//
// Три режима раскладки (проп `mode`):
//   • flow  — блоки текут по порядку, как `grid-auto-flow: row`: позиция это
//             просто индекс в массиве, дырка после широкого блока остаётся;
//   • dense — тот же порядок, но дырки затыкаются следующими блоками;
//   • free  — у каждого блока свои {x,y}: двигай куда хочешь, в том числе вниз в
//             пустоту; занятое место дроп отклоняет (соседей не расталкиваем).
//
//   <DumbGrid cols={12} rowHeight={90} storageKey="dashboard" items={[
//     { id: 'sales', w: 6, h: 2, content: () => <Sales /> },
//     { id: 'stock', w: 3, content: () => <Stock /> },
//   ]} />
//
// Позиции блоков выставляются ЯВНО (grid-column-start/grid-row-start), а не
// авто-потоком: браузер тогда не домысливает раскладку, и наша арифметика для
// FLIP описывает ровно то, что нарисовано. Побочный плюс — до первого
// ResizeObserver (и в SSR) сетка уже верна, потому что раскладку рисует CSS.

/** блок сетки */
export type DumbGridItem = {
  id: string
  /** содержимое — render prop */
  content: () => JSX.Element
  /**
   * Ширина: число колонок ЛИБО доля сетки — `'full'`, `'half'`, `'third'`,
   * `'quarter'`, `'two-thirds'`, `'three-quarters'` или любая дробь `'5/12'`.
   * По умолчанию 1 колонка.
   */
  w?: SpanValue
  /** высота в строках (по умолчанию 1) */
  h?: number
  /** стартовая колонка в режиме free (иначе кладём потоком) */
  x?: number
  /** стартовая строка в режиме free */
  y?: number
  /** пределы ресайза — тоже числом или пресетом */
  minW?: SpanValue
  maxW?: SpanValue
  minH?: number
  maxH?: number
  /** ни двигать, ни ресайзить (от соседей всё равно может поехать) */
  locked?: boolean
  /** показывать кнопку удаления (по умолчанию да, если задан onRemove) */
  removable?: boolean
}

/** сохраняемая раскладка: порядок массива + размеры (+ позиции в режиме free) */
export type DumbGridLayout = Array<{ id: string; w: number; h: number; x?: number; y?: number }>

export type DumbGridProps = {
  items: Array<DumbGridItem>
  /**
   * Как раскладывать (по умолчанию `flow`):
   *  • `flow`  — по порядку, дырки остаются;
   *  • `dense` — по порядку, дырки затыкаются следующими блоками;
   *  • `free`  — по своим {x,y}: двигай куда угодно, включая пустоту внизу.
   */
  mode?: LayoutMode
  /** колонок в сетке (по умолчанию 12) */
  cols?: number
  /** высота строки, px (по умолчанию 80) */
  rowHeight?: number
  /** зазор, px (по умолчанию 12) */
  gap?: number
  gapX?: number
  gapY?: number
  /** ключ localStorage; без него раскладка живёт только в памяти */
  storageKey?: string
  /** внешнее управление раскладкой (тогда storageKey не нужен) */
  layout?: DumbGridLayout
  /** раскладка изменилась — сохрани у себя */
  onLayout?: (layout: DumbGridLayout) => void
  /**
   * Задан — на блоках появляется кнопка удаления, а по клику зовётся этот
   * колбэк. Набором блоков владеет потребитель, поэтому убрать элемент из
   * `items` он должен сам; кит только рисует кнопку и чистит за блоком раскладку.
   */
  onRemove?: (id: string) => void
  /** подписи для кнопок (title/aria-label) */
  labels?: { remove?: string; resize?: string }
  /**
   * Группа сеток (`createDumbGridGroup`) — с ней блок можно перетащить в другую
   * сетку той же группы. Локальные изменения (перестановка, ресайз, перенос
   * внутри) компонент по-прежнему применяет сам; наружу, в `onTransfer` группы,
   * уходит только переезд между сетками — он затрагивает две раскладки сразу.
   */
  group?: DumbGridGroupHandle
  /** имя этой сетки в группе (обязательно, если задан `group`) */
  name?: string
  /**
   * Использовать нативный HTML5 drag-and-drop (по умолчанию да). Тогда зону под
   * указателем определяет браузер, а не наш хиттест; на тач-устройствах, где
   * этого API нет, работает указательный жест. `false` — всегда наш.
   */
  nativeDnd?: boolean
  /** ресайз разрешён (по умолчанию да) */
  resizable?: boolean
  /**
   * Режим редактирования (по умолчанию `true`). `false` — готовая сетка и
   * ничего лишнего: ни ручек ресайза, ни кнопок удаления, ни разметки сетки, ни
   * единого обработчика на блоках. Ровно то, что нужно на «боевом» экране, где
   * дашборд просто показывают.
   *
   * Отличие от `disabled`: тот оставляет редакторскую разметку и лишь глушит
   * жесты (удобно, пока идёт сохранение), а `editable={false}` её не рендерит.
   */
  editable?: boolean
  /** жесты запрещены целиком (разметка редактора остаётся) */
  disabled?: boolean
  /** анимировать расступание и приземление; по умолчанию да, но не при prefers-reduced-motion */
  animate?: boolean
  /** тач: удержание до старта драга, мс (по умолчанию 350) */
  pressDelay?: number
  /** мышь: дистанция до старта драга, px */
  mouseThreshold?: number
  /**
   * Показывать разметку сетки: `'drag'` (по умолчанию) — только во время жеста,
   * `true` — всегда, `false` — никогда. Рисуется CSS-градиентом на одном
   * элементе-подложке, поэтому ничего не меряет и не добавляет узлов на блок.
   */
  showGrid?: boolean | 'drag'
  /**
   * Сколько пустых строк держать под раскладкой, чтобы блок было куда увести
   * вниз. По умолчанию 2 в режиме `free` (там пустота осмысленна) и 0 в потоке.
   * Запас постоянный: расти во время жеста он не может, иначе появление полосы
   * прокрутки меняет ширину контента и сбивает шаг колонок.
   */
  spareRows?: number
  class?: string
  style?: JSX.CSSProperties
  /** класс блока-обёртки */
  blockClass?: string
  /** инлайн-стиль блока-обёртки */
  blockStyle?: JSX.CSSProperties
}

const DEFAULT_COLS = 12
const DEFAULT_ROW_H = 80
const DEFAULT_GAP = 12
const HANDLE = 16
const REMOVE = 22

const LayoutSchema = v.array(
  v.object({
    id: v.string(),
    w: v.number(),
    h: v.number(),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
  }),
)

/** Позиция и коробка блока — общее у режима редактирования и просмотра. */
function blockBox(span: { w: number; h: number }, pos?: { col: number; row: number }): JSX.CSSProperties {
  return {
    // ЯВНАЯ позиция: раскладку считаем мы, браузер не домысливает
    'grid-column': `${(pos?.col ?? 0) + 1} / span ${span.w}`,
    'grid-row': `${(pos?.row ?? 0) + 1} / span ${span.h}`,
    position: 'relative',
    'z-index': '1',                    // над подложкой-сеткой
    'min-width': '0',
    'min-height': '0',
    'box-sizing': 'border-box',
  }
}

function clampInt(n: number, lo: number, hi: number): number {
  const i = Math.round(n)
  if (!Number.isFinite(i)) return lo
  return Math.max(lo, Math.min(hi, i))
}

/**
 * Размеры и позиция блока, зажатые в пределы и в число колонок.
 * Пределы тоже могут быть пресетами, поэтому прогоняем их через resolveSpan.
 */
function spanOf(
  item: DumbGridItem,
  src: { w: number; h: number; x?: number; y?: number },
  cols: number,
): GridSpan & { x?: number; y?: number } {
  const minW = item.minW === undefined ? 1 : resolveSpan(item.minW, cols)
  const maxW = item.maxW === undefined ? cols : resolveSpan(item.maxW, cols)
  const w = clampInt(src.w, Math.max(1, minW), Math.min(cols, maxW))
  const out: GridSpan & { x?: number; y?: number } = {
    id: item.id,
    w,
    h: clampInt(src.h, Math.max(1, item.minH ?? 1), item.maxH ?? Number.MAX_SAFE_INTEGER),
  }
  // координаты несём дальше только если они есть: их отсутствие — это «уложи
  // потоком», а не «поставь в угол»
  if (Number.isFinite(src.x)) out.x = clampInt(src.x as number, 0, Math.max(0, cols - w))
  if (Number.isFinite(src.y)) out.y = Math.max(0, Math.round(src.y as number))
  return out
}

/**
 * Слить сохранённую раскладку с текущим набором блоков.
 *
 * Набор блоков живёт своей жизнью (добавили виджет, убрали виджет,
 * переименовали id), а в localStorage лежит вчерашний снимок. Поэтому: чего нет
 * в items — выбрасываем, чего нет в сторе — дописываем в конец, размеры
 * прогоняем через пределы. Без этого устаревший стор рисует пустые дырки или
 * теряет новые блоки.
 */
export function mergeLayout(
  saved: DumbGridLayout | null | undefined,
  items: Array<DumbGridItem>,
  cols: number,
  mode: LayoutMode = 'flow',
): DumbGridLayout {
  const byId = new Map(items.map((it) => [it.id, it]))
  const out: DumbGridLayout = []

  for (const s of saved ?? []) {
    const it = byId.get(s.id)
    if (!it) continue                     // блок исчез из items
    out.push(spanOf(it, s, cols))
    byId.delete(s.id)
  }
  // Блоки, которых в сторе нет, — это добавленные: дописываем в конец в порядке
  // items. В свободном режиме им ещё нужно место, иначе новый блок ляжет в угол
  // поверх соседа: ищем первую дырку сверху. В потоковых режимах координаты не
  // нужны вовсе — не пишем их и в стор.
  for (const it of items) {
    if (!byId.has(it.id)) continue        // порядок items, а не Map
    const w = resolveSpan(it.w, cols)
    const h = Math.max(1, Math.round(it.h ?? 1) || 1)
    const spot = mode === 'free' && it.x === undefined && it.y === undefined && out.length
      ? firstFreeCell({ placed: placeFree(out, cols), cols, w, h })
      : { x: it.x, y: it.y }
    out.push(spanOf(it, { w, h, x: spot.x, y: spot.y }, cols))
  }
  return out
}

const GRID_LINE = 'rgba(100,116,139,.28)'

/**
 * Разметка сетки — двумя CSS-градиентами на одном элементе-подложке.
 *
 * Ширина колонки НЕ меряется из JS: это `calc((100% - зазоры) / cols)`, браузер
 * считает её сам, поэтому линии верны с первого кадра и при любом ресайзе окна.
 *
 * Грабля, из-за которой вертикальных линий сначала не было видно: проценты в
 * стопах градиента считаются от размера ТАЙЛА (`background-size`), а не от
 * ширины элемента. Поэтому тайлить по X нельзя — рисуем все границы колонок
 * явными стопами на всю ширину (`background-size: 100%`), и тогда `100%` внутри
 * calc означает именно ширину подложки. По Y тайлить можно: там всё в px.
 */
export function gridLinesBackground(args: {
  cols: number
  gapX: number
  rowH: number
  gapY: number
}): { image: string; size: string } {
  const { cols, gapX, rowH, gapY } = args
  const col = `calc((100% - ${(cols - 1) * gapX}px) / ${cols})`
  const stepX = `calc(${col} + ${gapX}px)`
  // при нулевом зазоре зазора нет — рисуем волосяную линию в 1px
  const lineW = Math.max(1, gapX)
  const lineH = Math.max(1, gapY)

  // границы колонок: перед каждой колонкой, кроме первой
  const stops: Array<string> = ['transparent 0']
  for (let i = 1; i < cols; i++) {
    const at = `calc(${stepX} * ${i} - ${gapX}px)`
    const to = `calc(${stepX} * ${i} - ${gapX}px + ${lineW}px)`
    stops.push(`transparent ${at}`, `${GRID_LINE} ${at}`, `${GRID_LINE} ${to}`, `transparent ${to}`)
  }
  stops.push('transparent 100%')

  const stepY = rowH + gapY
  return {
    image: [
      `linear-gradient(to right, ${stops.join(', ')})`,
      `linear-gradient(to bottom, transparent 0, transparent ${stepY - lineH}px, ${GRID_LINE} ${stepY - lineH}px, ${GRID_LINE} ${stepY}px)`,
    ].join(', '),
    // вертикальные линии — на всю ширину (тайлить нельзя, см. выше),
    // горизонтальные — тайлом в одну строку
    size: `100% 100%, 100% ${stepY}px`,
  }
}

export function DumbGrid(props: DumbGridProps) {
  const mode = (): LayoutMode => props.mode ?? 'flow'
  const cols = () => Math.max(1, Math.floor(props.cols ?? DEFAULT_COLS))
  const rowH = () => props.rowHeight ?? DEFAULT_ROW_H
  const gapX = () => props.gapX ?? props.gap ?? DEFAULT_GAP
  const gapY = () => props.gapY ?? props.gap ?? DEFAULT_GAP

  // Раскладка: внешняя (props.layout), персистентная (storageKey) или в памяти.
  // makePersisted зовём только когда ключ реально дан — иначе компонент писал бы
  // в localStorage под общим именем и две сетки на странице делили бы один стор.
  const persisted = props.storageKey
    ? makePersisted(createSignal<DumbGridLayout | null>(null), {
        name: props.storageKey,
        serialize: (l: DumbGridLayout | null) => JSON.stringify(l ?? []),
        deserialize: (raw: string) => {
          try {
            const parsed = v.safeParse(LayoutSchema, JSON.parse(raw))
            return parsed.success ? parsed.output : null   // битый стор → дефолт
          } catch {
            return null
          }
        },
      })
    : null
  const [memory, setMemory] = createSignal<DumbGridLayout | null>(null)

  const saved = () => props.layout ?? (persisted ? persisted[0]() : memory())
  const layout = createMemo(() => mergeLayout(saved(), props.items, cols(), mode()))

  const commit = (next: DumbGridLayout) => {
    if (!props.layout) (persisted ? persisted[1] : setMemory)(next)
    props.onLayout?.(next)
  }

  const placed = createMemo(() => {
    const m = mode()
    return m === 'free' ? placeFree(layout(), cols()) : packFlow(layout(), cols(), m)
  })
  const rows = createMemo(() => rowCount(placed()))
  const itemById = createMemo(() => new Map(props.items.map((it) => [it.id, it])))

  // Раскладка и позиции — по id, потому что рендер идёт по props.items, а не по
  // layout(): layout пересоздаётся на каждом дропе, и <For> по нему пересоздавал
  // бы DOM всех блоков. Внутри блока может жить что угодно со своим состоянием —
  // скролл, фокус, вложенный сортировщик со своими ref'ами, — и терять его на
  // каждую перестановку нельзя. Порядок в DOM при этом не важен: позиция задана
  // явными grid-column/grid-row.
  const spanById = createMemo(() => new Map(layout().map((s) => [s.id, s])))
  const posById = createMemo(() => new Map(placed().map((p) => [p.id, p])))

  /**
   * В свободном режиме координаты пишем ВСЕМ блокам сразу, а не только
   * сдвинутому: иначе у остальных `x/y` остаются пустыми, и первый же дроп
   * заставит их разложиться заново — сетка «прыгнет» под руками.
   */
  const materialize = (next: DumbGridLayout): DumbGridLayout => {
    if (mode() !== 'free') return next
    const pos = new Map(placeFree(next, cols()).map((p) => [p.id, p]))
    return next.map((s) => {
      const p = pos.get(s.id)
      return p ? { ...s, x: p.col, y: p.row } : s
    })
  }

  const engineOptions = {
    blocks: () => {
      const map = itemById()
      const c = cols()
      // движок работает только числами: пресеты разрешаем здесь, на границе
      return layout().map((s) => {
        const it = map.get(s.id)
        return {
          ...s,
          minW: it?.minW === undefined ? undefined : resolveSpan(it.minW, c),
          maxW: it?.maxW === undefined ? undefined : resolveSpan(it.maxW, c),
          minH: it?.minH,
          maxH: it?.maxH,
          locked: it?.locked,
        }
      })
    },
    mode,
    cols,
    rowHeight: rowH,
    gapX,
    gapY,
    disabled: () => props.disabled === true || !editable(),
    resizable: () => props.resizable !== false,
    animate: props.animate,
    pressDelay: props.pressDelay,
    mouseThreshold: props.mouseThreshold,
    onReorder: (from: number, to: number) => commit(materialize(reorder(layout(), from, to))),
    onMove: (id: string, x: number, y: number) =>
      commit(materialize(layout().map((s) => (s.id === id ? { ...s, x, y } : s)))),
    onResize: (id: string, w: number, h: number) => {
      const it = itemById().get(id)
      if (!it) return
      commit(materialize(layout().map((s) => (s.id === id ? spanOf(it, { ...s, w, h }, cols()) : s))))
    },
  }

  // Даже одна сетка живёт как группа из одной зоны: механика жеста тогда ровно
  // одна на все случаи — нативный DnD там, где он есть, и указательный жест на
  // тач. Чистый указательный движок остался примитивом (createDumbGrid) для
  // тех, кому нативный DnD не нужен вовсе.
  const solo = props.group
    ? null
    : createDumbGridGroup({
        animate: props.animate,
        native: props.nativeDnd,
        pressDelay: props.pressDelay,
        mouseThreshold: props.mouseThreshold,
      })
  const g = (props.group ?? solo!).grid(props.name ?? 'grid', engineOptions)


  /**
   * Запас пустых строк: без него блок некуда увести вниз — сетка кончается ровно
   * на последнем блоке.
   *
   * Запас ПОСТОЯННЫЙ, а не «добавим на время жеста». Иначе высота контейнера
   * растёт в момент старта драга, у страницы появляется скроллбар, ширина
   * контента уменьшается на его толщину — и ResizeObserver честно пересчитывает
   * ширину колонки прямо посреди жеста. Блоки при этом едут сами по себе.
   */
  const spare = () =>
    // в режиме просмотра пустой хвост не нужен: уводить туда нечего
    editable() ? Math.max(0, props.spareRows ?? (mode() === 'free' ? 2 : 0)) : 0
  const totalRows = () => rows() + spare()
  const heightOf = (n: number) => n * rowH() + Math.max(0, n - 1) * gapY()

  const editable = () => props.editable !== false
  const showGrid = () => props.showGrid ?? 'drag'
  const gridVisible = () => showGrid() === true || (showGrid() === 'drag' && !!g.active())

  const gridBackground = () => gridLinesBackground({ cols: cols(), gapX: gapX(), rowH: rowH(), gapY: gapY() })

  return (
    <div
      ref={g.container}
      class={props.class}
      style={{
        display: 'grid',
        'grid-template-columns': `repeat(${cols()}, minmax(0, 1fr))`,
        'grid-auto-rows': `${rowH()}px`,
        'column-gap': `${gapX()}px`,
        'row-gap': `${gapY()}px`,
        position: 'relative',
        // высота под все строки плюс запас, чтобы блок было куда увести вниз
        'min-height': `${heightOf(totalRows())}px`,
        // если сетку положили в свой скроллер — место под полосу держим всегда,
        // иначе её появление меняет ширину контента и сбивает шаг колонок
        'scrollbar-gutter': 'stable',
        ...props.style,
      }}
    >
      <Show when={editable() && showGrid() !== false}>
        <div
          data-grid-lines
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: '0',
            padding: 'inherit',
            'box-sizing': 'border-box',
            'pointer-events': 'none',
            'z-index': '0',
            'background-image': gridBackground().image,
            'background-size': gridBackground().size,
            'background-origin': 'content-box',
            'background-clip': 'content-box',
            'background-repeat': 'no-repeat, repeat',
            opacity: gridVisible() ? '1' : '0',
            transition: 'opacity .15s ease',
          }}
        />
      </Show>

      {/*
        Две ветки, а не одна с флагами: ref'ы навешиваются в момент создания
        элемента, поэтому «выключить редактирование» — это пересоздать блоки без
        привязки к движку. Иначе слушатели остались бы висеть, просто ничего не
        делая. Show переключает ветку целиком, и в режиме просмотра на блоках
        нет ни одного обработчика, ни ручек, ни кнопок.
      */}
      <Show when={editable()} fallback={
        <For each={props.items}>
          {(it) => {
            const span = () => spanById().get(it.id)
            return (
              <Show when={span()}>
                {(s) => (
                  <div class={props.blockClass} style={{ ...blockBox(s(), posById().get(it.id)), ...props.blockStyle }}>
                    {it.content()}
                  </div>
                )}
              </Show>
            )
          }}
        </For>
      }>
      <For each={props.items}>
        {(it) => {
          const span = () => spanById().get(it.id)
          const dragging = () => g.active()?.id === it.id
          return (
            <Show when={span()}>
              {(s) => (
                <div
                  ref={g.bind(it.id)}
                  class={props.blockClass}
                  style={{
                    ...blockBox(s(), posById().get(it.id)),
                    cursor: it.locked || props.disabled ? 'default' : 'grab',
                    'touch-action': 'manipulation',
                    ...props.blockStyle,
                  }}
                >
                  {it.content()}

                  <Show when={props.onRemove && !props.disabled && it.removable !== false}>
                    <button
                      type="button"
                      data-grid-remove
                      data-no-drag
                      title={props.labels?.remove ?? 'Удалить блок'}
                      aria-label={props.labels?.remove ?? 'Удалить блок'}
                      onClick={() => props.onRemove?.(it.id)}
                      style={{
                        position: 'absolute',
                        top: '0',
                        right: '0',
                        width: `${REMOVE}px`,
                        height: `${REMOVE}px`,
                        display: 'grid',
                        'place-items': 'center',
                        padding: '0',
                        border: 'none',
                        background: 'transparent',
                        color: 'currentColor',
                        font: 'inherit',
                        'line-height': '1',
                        cursor: 'pointer',
                        opacity: '0.45',
                        // на кнопке жест не начинается: она <button> и с [data-no-drag],
                        // а это ровно то, что движок пропускает мимо драга
                        'z-index': '2',
                      }}
                    >
                      ✕
                    </button>
                  </Show>

                  <Show when={props.resizable !== false && !it.locked && !props.disabled}>
                    <div
                      ref={g.resize(it.id)}
                      title={props.labels?.resize ?? 'Потяни, чтобы изменить размер'}
                      style={{
                        position: 'absolute',
                        right: '0',
                        bottom: '0',
                        width: `${HANDLE}px`,
                        height: `${HANDLE}px`,
                        cursor: 'nwse-resize',
                        // уголок из двух штрихов — рисуем градиентом, без иконок
                        background:
                          'linear-gradient(135deg, transparent 0 45%, currentColor 45% 55%, transparent 55% 70%, currentColor 70% 80%, transparent 80%)',
                        opacity: dragging() ? '0.9' : '0.35',
                        'border-bottom-right-radius': '8px',
                      }}
                    />
                  </Show>
                </div>
              )}
            </Show>
          )
        }}
      </For>
      </Show>
    </div>
  )
}

// Реэкспорт для потребителей, которым нужна только математика (напр. посчитать
// размер блока в px под canvas-график внутри него).
export { cellRect, packFlow, resolveSpan, firstFreeCell }
