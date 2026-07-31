// Доска из вложенных сеток на том же подходе — аналог вкладки «Вложенные сетки»,
// но без движка кита: только CSS order, нативные события и FLIP.
//
// От канбана отличается ровно одним: место двумерное. Секция — сетка в N
// колонок, поэтому место k раскладывается на колонку и строку:
//
//     left = zone.left + (k % cols) * stepX
//     top  = zone.top  + Math.floor(k / cols) * stepY
//
// Пять чисел на секцию (левый край, верх, два шага, число колонок) — и позиция
// любого места считается арифметикой, сколько бы блоков ни переехало. Состав
// секций на эти пять чисел не влияет: блоки уезжают, места остаются.
//
// Перенос между секциями, как и в канбане, — единственное место, где меняется
// DOM: `order` живёт внутри одного контейнера, у соседнего он свой.
//
// Ресайз секций сделан НЕ на drag-and-drop, а на указательных событиях — та же
// развилка, что в ките. Перенос отвечает на вопрос «куда положить», и его
// хиттест дешевле отдать браузеру; ресайз же тянут покадрово, а `dragover`
// покадровой точности не даёт. Секции лежат в сетке из 12 колонок, ширина
// меряется в колонках, и размер меняется только на смене снапа — то есть
// перекладка случается раз в колонку, а не каждый кадр.
import { createSignal, createEffect, onCleanup, onMount, For, Show } from 'solid-js'
import { Bar, Switch, Check, Pick, Btn, Note } from './_controls'
import type { JSX } from 'solid-js'
import { createFlip, createAutoScroller, type Flip } from '@solid-dumb-kit/shared'

type Block = { id: string; title: string; kind: string }

const ZONES = [
  { id: 'left', title: 'Продажи', cols: 3, subtitle: 'выручка и заказы' },
  { id: 'right', title: 'Склад', cols: 3, subtitle: 'остатки' },
  { id: 'bottom', title: 'Архив', cols: 6 },
] as const

const KINDS = ['график', 'таблица', 'счётчик', 'карта', 'лента']
const BLOCKS: Array<Block> = Array.from({ length: 24 }, (_, i) => ({
  id: `b${i}`,
  title: `Блок ${i + 1}`,
  kind: KINDS[i % KINDS.length],
}))
const HUE = (i: number) => `oklch(0.75 0.12 ${(i * 53) % 360})`

/** сетка секций: 12 колонок, ширина секции измеряется в них */
const COLS_TOTAL = 12
/** шаг сетки блоков по вертикали: высота блока плюс зазор — в нём меряется высота секции */
const ROW_H = 76
/** зазор сетки секций; та же величина стоит в CSS */
const GAP = 14

const START: Record<string, Array<string>> = {
  left: BLOCKS.slice(0, 9).map((b) => b.id),
  right: BLOCKS.slice(9, 15).map((b) => b.id),
  bottom: BLOCKS.slice(15).map((b) => b.id),
}

/**
 * Заголовок секции. Пока это часть примера, но пропсы уже разложены так, как
 * они выглядели бы у компонента кита: обязателен только `title`, всё остальное —
 * по желанию. Он же ручка переноса (`data-panel-handle`) и он же ловит двойной
 * клик, поэтому потребителю достаточно передать содержимое, а не воспроизводить
 * поведение.
 */
export type PanelHeadProps = {
  /** заголовок; если не задан, шапка не рисуется вовсе */
  title?: JSX.Element
  /** приписка мельче под заголовком */
  subtitle?: JSX.Element
  /** счётчик справа от заголовка — обычно число элементов */
  count?: number
  /** свои кнопки в правой части шапки */
  actions?: JSX.Element
  /** показывать ли значок перетаскивания */
  grip?: boolean
  /** двойной клик по шапке */
  onToggle?: () => void
}

function PanelHead(props: PanelHeadProps) {
  return (
    <Show when={props.title}>
      <h4
        class="panel-title"
        data-panel-handle
        onDblClick={() => props.onToggle?.()}
        title="перетащить; двойной клик — во всю ширину и обратно"
      >
        <Show when={props.grip !== false}><span class="grip">⠿</span></Show>
        <span class="head-text">
          {props.title}
          <Show when={props.subtitle}><span class="head-sub">{props.subtitle}</span></Show>
        </span>
        <Show when={props.count !== undefined}>
          <span class="count">{props.count}</span>
        </Show>
        <Show when={props.actions}><span class="head-actions">{props.actions}</span></Show>
      </h4>
    </Show>
  )
}

/** пять чисел на секцию — больше о геометрии знать нечего */
type Geom = { left: number; top: number; stepX: number; stepY: number; cols: number }

export default function OrderBoardExample() {
  const [board, setBoard] = createSignal<Record<string, Array<string>>>(START)
  const [place, setPlace] = createSignal<Record<string, number>>(
    Object.fromEntries(Object.values(START).flatMap((ids) => ids.map((id, i) => [id, i]))),
  )
  const [held, setHeld] = createSignal<string | null>(null)
  // секции сортируются тем же способом: свой `order`, свои места
  const [zonePlace, setZonePlace] = createSignal<Record<string, number>>(
    Object.fromEntries(ZONES.map((z, i) => [z.id, i])),
  )
  const [heldZone, setHeldZone] = createSignal<string | null>(null)
  /** ширина секции в колонках сетки (всего их COLS_TOTAL) */
  const [span, setSpan] = createSignal<Record<string, number>>({ left: 6, right: 6, bottom: 12 })
  /** высота секции в строках сетки блоков; ноль — «по содержимому» */
  const [rows, setRows] = createSignal<Record<string, number>>({ left: 0, right: 0, bottom: 0 })
  const [sizing, setSizing] = createSignal<string | null>(null)
  const [edit, setEdit] = createSignal(true)
  /** ширина, с которой секцию развернули, — чтобы вернуть ту же */
  const wasSpan: Record<string, number> = {}
  const [animate, setAnimate] = createSignal(true)
  /** колонок внутри секции — общее для всех, чтобы было что покрутить */
  const [cols, setCols] = createSignal(3)
  const [log, setLog] = createSignal('тащи блок — или секцию за заголовок')

  const blockEls = new Map<string, HTMLElement>()
  const zoneEls = new Map<string, HTMLElement>()
  const panelEls = new Map<string, HTMLElement>()
  /** высота каждой секции и левый-верхний угол обёртки — из снимка */
  let panelH: Record<string, number> = {}
  let wrapAt = { left: 0, top: 0 }
  let geom: Record<string, Geom> = {}
  let flip: Flip = createFlip(true)
  createEffect(() => { flip = createFlip(animate()) })
  const scroller = createAutoScroller()
  onCleanup(() => scroller.stop())

  const zoneOf = (id: string) => {
    const b = board()
    for (const z of ZONES) if (b[z.id].includes(id)) return z.id
    return ZONES[0].id
  }

  /** экранная позиция места k в секции z */
  const at = (z: string, k: number) => {
    const g = geom[z]
    if (!g) return null
    return {
      left: g.left + (k % g.cols) * g.stepX,
      top: g.top + Math.floor(k / g.cols) * g.stepY,
    }
  }

  /** сколько колонок в секции: у широкой их вдвое больше — она и шире */
  const colsOf = (id: string) => (id === 'bottom' ? cols() * 2 : cols())

  /**
   * Снять геометрию секций: на монтировании, после дропа, на resize — но НИКОГДА
   * посреди жеста. IntersectionObserver вместо `getBoundingClientRect`: bounds
   * считаются off-main-thread, forced layout не случается.
   */
  function measure() {
    const targets = [...blockEls.values(), ...zoneEls.values(), ...panelEls.values(), wrapEl].filter(Boolean) as Array<HTMLElement>
    if (!targets.length || typeof IntersectionObserver !== 'function') return
    const rects = new Map<Element, DOMRectReadOnly>()
    let batches = 0
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) rects.set(e.target, e.boundingClientRect)
      batches++
      if (rects.size < targets.length && batches < 4) return
      io.disconnect()

      const p = place()
      const next: Record<string, Geom> = {}
      for (const z of ZONES) {
        const own = board()[z.id]
          .map((id) => ({ k: p[id], r: blockEls.get(id) ? rects.get(blockEls.get(id)!) : undefined }))
          .filter((x): x is { k: number; r: DOMRectReadOnly } => Boolean(x.r))
          .sort((a, b) => a.k - b.k)
        const zoneRect = zoneEls.get(z.id) ? rects.get(zoneEls.get(z.id)!) : undefined
        if (!own.length) {
          if (zoneRect) next[z.id] = { left: zoneRect.left + 10, top: zoneRect.top + 10, stepX: 96, stepY: 76, cols: colsOf(z.id) }
          continue
        }
        const first = own[0]
        const base = { top: first.r.top }
        // шаг по X — первая пара из одной строки, по Y — первая пара из соседних
        let stepX = first.r.width + 8
        let stepY = first.r.height + 8
        for (const o of own) {
          if (Math.floor(o.k / colsOf(z.id)) === Math.floor(first.k / colsOf(z.id)) && o.k !== first.k) {
            stepX = (o.r.left - first.r.left) / (o.k - first.k)
            break
          }
        }
        for (const o of own) {
          const rows = Math.floor(o.k / colsOf(z.id)) - Math.floor(first.k / colsOf(z.id))
          if (rows > 0) { stepY = (o.r.top - first.r.top) / rows; break }
        }
        next[z.id] = {
          left: first.r.left - (first.k % colsOf(z.id)) * stepX,
          top: base.top - Math.floor(first.k / colsOf(z.id)) * stepY,
          stepX, stepY, cols: colsOf(z.id),
        }
      }
      geom = next

      // секции: запоминаем ВЫСОТЫ и угол обёртки. Позиции не запоминаем —
      // они считаются потоком, потому что секции разной ширины: обмен местами
      // «половина» ↔ «во всю ширину» перекладывает всю сетку, и снятые заранее
      // места после первой же перестановки врут (а FLIP по ним дёргается).
      for (const z of ZONES) {
        const el = panelEls.get(z.id)
        const r = el ? rects.get(el) : undefined
        if (r) panelH[z.id] = r.height
      }
      const wrapRect = wrapEl ? rects.get(wrapEl) : undefined
      if (wrapRect) wrapAt = { left: wrapRect.left, top: wrapRect.top }
    })
    for (const t of targets) io.observe(t)
  }

  onMount(() => {
    measure()
    if (typeof ResizeObserver !== 'function') return
    let first = true
    const ro = new ResizeObserver((entries) => {
      // ширину колонки берём из ResizeObserver — это не forced layout
      for (const e of entries) {
        if (e.target !== wrapEl) continue
        colW = (e.contentRect.width - GAP * (COLS_TOTAL - 1)) / COLS_TOTAL
      }
      if (first) { first = false; return }
      measure()
    })
    ro.observe(wrapEl)
    for (const el of zoneEls.values()) ro.observe(el)
    onCleanup(() => ro.disconnect())
  })

  /** Применить раскладку и доиграть переезды: смещения считаются ДО смены. */
  function apply(nextBoard: Record<string, Array<string>>, nextPlace: Record<string, number>) {
    const prevBoard = board()
    const prevPlace = place()
    // элементы берём ПОСЛЕ применения: при переезде в соседнюю секцию Solid
    // пересоздаёт узел, и анимация на старом ушла бы в никуда
    const back: Array<{ id: string; dx: number; dy: number }> = []

    for (const block of BLOCKS) {
      const was = ZONES.find((z) => prevBoard[z.id].includes(block.id))?.id
      const now = ZONES.find((z) => nextBoard[z.id].includes(block.id))?.id
      if (!was || !now) continue
      if (was === now && prevPlace[block.id] === nextPlace[block.id]) continue
      const a = at(was, prevPlace[block.id])
      const b = at(now, nextPlace[block.id])
      if (!a || !b) continue
      back.push({ id: block.id, dx: a.left - b.left, dy: a.top - b.top })
    }

    setBoard(nextBoard)
    setPlace(nextPlace)
    for (const m of back) {
      const el = blockEls.get(m.id)
      if (el) flip.nudge(el, m.dx, m.dy)
    }
  }

  function moveTo(id: string, z: string, k: number) {
    const b = board()
    const p = place()
    const from = zoneOf(id)

    const seq: Record<string, Array<string>> = {}
    for (const zone of ZONES) seq[zone.id] = b[zone.id].slice().sort((x, y) => p[x] - p[y])
    seq[from] = seq[from].filter((x) => x !== id)
    seq[z].splice(Math.max(0, Math.min(seq[z].length, k)), 0, id)

    const nextBoard: Record<string, Array<string>> = {}
    const nextPlace: Record<string, number> = {}
    for (const zone of ZONES) {
      nextBoard[zone.id] = seq[zone.id].slice()
      seq[zone.id].forEach((x, i) => { nextPlace[x] = i })
    }
    apply(nextBoard, nextPlace)
    setLog(from === z ? `${id}: место ${p[id]} → ${k}` : `${id}: ${from} → ${z}, место ${k}`)
  }

  /**
   * Куда лягут секции при заданном порядке — поток, как `grid-auto-flow: row`.
   * Секция занимает `span` колонок; не влезла в остаток строки — переносится на
   * следующую, а высота строки это максимум высот тех, кто в ней стоит.
   */
  function panelLayout(order: Array<string>): Record<string, { left: number; top: number }> {
    const out: Record<string, { left: number; top: number }> = {}
    const step = colW + GAP
    let used = 0
    let top = 0
    let rowH = 0
    for (const id of order) {
      const w = Math.min(COLS_TOTAL, span()[id])
      if (used + w > COLS_TOTAL && used > 0) {
        top += rowH + GAP
        used = 0
        rowH = 0
      }
      out[id] = { left: wrapAt.left + used * step, top: wrapAt.top + top }
      used += w
      rowH = Math.max(rowH, panelH[id] ?? 0)
    }
    return out
  }

  /** Переставить секцию на место k — та же схема, что у блоков. */
  function moveZone(id: string, k: number) {
    const cur = zonePlace()
    const order = ZONES.map((z) => z.id).sort((a, b) => cur[a] - cur[b])
    const from = order.indexOf(id)
    if (from === k) return
    const wasLayout = panelLayout(order)
    order.splice(k, 0, order.splice(from, 1)[0])
    const nowLayout = panelLayout(order)
    const next: Record<string, number> = {}
    order.forEach((x, i) => { next[x] = i })

    const back: Array<{ id: string; dx: number; dy: number }> = []
    for (const z of ZONES) {
      const a = wasLayout[z.id]
      const b = nowLayout[z.id]
      if (!a || !b || (a.left === b.left && a.top === b.top)) continue
      back.push({ id: z.id, dx: a.left - b.left, dy: a.top - b.top })
    }
    setZonePlace(next)
    for (const m of back) {
      const el = panelEls.get(m.id)
      if (el) flip.nudge(el, m.dx, m.dy)
    }
    setLog(`секция «${ZONES.find((z) => z.id === id)!.title}» → место ${k}`)
  }

  /* ────────── ресайз секций: указательные события, шаг в колонку ────────── */

  /** ширина одной колонки сетки секций; приходит из ResizeObserver, не из замера */
  let colW = 0
  let wrapEl!: HTMLElement

  type Sizing = {
    id: string
    axis: string
    startX: number
    startY: number
    startSpan: number
    startRows: number
  }
  let drag0: Sizing | null = null

  const onGripDown = (ev: PointerEvent) => {
    const grip = (ev.target as HTMLElement | null)?.closest?.('[data-resize]') as HTMLElement | null
    if (!grip) return
    const id = grip.dataset.resize!
    ev.preventDefault()
    grip.setPointerCapture(ev.pointerId)
    // высота «по содержимому» — берём фактическую, чтобы тянуть с того же места
    const startRows = rows()[id] || Math.max(1, Math.ceil(board()[id].length / colsOf(id)))
    drag0 = {
      id,
      axis: grip.dataset.axis ?? 'x',
      startX: ev.clientX, startY: ev.clientY,
      startSpan: span()[id], startRows,
    }
    setSizing(id)
  }

  const onGripMove = (ev: PointerEvent) => {
    const d = drag0
    if (!d || !colW) return
    // считаем в колонках и строках, а не в пикселях: пока снап не сменился,
    // ничего не трогаем — значит и перекладки сетки на каждый кадр не будет
    if (d.axis !== 'y') {
      const next = Math.max(3, Math.min(COLS_TOTAL, d.startSpan + Math.round((ev.clientX - d.startX) / colW)))
      if (next !== span()[d.id]) setSpan({ ...span(), [d.id]: next })
    }
    if (d.axis !== 'x') {
      const next = Math.max(1, d.startRows + Math.round((ev.clientY - d.startY) / ROW_H))
      if (next !== rows()[d.id]) setRows({ ...rows(), [d.id]: next })
    }
    const t = ZONES.find((z) => z.id === d.id)!.title
    setLog(`секция «${t}» — ${span()[d.id]} из ${COLS_TOTAL} колонок, ${rows()[d.id] || '·'} строк`)
  }

  const onGripUp = () => {
    if (!drag0) return
    drag0 = null
    setSizing(null)
    measure()          // ширина изменилась — места блоков внутри другие
  }

  /**
   * Двойной клик по заголовку — секция во всю ширину, повторный — обратно.
   * Соседи при этом переезжают, и это тот же FLIP: считаем поток до и после.
   */
  function toggleWide(id: string) {
    const order = ZONES.map((z) => z.id).sort((a, b) => zonePlace()[a] - zonePlace()[b])
    const wasLayout = panelLayout(order)
    const full = span()[id] >= COLS_TOTAL
    if (!full) wasSpan[id] = span()[id]
    setSpan({ ...span(), [id]: full ? (wasSpan[id] ?? 6) : COLS_TOTAL })
    const nowLayout = panelLayout(order)

    for (const z of ZONES) {
      const a = wasLayout[z.id]
      const b = nowLayout[z.id]
      const el = panelEls.get(z.id)
      if (!a || !b || !el || (a.left === b.left && a.top === b.top)) continue
      flip.nudge(el, a.left - b.left, a.top - b.top)
    }
    setLog(`секция «${ZONES.find((z) => z.id === id)!.title}» — ${full ? 'обратно' : 'во всю ширину'}`)
    measure()
  }

  /** вернуть витрину в исходное состояние — состав, места, размеры */
  const reset = () => {
    setBoard(START)
    setPlace(Object.fromEntries(Object.values(START).flatMap((ids) => ids.map((id, i) => [id, i]))))
    setZonePlace(Object.fromEntries(ZONES.map((z, i) => [z.id, i])))
    setSpan({ left: 6, right: 6, bottom: 12 })
    setRows({ left: 0, right: 0, bottom: 0 })
    setLog('раскладка сброшена')
    measure()
  }

  /* ────────── жест ────────── */

  const blockOf = (ev: Event) => (ev.target as HTMLElement | null)?.closest?.('[data-block]') as HTMLElement | null
  const zoneElOf = (ev: Event) => (ev.target as HTMLElement | null)?.closest?.('[data-zone]') as HTMLElement | null
  let lastX = -1
  let lastY = -1

  /** цель нажатия — отличаем «тащат секцию» от «тащат блок» */
  let pressed: Element | null = null
  const remember = (ev: PointerEvent) => { pressed = ev.target as Element | null }

  /**
   * Синхронный признак «жест идёт». Подсветку источника мы ставим отложенно —
   * иначе полупрозрачность попадёт в картинку переноса, — и если жест успевает
   * закончиться раньше этого тика, отложенный вызов включает её уже ПОСЛЕ
   * уборки. Элемент так и остаётся приглушённым. Флаг это отсекает.
   */
  let gesture: string | null = null

  const onDragStart = (ev: DragEvent) => {
    if (!edit()) { ev.preventDefault(); return }   // режим просмотра: жестов нет
    setHeld(null)          // страховка: прошлый жест мог потерять `dragend`
    setHeldZone(null)

    const panel = (ev.target as HTMLElement | null)?.closest?.('[data-panel]') as HTMLElement | null
    if (panel && !blockOf(ev) && pressed?.closest?.('[data-panel-handle]')) {
      const zid = panel.dataset.panel!
      if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
      ev.dataTransfer?.setData('text/plain', zid)
      lastX = ev.clientX
      lastY = ev.clientY
      scroller.start(panel)
      gesture = zid
    setTimeout(() => { if (gesture === zid) setHeldZone(zid) })
      setLog(`тащим секцию «${ZONES.find((z) => z.id === zid)!.title}»`)
      return
    }

    const el = blockOf(ev)
    const id = el?.dataset.block
    if (!id) { ev.preventDefault(); return }
    ev.dataTransfer?.setData('text/plain', id)
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
    lastX = ev.clientX
    lastY = ev.clientY
    scroller.start(el as HTMLElement)
    gesture = id
    setTimeout(() => { if (gesture === id) setHeld(id) })
    setLog(`тащим ${id}`)
  }

  const onDragOver = (ev: DragEvent) => {
    ev.preventDefault()
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move'
    scroller.move(ev.clientX, ev.clientY)

    const dragZone = heldZone()
    if (dragZone) {
      if (ev.clientX === lastX && ev.clientY === lastY) return
      lastX = ev.clientX
      lastY = ev.clientY
      const overPanel = (ev.target as HTMLElement | null)?.closest?.('[data-panel]') as HTMLElement | null
      const target = overPanel?.dataset.panel
      if (!target || target === dragZone) return
      if (panelEls.get(target)?.getAnimations().length) return
      moveZone(dragZone, zonePlace()[target])
      return
    }

    const id = held()
    if (!id) return
    if (ev.clientX === lastX && ev.clientY === lastY) return   // рука не двигалась
    lastX = ev.clientX
    lastY = ev.clientY

    const overZone = zoneElOf(ev)
    if (!overZone) return
    const z = overZone.dataset.zone!
    const over = blockOf(ev)

    if (over) {
      const target = over.dataset.block!
      if (target === id) return
      if (blockEls.get(target)?.getAnimations().length) return  // цель сама едет
      const k = place()[target]
      if (zoneOf(id) === z && place()[id] === k) return
      moveTo(id, z, k)
      return
    }
    if (zoneOf(id) === z) return
    moveTo(id, z, board()[z].length)
  }

  /** и `dragend`, и `drop`: при переезде узел пересоздаётся, и `dragend` теряется */
  const finish = () => {
    gesture = null
    if (heldZone()) { setHeldZone(null); scroller.stop(); measure(); return }
    if (!held()) return
    setHeld(null)
    scroller.stop()
    measure()
  }

  const byId = (id: string) => BLOCKS.find((b) => b.id === id)!
  const index = (id: string) => BLOCKS.findIndex((b) => b.id === id)

  return (
    <div
      class="ob-example"
      onPointerDown={remember}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={finish}
      onDrop={(ev) => { ev.preventDefault(); finish() }}
    >
      <h3>Вложенные сетки на CSS order + FLIP</h3>
      <p class="note">
        <b>Секции сортируются и меняют размер</b>: за заголовок — перенос, за правый край — ширина,
        за нижний — высота, за угол — сразу оба, <b>двойной клик по заголовку</b> — во всю ширину и
        обратно. Панель сверху — общая с вкладкой <b>DumbGrid</b>:
        она вынесена в отдельный модуль витрины, чтобы не разъезжаться от примера к примеру.
        Ресайз намеренно сделан на указательных событиях, а не на drag-and-drop: перенос отвечает на
        вопрос «куда положить», и хиттест дешевле отдать браузеру, а ресайз тянут покадрово, чего{' '}
        <code>dragover</code> не даёт. Ширина меряется в колонках (их 12), и размер меняется только
        на смене снапа — значит сетка перекладывается раз в колонку, а не каждый кадр. Три секции, в каждой своя сетка блоков. Внутри секции DOM не трогается — двигается только{' '}
        <code>order</code>. Перенос в соседнюю секцию, как и в канбане, — единственный случай, когда
        блок физически переходит в другой список.
      </p>
      <p class="note">
        Место здесь двумерное, и это вся разница с канбаном: <code>k</code> раскладывается на колонку
        и строку, а значит секции хватает <b>пяти чисел</b> — левый край, верх, шаг по X, шаг по Y и
        число колонок. Позиция любого места — арифметика по ним, и состав секций на них не влияет.
      </p>
      <Bar>
        <Switch checked={edit()} onChange={setEdit}>режим правки</Switch>
        <Check checked={animate()} onChange={setAnimate}>анимация</Check>
        <Pick
          label="колонок в секции"
          value={cols()}
          options={[2, 3, 4, 6].map((n) => ({ value: n }))}
          onChange={(v) => { setCols(Number(v)); measure() }}
        />
        <Btn onClick={reset}>Сбросить раскладку</Btn>
        <Note>{log()}</Note>
      </Bar>

      <div
        class="wrap"
        ref={(el) => { wrapEl = el }}
        onPointerDown={onGripDown}
        onPointerMove={onGripMove}
        onPointerUp={onGripUp}
        onPointerCancel={onGripUp}
      >
        <For each={ZONES}>
          {(zone) => (
            <section
              class="panel"
              classList={{ held: heldZone() === zone.id, sizing: sizing() === zone.id }}
              data-panel={zone.id}
              draggable={edit()}
              ref={(el) => panelEls.set(zone.id, el)}
              style={{
                order: String(zonePlace()[zone.id]),
                'grid-column': `span ${span()[zone.id]}`,
              }}
            >
              <PanelHead
                title={zone.title}
                subtitle={'subtitle' in zone ? zone.subtitle : undefined}
                count={board()[zone.id].length}
                onToggle={() => toggleWide(zone.id)}
                actions={
                  <Show when={edit()}>
                    <button
                      class="head-btn"
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => toggleWide(zone.id)}
                    >
                      {span()[zone.id] >= COLS_TOTAL ? '⤡' : '⤢'}
                    </button>
                  </Show>
                }
              />
              <div
                class="zone"
                data-zone={zone.id}
                style={{
                  '--cols': String(colsOf(zone.id)),
                  ...(rows()[zone.id] ? { height: `${rows()[zone.id] * ROW_H + 12}px` } : {}),
                }}
                ref={(el) => zoneEls.set(zone.id, el)}
              >
                <For each={board()[zone.id]}>
                  {(id) => (
                    <article
                      class="block"
                      classList={{ held: held() === id }}
                      data-block={id}
                      draggable={edit()}
                      ref={(el) => blockEls.set(id, el)}
                      style={{ order: String(place()[id]), '--hue': HUE(index(id)) }}
                    >
                      <span class="title">{byId(id).title}</span>
                      <span class="kind">{byId(id).kind}</span>
                    </article>
                  )}
                </For>
              </div>
              {/* ручки ресайза: тянем указателем, размер считается в колонках и строках.
                  В режиме просмотра их нет вовсе — ни ручек, ни слушателей на них */}
              <Show when={edit()}>
                <div class="grip-x" data-resize={zone.id} data-axis="x" title="ширина" />
                <div class="grip-y" data-resize={zone.id} data-axis="y" title="высота" />
                <div class="grip-xy" data-resize={zone.id} data-axis="xy" title="ширина и высота" />
              </Show>
            </section>
          )}
        </For>
      </div>

      <style>{`
        .ob-example { padding: 16px 20px; color: #0f172a }
        .ob-example h3 { margin: 0 0 4px }
        .ob-example .note { margin: 0 0 8px; font-size: 13px; color: #64748b; max-width: 90ch }
        .ob-example .panel-title { cursor: grab }

        .ob-example .wrap { display: grid; gap: 14px; align-items: start;
                            grid-template-columns: repeat(12, 1fr) }
        .ob-example .panel { position: relative; min-width: 0 }
        .ob-example .panel.sizing { outline: 2px solid #6366f1; outline-offset: 4px; border-radius: 12px }
        /* ручка на правом крае — единственное место, где жест идёт на указателе */
        .ob-example .grip-x { position: absolute; top: 26px; right: -9px; bottom: 12px; width: 12px;
                              cursor: col-resize; touch-action: none }
        .ob-example .grip-x::after { content: ''; position: absolute; top: 8px; bottom: 8px;
                                     left: 5px; width: 2px; border-radius: 2px; background: #e2e8f0 }
        .ob-example .grip-y { position: absolute; left: 12px; right: 12px; bottom: -9px; height: 12px;
                              cursor: row-resize; touch-action: none }
        .ob-example .grip-y::after { content: ''; position: absolute; left: 8px; right: 8px;
                                     top: 5px; height: 2px; border-radius: 2px; background: #e2e8f0 }
        .ob-example .grip-xy { position: absolute; right: -9px; bottom: -9px; width: 16px; height: 16px;
                               cursor: nwse-resize; touch-action: none }
        .ob-example .grip-xy::after { content: ''; position: absolute; right: 4px; bottom: 4px;
                                      width: 8px; height: 8px; border-right: 2px solid #cbd5e1;
                                      border-bottom: 2px solid #cbd5e1; border-radius: 0 0 3px 0 }
        .ob-example .grip-x:hover::after, .ob-example .grip-y:hover::after { background: #6366f1 }
        .ob-example .grip-xy:hover::after { border-color: #6366f1 }
        .ob-example .panel-title { display: flex; align-items: center; gap: 6px; margin: 0 0 8px;
                                   font-size: 13px; color: #475569; cursor: grab; user-select: none }
        .ob-example .head-text { display: flex; align-items: baseline; gap: 6px; min-width: 0 }
        .ob-example .head-sub { font-size: 11.5px; font-weight: 400; color: #94a3b8 }
        .ob-example .head-actions { margin-left: auto; display: flex; gap: 4px }
        .ob-example .head-btn { padding: 1px 6px; font: inherit; font-size: 12px; cursor: pointer;
                                color: #94a3b8; border: 1px solid #e2e8f0; border-radius: 6px;
                                background: #fff }
        .ob-example .head-btn:hover { color: #4338ca; border-color: #c7d2fe }
        .ob-example .panel-title:active { cursor: grabbing }
        .ob-example .grip { color: #cbd5e1 }
        .ob-example .panel.held { opacity: .35 }
        .ob-example .count { padding: 1px 7px; border-radius: 999px; font-size: 11px;
                             color: #64748b; background: #e2e8f0 }
        .ob-example .zone { display: grid; gap: 8px; align-content: start; min-height: 88px;
                            padding: 10px; border-radius: 12px; background: #f8fafc;
                            box-shadow: inset 0 0 0 1px #e2e8f0; overflow-y: auto;
                            scrollbar-gutter: stable;
                            grid-template-columns: repeat(var(--cols), 1fr) }
        .ob-example .block { display: flex; flex-direction: column; justify-content: center; gap: 3px;
                             height: 68px; padding: 8px 10px; border-radius: 10px; cursor: grab;
                             background: #fff; box-shadow: 0 1px 2px rgba(15,23,42,.06), inset 0 0 0 1px #e2e8f0;
                             border-top: 4px solid var(--hue) }
        .ob-example .block:active { cursor: grabbing }
        .ob-example .block.held { opacity: .35 }
        .ob-example .title { font-size: 13.5px; font-weight: 500 }
        .ob-example .kind { font-size: 11.5px; color: #94a3b8 }
      `}</style>
    </div>
  )
}
