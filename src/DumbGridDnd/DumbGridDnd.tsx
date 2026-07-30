import { createMemo, createSignal, For, Show, type JSX } from 'solid-js'
import { makePersisted } from '@solid-primitives/storage'
import * as v from 'valibot'
import { createDumbGridDndGroup, type DumbGridDndGroupHandle } from './solid'
import { dndSupported } from './dndCore'
import {
  firstFreeCell, packFlow, placeFree, reorder, resolveSpan, rowCount,
  type GridSpan, type LayoutMode, type SpanValue,
} from '../DumbGrid/gridMath'

// Дашборд-сетка на НАТИВНОМ drag-and-drop.
//
// Это отдельный компонент, а не режим `DumbGrid`: у них разные механики жеста и
// разные компромиссы, и мешать их в одном коде — верный способ сломать обе.
// Общая у них только математика раскладки.
//
//   DumbGridDnd — перенос ведёт браузер: зону под указателем определяет он сам
//                 (dragover приходит на контейнер), картинку переноса рисует он,
//                 у краёв скроллит тоже он. Блок объявлен через dataTransfer,
//                 поэтому его понимают и чужие приёмники. Тач НЕ поддерживается:
//                 HTML5 DnD там не реализован.
//
//   DumbGrid    — всё на указательных событиях: работает и пальцем, полный
//                 контроль над картинкой и плавностью, но зону под указателем
//                 считаем мы сами.
//
// Наше в обоих случаях одно и то же: арифметика раскладки, расступание соседей
// трансформом, рамка будущего места, снап ресайза.

/** блок сетки */
export type DumbGridDndItem = {
  id: string
  content: () => JSX.Element
  /** ширина: число колонок либо доля сетки (`'half'`, `'1/3'`, …) */
  w?: SpanValue
  /** высота в строках */
  h?: number
  /** стартовая ячейка в режиме free */
  x?: number
  y?: number
  minW?: SpanValue
  maxW?: SpanValue
  minH?: number
  maxH?: number
  /** ни двигать, ни ресайзить */
  locked?: boolean
  /** показывать кнопку удаления (по умолчанию да, если задан onRemove) */
  removable?: boolean
}

export type DumbGridDndLayout = Array<{ id: string; w: number; h: number; x?: number; y?: number }>

export type DumbGridDndProps = {
  items: Array<DumbGridDndItem>
  /** `flow` (по умолчанию), `dense` или `free` — как в DumbGrid */
  mode?: LayoutMode
  cols?: number
  rowHeight?: number
  gap?: number
  gapX?: number
  gapY?: number
  storageKey?: string
  layout?: DumbGridDndLayout
  onLayout?: (layout: DumbGridDndLayout) => void
  onRemove?: (id: string) => void
  labels?: { remove?: string; resize?: string }
  resizable?: boolean
  /** режим редактирования: `false` — голая сетка без обвязки и обработчиков */
  editable?: boolean
  disabled?: boolean
  animate?: boolean
  showGrid?: boolean | 'drag'
  spareRows?: number
  /** группа сеток — тогда блок можно перетащить в соседнюю сетку группы */
  group?: DumbGridDndGroupHandle
  /** имя этой сетки в группе */
  name?: string
  class?: string
  style?: JSX.CSSProperties
  blockClass?: string
  blockStyle?: JSX.CSSProperties
}

const DEFAULT_COLS = 12
const DEFAULT_ROW_H = 80
const DEFAULT_GAP = 12
const HANDLE = 16
const REMOVE = 22
const GRID_LINE = 'rgba(100,116,139,.28)'

const LayoutSchema = v.array(
  v.object({
    id: v.string(),
    w: v.number(),
    h: v.number(),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
  }),
)

function clampInt(n: number, lo: number, hi: number): number {
  const i = Math.round(n)
  if (!Number.isFinite(i)) return lo
  return Math.max(lo, Math.min(hi, i))
}

function spanOf(
  item: DumbGridDndItem,
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
  if (Number.isFinite(src.x)) out.x = clampInt(src.x as number, 0, Math.max(0, cols - w))
  if (Number.isFinite(src.y)) out.y = Math.max(0, Math.round(src.y as number))
  return out
}

/** Слить сохранённую раскладку с текущим набором блоков (см. DumbGrid.mergeLayout). */
export function mergeDndLayout(
  saved: DumbGridDndLayout | null | undefined,
  items: Array<DumbGridDndItem>,
  cols: number,
  mode: LayoutMode = 'flow',
): DumbGridDndLayout {
  const byId = new Map(items.map((it) => [it.id, it]))
  const out: DumbGridDndLayout = []

  for (const s of saved ?? []) {
    const it = byId.get(s.id)
    if (!it) continue
    out.push(spanOf(it, s, cols))
    byId.delete(s.id)
  }
  for (const it of items) {
    if (!byId.has(it.id)) continue
    const w = resolveSpan(it.w, cols)
    const h = Math.max(1, Math.round(it.h ?? 1) || 1)
    const spot = mode === 'free' && it.x === undefined && it.y === undefined && out.length
      ? firstFreeCell({ placed: placeFree(out, cols), cols, w, h })
      : { x: it.x, y: it.y }
    out.push(spanOf(it, { w, h, x: spot.x, y: spot.y }, cols))
  }
  return out
}

/** Разметка сетки — двумя градиентами на одной подложке (см. DumbGrid). */
export function dndGridLines(args: { cols: number; gapX: number; rowH: number; gapY: number }) {
  const { cols, gapX, rowH, gapY } = args
  const col = `calc((100% - ${(cols - 1) * gapX}px) / ${cols})`
  const stepX = `calc(${col} + ${gapX}px)`
  const lineW = Math.max(1, gapX)
  const lineH = Math.max(1, gapY)

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
    size: `100% 100%, 100% ${stepY}px`,
  }
}

function blockBox(span: { w: number; h: number }, pos?: { col: number; row: number }): JSX.CSSProperties {
  return {
    'grid-column': `${(pos?.col ?? 0) + 1} / span ${span.w}`,
    'grid-row': `${(pos?.row ?? 0) + 1} / span ${span.h}`,
    position: 'relative',
    'z-index': '1',
    'min-width': '0',
    'min-height': '0',
    'box-sizing': 'border-box',
  }
}

export function DumbGridDnd(props: DumbGridDndProps) {
  const mode = (): LayoutMode => props.mode ?? 'flow'
  const cols = () => Math.max(1, Math.floor(props.cols ?? DEFAULT_COLS))
  const rowH = () => props.rowHeight ?? DEFAULT_ROW_H
  const gapX = () => props.gapX ?? props.gap ?? DEFAULT_GAP
  const gapY = () => props.gapY ?? props.gap ?? DEFAULT_GAP
  const editable = () => props.editable !== false

  const persisted = props.storageKey
    ? makePersisted(createSignal<DumbGridDndLayout | null>(null), {
        name: props.storageKey,
        serialize: (l: DumbGridDndLayout | null) => JSON.stringify(l ?? []),
        deserialize: (raw: string) => {
          try {
            const parsed = v.safeParse(LayoutSchema, JSON.parse(raw))
            return parsed.success ? parsed.output : null
          } catch {
            return null
          }
        },
      })
    : null
  const [memory, setMemory] = createSignal<DumbGridDndLayout | null>(null)

  const saved = () => props.layout ?? (persisted ? persisted[0]() : memory())
  const layout = createMemo(() => mergeDndLayout(saved(), props.items, cols(), mode()))
  const commit = (next: DumbGridDndLayout) => {
    if (!props.layout) (persisted ? persisted[1] : setMemory)(next)
    props.onLayout?.(next)
  }

  const placed = createMemo(() => {
    const m = mode()
    return m === 'free' ? placeFree(layout(), cols()) : packFlow(layout(), cols(), m)
  })
  const rows = createMemo(() => rowCount(placed()))
  const itemById = createMemo(() => new Map(props.items.map((it) => [it.id, it])))
  const spanById = createMemo(() => new Map(layout().map((s) => [s.id, s])))
  const posById = createMemo(() => new Map(placed().map((p) => [p.id, p])))

  /** в свободном режиме координаты пишем всем сразу, иначе раскладка прыгнет */
  const materialize = (next: DumbGridDndLayout): DumbGridDndLayout => {
    if (mode() !== 'free') return next
    const pos = new Map(placeFree(next, cols()).map((p) => [p.id, p]))
    return next.map((s) => {
      const p = pos.get(s.id)
      return p ? { ...s, x: p.col, y: p.row } : s
    })
  }

  const zoneOptions = {
    blocks: () => {
      const map = itemById()
      const c = cols()
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
    onReorder: (from: number, to: number) => commit(materialize(reorder(layout(), from, to))),
    onMove: (id: string, x: number, y: number) =>
      commit(materialize(layout().map((s) => (s.id === id ? { ...s, x, y } : s)))),
    onResize: (id: string, w: number, h: number) => {
      const it = itemById().get(id)
      if (!it) return
      commit(materialize(layout().map((s) => (s.id === id ? spanOf(it, { ...s, w, h }, cols()) : s))))
    },
  }

  // одна сетка — это группа из одной зоны: механика жеста везде одна
  const solo = props.group ? null : createDumbGridDndGroup({ animate: props.animate })
  const g = (props.group ?? solo!).grid(props.name ?? 'grid', zoneOptions)

  const spare = () => (editable() ? Math.max(0, props.spareRows ?? (mode() === 'free' ? 2 : 0)) : 0)
  const heightOf = (n: number) => n * rowH() + Math.max(0, n - 1) * gapY()
  const showGrid = () => props.showGrid ?? 'drag'
  const gridVisible = () => showGrid() === true || (showGrid() === 'drag' && !!g.active())
  const lines = () => dndGridLines({ cols: cols(), gapX: gapX(), rowH: rowH(), gapY: gapY() })

  return (
    <div
      ref={g.container}
      class={props.class}
      data-dnd-grid={dndSupported() ? '' : undefined}
      style={{
        display: 'grid',
        'grid-template-columns': `repeat(${cols()}, minmax(0, 1fr))`,
        'grid-auto-rows': `${rowH()}px`,
        'column-gap': `${gapX()}px`,
        'row-gap': `${gapY()}px`,
        position: 'relative',
        'min-height': `${heightOf(rows() + spare())}px`,
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
            'background-image': lines().image,
            'background-size': lines().size,
            'background-origin': 'content-box',
            'background-clip': 'content-box',
            'background-repeat': 'no-repeat, repeat',
            opacity: gridVisible() ? '1' : '0',
            transition: 'opacity .15s ease',
          }}
        />
      </Show>

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
                      ...props.blockStyle,
                    }}
                  >
                    {it.content()}

                    <Show when={props.onRemove && !props.disabled && it.removable !== false}>
                      <button
                        type="button"
                        data-grid-remove
                        data-no-drag
                        draggable={false}
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
