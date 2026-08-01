// Доска: секции с блоками. Блоки переставляются внутри секции и переносятся
// между секциями, сами секции переставляются и меняют размер.
//
// Три вещи, из которых складывается вся механика:
//
// 1. ВНУТРИ секции DOM не трогается — двигается только CSS `order`. Порядок
//    блоков в разметке всегда исходный, а браузер раскладывает по `order`.
// 2. Перенос в соседнюю секцию без перестановки DOM невозможен: `order` живёт
//    внутри одного контейнера. Это единственное место, где DOM меняется.
// 3. Оба случая доигрывает FLIP, и ему всё равно, что именно произошло, — он
//    знает только «стартуй отсюда, приезжай в ноль».
//
// Жест блоков и секций — нативный drag-and-drop: зону под курсором определяет
// браузер. Ресайз — НАПРОТИВ, указательные события: перенос отвечает на вопрос
// «куда положить», а ресайз тянут покадрово, чего `dragover` не даёт.
//
// Тач для переноса не поддерживается (HTML5 DnD там не существует); ресайз на
// указателе работает и пальцем.

import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount, type JSX } from 'solid-js'
import { createAutoScroller, createFlip, injectStyle, shouldAnimate, type Flip } from '@solid-dumb-kit/shared'
import { moveAt, panelFlow, rowsFor, slotAt, type PanelBox, type Slot, type ZoneGeom } from './boardMath'

export type BoardSection = {
  id: string
  /** заголовок; он же ручка переноса секции. Не задан — шапки нет вовсе */
  title?: JSX.Element
  /** приписка мельче под заголовком */
  subtitle?: JSX.Element
  /** колонок ВНУТРИ секции (сетка блоков); по умолчанию 3 */
  cols?: number
  /** ширина секции в колонках доски; по умолчанию половина */
  span?: number
  /** высота в строках сетки блоков; не задана — по содержимому */
  rows?: number
  /** пускать ли сюда блоки из секции `from`; по умолчанию пускать всех */
  accepts?: (from: string) => boolean
}

export type DumbBoardProps<T> = {
  sections: Array<BoardSection>
  /** порядок в массиве = порядок на экране */
  items: Array<T>
  /** стабильный id блока */
  id: (item: T) => string
  /** в какой секции блок */
  section: (item: T) => string
  /** блок переехал: в секцию `toSection`, на место `toIndex` среди её блоков */
  onMove?: (item: T, toSection: string, toIndex: number) => void
  /** секцию перетащили за заголовок */
  onSectionMove?: (fromIndex: number, toIndex: number) => void
  /** секции сменили размер: колонок доски и строк сетки блоков */
  onSectionResize?: (id: string, size: { span: number; rows: number }) => void

  /** колонок у самой доски; по умолчанию 12 */
  cols?: number
  /** зазор сетки, px; по умолчанию 14 */
  gap?: number
  /** шаг строки внутри секции, px — им меряется высота при ресайзе; по умолчанию 76 */
  rowHeight?: number
  /** минимальная ширина секции в колонках; по умолчанию 3 */
  minSpan?: number

  /** правка: без неё нет ни жестов, ни ручек, ни единого слушателя на блоках */
  editable?: boolean
  /** анимировать; по умолчанию да, но не при prefers-reduced-motion */
  animate?: boolean
  /** разрешить ресайз секций; по умолчанию да */
  resizable?: boolean

  /** свои кнопки в правой части шапки секции */
  sectionActions?: (section: BoardSection) => JSX.Element
  class?: string
  style?: JSX.CSSProperties
  /** ВЕРНИ один корневой элемент — компонент привяжется прямо к нему */
  children: (item: T, section: BoardSection) => JSX.Element
}

/**
 * Структурные стили — сетка, позиции ручек, приглушение источника. Кладутся в
 * `<head>` один раз на документ: внутри дерева они исчезли бы вместе с первым
 * размонтированным экземпляром. Всё остальное оформление твоё.
 */
const CSS = `
          .dumb-board { display: grid; align-items: start; gap: var(--dumb-board-gap);
                        grid-template-columns: repeat(var(--dumb-board-cols), 1fr) }
          .dumb-board-panel { position: relative; min-width: 0 }
          .dumb-board-panel.held { opacity: .35 }
          .dumb-board-head { display: flex; align-items: center; gap: 6px; margin: 0 0 8px;
                             font: inherit; font-size: 13px; cursor: grab; user-select: none }
          .dumb-board-head:active { cursor: grabbing }
          .dumb-board-grip { color: #cbd5e1 }
          .dumb-board-title { display: flex; align-items: baseline; gap: 6px; min-width: 0 }
          .dumb-board-sub { font-size: 11.5px; font-weight: 400; opacity: .65 }
          .dumb-board-count { padding: 1px 7px; border-radius: 999px; font-size: 11px;
                              background: rgb(0 0 0 / .06) }
          .dumb-board-actions { margin-left: auto; display: flex; gap: 4px }
          /* сетка блоков: сюда и смотрит order */
          .dumb-board-zone { display: grid; gap: 8px; align-content: start; min-height: 88px;
                             overflow-y: auto; scrollbar-gutter: stable;
                             grid-template-columns: repeat(var(--dumb-board-inner), 1fr) }
          .dumb-board-block.held { opacity: .35 }
          .dumb-board-grip-x { position: absolute; top: 26px; right: -9px; bottom: 12px; width: 12px;
                               cursor: col-resize; touch-action: none }
          .dumb-board-grip-y { position: absolute; left: 12px; right: 12px; bottom: -9px; height: 12px;
                               cursor: row-resize; touch-action: none }
          .dumb-board-grip-xy { position: absolute; right: -9px; bottom: -9px; width: 16px; height: 16px;
                                cursor: nwse-resize; touch-action: none }
        `

export function DumbBoard<T>(props: DumbBoardProps<T>) {
  injectStyle('board', CSS)

  const cols = () => props.cols ?? 12
  const gap = () => props.gap ?? 14
  const rowH = () => props.rowHeight ?? 76
  const minSpan = () => props.minSpan ?? 3
  const editable = () => props.editable !== false
  const resizable = () => props.resizable !== false

  const spanOf = (s: BoardSection) => Math.max(1, Math.min(cols(), s.span ?? Math.floor(cols() / 2)))
  const colsIn = (s: BoardSection) => Math.max(1, s.cols ?? 3)
  const sectionById = (id: string) => props.sections.find((s) => s.id === id)!
  /**
   * Порядок РЕНДЕРА, а не показа. `<For>` по нему не пересоздаёт узлы при
   * перестановке — сортировка по id не зависит от того, как секции показаны, —
   * а порядок на экране задаёт CSS `order`. Тот же приём, что у блоков внутри
   * секции: DOM не трогается вовсе, двигает браузер.
   *
   * Итерируем СТРОКИ, а не объекты: `<For>` сравнивает по значению, и пересоздание
   * не случится, даже если потребитель отдаст новые объекты секций (а он отдаст —
   * на каждом ресайзе).
   */
  const renderOrder = () => props.sections.map((s) => s.id).sort()
  const showOrder = (id: string) => props.sections.findIndex((s) => s.id === id)

  /** блоки секции в их ПОКАЗНОМ порядке — он же порядок в `items` */
  const itemsOf = (id: string) => props.items.filter((it) => props.section(it) === id)

  /**
   * Блоки секции в порядке РЕНДЕРА — по id, а не по показу.
   *
   * Это половина всего смысла компонента. Если рендерить в показном порядке,
   * `<For>` при каждой перестановке двигает узлы, и обещание «внутри секции DOM
   * не трогается» превращается в неправду: браузер перекладывает дерево, FLIP
   * анимирует пустоту, а соседи стоят на месте. Сортировка по id от показа не
   * зависит, поэтому `<For>` не делает ничего, а порядок задаёт CSS `order`.
   */
  const renderItemsOf = (id: string) =>
    itemsOf(id).slice().sort((a, b) => (props.id(a) < props.id(b) ? -1 : 1))
  /**
   * Место каждого блока среди блоков своей секции — одной картой на всю доску.
   * Считать его поиском по массиву на каждый блок значит получить квадрат:
   * двести блоков — сорок тысяч сравнений на перерисовку.
   */
  const places = createMemo(() => {
    const out = new Map<string, number>()
    const seen = new Map<string, number>()
    for (const it of props.items) {
      const z = props.section(it)
      const k = seen.get(z) ?? 0
      out.set(props.id(it), k)
      seen.set(z, k + 1)
    }
    return out
  })
  const placeOf = (item: T) => places().get(props.id(item)) ?? 0

  const [held, setHeld] = createSignal<string | null>(null)
  const [heldSection, setHeldSection] = createSignal<string | null>(null)
  const [sizing, setSizing] = createSignal<string | null>(null)

  const blockEls = new Map<string, HTMLElement>()
  const zoneEls = new Map<string, HTMLElement>()
  const panelEls = new Map<string, HTMLElement>()
  let wrapEl!: HTMLElement

  /** геометрия секций — снимается разом, НЕ во время жеста */
  let geom: Record<string, ZoneGeom> = {}
  let panelH: Record<string, number> = {}
  let wrapAt: Slot = { left: 0, top: 0 }
  /** ширина колонки доски: приходит из ResizeObserver, а не из замера */
  let colW = 0

  let flip: Flip = createFlip(true)
  createEffect(() => { flip = createFlip(shouldAnimate(props.animate)) })
  const scroller = createAutoScroller()
  onCleanup(() => scroller.stop())

  /**
   * Снять геометрию: на монтировании, после дропа, на resize — но НИКОГДА
   * посреди жеста. `IntersectionObserver`, а не `getBoundingClientRect`: bounds
   * считаются off-main-thread, forced layout не случается даже на сотне блоков.
   */
  function measure() {
    const targets = [...blockEls.values(), ...zoneEls.values(), ...panelEls.values(), wrapEl].filter(Boolean)
    if (!targets.length || typeof IntersectionObserver !== 'function') return

    const rects = new Map<Element, DOMRectReadOnly>()
    let batches = 0
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) rects.set(e.target, e.boundingClientRect)
      batches++
      // наблюдатель не обязан прислать всё одним батчем — ждём каждую цель, но
      // не бесконечно: молчащая (display:none) не должна вешать доску
      if (rects.size < targets.length && batches < 4) return
      io.disconnect()

      const next: Record<string, ZoneGeom> = {}
      for (const s of props.sections) {
        const n = colsIn(s)
        const own = itemsOf(s.id)
          .map((it, k) => ({ k, r: rects.get(blockEls.get(props.id(it))!) }))
          .filter((x): x is { k: number; r: DOMRectReadOnly } => Boolean(x.r))
        const zoneRect = rects.get(zoneEls.get(s.id)!)

        if (!own.length) {
          if (zoneRect) next[s.id] = { left: zoneRect.left + 10, top: zoneRect.top + 10, stepX: 96, stepY: rowH(), cols: n }
          continue
        }
        const a = own[0]
        // шаг по X — первая пара из одной строки, по Y — из соседних
        let stepX = a.r.width + 8
        let stepY = a.r.height + 8
        for (const o of own) {
          if (Math.floor(o.k / n) === Math.floor(a.k / n) && o.k !== a.k) { stepX = (o.r.left - a.r.left) / (o.k - a.k); break }
        }
        for (const o of own) {
          const dr = Math.floor(o.k / n) - Math.floor(a.k / n)
          if (dr > 0) { stepY = (o.r.top - a.r.top) / dr; break }
        }
        next[s.id] = {
          left: a.r.left - (a.k % n) * stepX,
          top: a.r.top - Math.floor(a.k / n) * stepY,
          stepX, stepY, cols: n,
        }
      }
      geom = next

      // у секций запоминаем только ВЫСОТЫ: позиции считает `panelFlow`, потому
      // что секции разной ширины и перестановка перекладывает всю сетку
      for (const s of props.sections) {
        const r = rects.get(panelEls.get(s.id)!)
        if (r) panelH[s.id] = r.height
      }
      const wr = rects.get(wrapEl)
      if (wr) wrapAt = { left: wr.left, top: wr.top }
    })
    for (const t of targets) io.observe(t)
  }

  onMount(() => {
    measure()
    if (typeof ResizeObserver !== 'function') return
    let firstCall = true
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        if (e.target !== wrapEl) continue
        // ширина колонки — из ResizeObserver, это не forced layout
        colW = (e.contentRect.width - gap() * (cols() - 1)) / cols()
      }
      if (firstCall) { firstCall = false; return }
      measure()
    })
    ro.observe(wrapEl)
    onCleanup(() => ro.disconnect())
  })

  /* ────────── перенос блоков ────────── */

  /** снимок «кто где» до изменения — по нему считаются смещения FLIP */
  const snapshotPlaces = () => {
    const out = new Map<string, { zone: string; k: number }>()
    for (const s of props.sections) itemsOf(s.id).forEach((it, k) => out.set(props.id(it), { zone: s.id, k }))
    return out
  }

  /** доиграть переезды: элементы берём ПОСЛЕ смены — при переносе Solid их пересоздаёт */
  const playBlocks = (was: Map<string, { zone: string; k: number }>) => {
    for (const s of props.sections) {
      itemsOf(s.id).forEach((it, k) => {
        const id = props.id(it)
        const prev = was.get(id)
        if (!prev || (prev.zone === s.id && prev.k === k)) return
        const from = slotAt(geom[prev.zone], prev.k)
        const to = slotAt(geom[s.id], k)
        const el = blockEls.get(id)
        if (from && to && el) flip.nudge(el, from.left - to.left, from.top - to.top)
      })
    }
  }

  function moveBlock(item: T, toSection: string, toIndex: number) {
    const was = snapshotPlaces()
    props.onMove?.(item, toSection, toIndex)
    playBlocks(was)
  }

  /* ────────── перестановка секций ────────── */

  const panelBoxes = (order: Array<BoardSection>): Array<PanelBox> =>
    order.map((s) => ({ id: s.id, span: spanOf(s), height: panelH[s.id] ?? 0 }))

  const flowOpts = () => ({ cols: cols(), colW, gap: gap(), origin: wrapAt })

  /** переложить секции и доиграть: раскладка считается потоком до и после */
  const playSections = (order: Array<BoardSection>, apply: () => void) => {
    const was = panelFlow(panelBoxes(props.sections), flowOpts())
    apply()
    const now = panelFlow(panelBoxes(order), flowOpts())
    for (const s of order) {
      const a = was[s.id]
      const b = now[s.id]
      const el = panelEls.get(s.id)
      if (!a || !b || !el || (a.left === b.left && a.top === b.top)) continue
      flip.nudge(el, a.left - b.left, a.top - b.top)
    }
  }

  function moveSection(id: string, toIndex: number) {
    const from = props.sections.findIndex((s) => s.id === id)
    if (from < 0 || from === toIndex) return
    const order = moveAt(props.sections, from, toIndex)
    playSections(order, () => props.onSectionMove?.(from, toIndex))
  }

  /** ширина, с которой секцию развернули, — чтобы вернуть ту же */
  const wasSpan: Record<string, number> = {}

  /** двойной клик по шапке: во всю ширину и обратно */
  function toggleWide(s: BoardSection) {
    const full = spanOf(s) >= cols()
    if (!full) wasSpan[s.id] = spanOf(s)
    const span = full ? (wasSpan[s.id] ?? Math.floor(cols() / 2)) : cols()
    const order = props.sections.map((x) => (x.id === s.id ? { ...x, span } : x))
    playSections(order, () => props.onSectionResize?.(s.id, { span, rows: s.rows ?? 0 }))
    measure()
  }

  /* ────────── ресайз секций: указательные события, шаг в единицу сетки ────────── */

  type Sizing = { id: string; axis: string; x: number; y: number; span: number; rows: number }
  let sizingFrom: Sizing | null = null

  const onGripDown = (ev: PointerEvent) => {
    const grip = (ev.target as HTMLElement | null)?.closest?.('[data-board-resize]') as HTMLElement | null
    if (!grip || !editable() || !resizable()) return
    const s = sectionById(grip.dataset.boardResize!)
    if (!s) return
    ev.preventDefault()
    grip.setPointerCapture(ev.pointerId)
    sizingFrom = {
      id: s.id, axis: grip.dataset.axis ?? 'x',
      x: ev.clientX, y: ev.clientY,
      span: spanOf(s),
      // высота «по содержимому» — берём фактическую, чтобы тянуть с того же места
      rows: s.rows || rowsFor(itemsOf(s.id).length, colsIn(s)),
    }
    setSizing(s.id)
  }

  const onGripMove = (ev: PointerEvent) => {
    const d = sizingFrom
    if (!d || !colW) return
    const s = sectionById(d.id)
    if (!s) return
    // считаем в колонках и строках, а не в пикселях: пока снап не сменился,
    // ничего не трогаем — значит и перекладки сетки на каждый кадр не будет
    let span = spanOf(s)
    let rows = s.rows ?? d.rows
    if (d.axis !== 'y') span = Math.max(minSpan(), Math.min(cols(), d.span + Math.round((ev.clientX - d.x) / colW)))
    if (d.axis !== 'x') rows = Math.max(1, d.rows + Math.round((ev.clientY - d.y) / rowH()))
    if (span === spanOf(s) && rows === (s.rows ?? d.rows)) return
    props.onSectionResize?.(d.id, { span, rows })
  }

  const onGripUp = () => {
    if (!sizingFrom) return
    sizingFrom = null
    setSizing(null)
    measure()          // размер изменился — места блоков внутри другие
  }

  /* ────────── жест: делегированные слушатели на всей доске ────────── */

  const closestOf = (ev: Event, sel: string) =>
    (ev.target as HTMLElement | null)?.closest?.(sel) as HTMLElement | null

  /** цель нажатия — по ней отличаем «тащат секцию» от «тащат блок» */
  let pressed: Element | null = null
  /** синхронный признак жеста: отложенная подсветка иначе включится после уборки */
  let gesture: string | null = null
  let lastX = -1
  let lastY = -1

  const onDragStart = (ev: DragEvent) => {
    if (!editable()) { ev.preventDefault(); return }
    setHeld(null)
    setHeldSection(null)

    const panel = closestOf(ev, '[data-board-section]')
    const block = closestOf(ev, '[data-board-block]')

    // секцию тащат только за заголовок, иначе за неё цеплялось бы пустое поле
    if (panel && !block && pressed?.closest?.('[data-board-handle]')) {
      const id = panel.dataset.boardSection!
      ev.dataTransfer?.setData('text/plain', id)
      if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
      lastX = ev.clientX
      lastY = ev.clientY
      gesture = id
      scroller.start(panel)
      setTimeout(() => { if (gesture === id) setHeldSection(id) })
      return
    }

    const id = block?.dataset.boardBlock
    if (!id) { ev.preventDefault(); return }
    ev.dataTransfer?.setData('text/plain', id)   // без него жест не начнётся в Firefox
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
    lastX = ev.clientX
    lastY = ev.clientY
    gesture = id
    scroller.start(block!)
    setTimeout(() => { if (gesture === id) setHeld(id) })
  }

  const onDragOver = (ev: DragEvent) => {
    ev.preventDefault()                          // без этого не будет `drop`
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move'
    scroller.move(ev.clientX, ev.clientY)

    // Курсор обязан реально сдвинуться. Пока блоки едут, браузер шлёт `dragover`
    // и при неподвижной мыши, а хиттест идёт по ВИДИМОЙ картинке — под курсор
    // подъезжает то одно, то другое, и порядок дёргается сам.
    if (ev.clientX === lastX && ev.clientY === lastY) return
    lastX = ev.clientX
    lastY = ev.clientY

    const movingSection = heldSection()
    if (movingSection) {
      const overId = closestOf(ev, '[data-board-section]')?.dataset.boardSection
      if (!overId || overId === movingSection) return
      if (panelEls.get(overId)?.getAnimations().length) return   // цель сама едет
      moveSection(movingSection, props.sections.findIndex((s) => s.id === overId))
      return
    }

    const id = held()
    if (!id) return
    const item = props.items.find((x) => props.id(x) === id)
    if (!item) return
    const zoneId = closestOf(ev, '[data-board-zone]')?.dataset.boardZone
    const zone = zoneId ? sectionById(zoneId) : null
    if (!zone) return
    const from = props.section(item)
    if (zone.accepts && from !== zone.id && !zone.accepts(from)) return

    const over = closestOf(ev, '[data-board-block]')?.dataset.boardBlock
    if (over) {
      if (over === id) return
      if (blockEls.get(over)?.getAnimations().length) return
      const target = props.items.find((x) => props.id(x) === over)
      if (!target) return
      const k = placeOf(target)
      if (from === zone.id && placeOf(item) === k) return
      moveBlock(item, zone.id, k)
      return
    }
    // мимо блоков, но внутри секции — значит в конец
    const last = itemsOf(zone.id).filter((x) => props.id(x) !== id).length
    if (from === zone.id && placeOf(item) === last) return
    moveBlock(item, zone.id, last)
  }

  const finish = () => {
    gesture = null
    if (!held() && !heldSection()) return
    setHeld(null)
    setHeldSection(null)
    scroller.stop()
    measure()          // состав секций изменился — геометрия другая
  }

  return (
    <div
      class={props.class}
      style={props.style}
      onPointerDown={(ev) => { pressed = ev.target as Element | null; onGripDown(ev) }}
      onPointerMove={onGripMove}
      onPointerUp={onGripUp}
      onPointerCancel={onGripUp}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={finish}
      onDrop={(ev) => { ev.preventDefault(); finish() }}
    >
      <div
        class="dumb-board"
        ref={(el) => { wrapEl = el }}
        style={{ '--dumb-board-cols': String(cols()), '--dumb-board-gap': `${gap()}px` }}
      >
        <For each={renderOrder()}>
          {(sid) => {
            const s = () => sectionById(sid)
            return (
            <section
              class="dumb-board-panel"
              classList={{ held: heldSection() === sid, sizing: sizing() === sid }}
              data-board-section={sid}
              draggable={editable()}
              ref={(el) => panelEls.set(sid, el)}
              style={{ 'grid-column': `span ${spanOf(s())}`, order: String(showOrder(sid)) }}
            >
              <Show when={s().title}>
                <h4
                  class="dumb-board-head"
                  data-board-handle
                  onDblClick={() => editable() && toggleWide(s())}
                >
                  <Show when={editable()}><span class="dumb-board-grip">⠿</span></Show>
                  <span class="dumb-board-title">
                    {s().title}
                    <Show when={s().subtitle}><span class="dumb-board-sub">{s().subtitle}</span></Show>
                  </span>
                  <span class="dumb-board-count">{itemsOf(sid).length}</span>
                  <Show when={props.sectionActions}>
                    <span class="dumb-board-actions">{props.sectionActions!(s())}</span>
                  </Show>
                </h4>
              </Show>

              <div
                class="dumb-board-zone"
                data-board-zone={sid}
                ref={(el) => zoneEls.set(sid, el)}
                style={{
                  '--dumb-board-inner': String(colsIn(s())),
                  ...(s().rows ? { height: `${s().rows! * rowH() + 12}px` } : {}),
                }}
              >
                {/* Итерируем сами элементы, а не их id: иначе содержимое пришлось
                    бы искать в `props.items` прямо в разметке, и оно зависело бы от
                    всего массива — любая правка пересоздавала бы ВСЕ блоки. */}
                <For each={renderItemsOf(sid)}>
                  {(item) => (
                    <div
                      class="dumb-board-block"
                      classList={{ held: held() === props.id(item) }}
                      data-board-block={props.id(item)}
                      draggable={editable()}
                      ref={(el) => blockEls.set(props.id(item), el)}
                      style={{ order: String(placeOf(item)) }}
                    >
                      {props.children(item, s())}
                    </div>
                  )}
                </For>
              </div>

              <Show when={editable() && resizable()}>
                <div class="dumb-board-grip-x" data-board-resize={sid} data-axis="x" />
                <div class="dumb-board-grip-y" data-board-resize={sid} data-axis="y" />
                <div class="dumb-board-grip-xy" data-board-resize={sid} data-axis="xy" />
              </Show>
            </section>
          )}}
        </For>
      </div>

    </div>
  )
}
