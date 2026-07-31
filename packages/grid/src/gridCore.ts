// Движок колоночного грида: перетаскивание блоков и ресайз кратно колонкам.
// Ни строчки Solid — только DOM и функции отписки (обёртка живёт в ./solid.ts).
//
// Почему здесь нет снимка позиций, в отличие от sortableCore: размеры блоков
// целые (w колонок × h строк), поэтому позиция каждого считается арифметикой
// (./gridMath.ts). За весь жест мы обращаемся к layout РОВНО дважды, и оба раза
// не по блокам:
//   • ResizeObserver контейнера — ширина контента (приходит сам, без reflow;
//     оттуда же padding: contentRect.left/top);
//   • IntersectionObserver контейнера на старте — его позиция во вьюпорте
//     (boundingClientRect считается off-main-thread, без reflow);
//   • measure(scroller) — та единственная разрешённая китом мерка скроллера,
//     нужная авто-скроллу.
// Дальше в кадре только scrollTop/scrollLeft и запись transform. Число блоков на
// стоимость жеста не влияет вовсе.
//
// Ресайз показывается рамкой-превью: менять width/height самого блока покадрово
// значило бы гонять layout всей сетки каждый кадр. Рамка — один элемент, и её
// размер пишется только когда снап реально сменился (несколько раз за жест),
// а соседи расступаются трансформом, как при драге.

import {
  cellRect, colWidth, fitSpan, insertIndex, moveDeltas, overlaps, packFlow, placeFree, pointToCell, reorder, snapSpan,
  type FreeSpan, type GridSpan, type LayoutMode, type Metrics, type Placed, type SpanLimits,
} from './gridMath'
import { autoScrollSpeed, doScroll, measure, scrollOf, scrollParent, viewOrigin, type ViewGeom } from '@solid-dumb-kit/shared'
import { shouldAnimate } from '@solid-dumb-kit/shared'
import { createPressGate, focusInside, targetIsInteractive, type PressGateOptions } from '@solid-dumb-kit/shared'
import { restoreTextSelection, suppressTextSelection } from '@solid-dumb-kit/shared'

/** блок сетки: размеры в единицах + пределы ресайза (+ позиция в режиме free) */
export type DumbGridBlock = GridSpan & FreeSpan & SpanLimits & {
  /** ни двигать, ни ресайзить (двигаться от соседей всё равно может) */
  locked?: boolean
}

export type DumbGridOptions = PressGateOptions & {
  /** текущий порядок и размеры блоков — источник истины у потребителя */
  blocks: () => Array<DumbGridBlock>
  /** как раскладывать: поток, плотный поток или свободные позиции */
  mode?: () => LayoutMode
  /** число колонок сетки */
  cols: () => number
  /** высота строки, px */
  rowHeight: () => number
  gapX: () => number
  gapY: () => number
  /** жесты запрещены целиком */
  disabled?: () => boolean
  /** ресайз разрешён (драг остаётся) */
  resizable?: () => boolean
  /**
   * Анимировать расступание соседей и приземление. По умолчанию да, но при
   * системном `prefers-reduced-motion: reduce` — нет; явное `true` перебивает.
   */
  animate?: boolean
  /** поток: на дропе переставить блок из fromIndex в toIndex (индексы в blocks()) */
  onReorder: (fromIndex: number, toIndex: number) => void
  /** free: на дропе поставить блок в ячейку (x — колонка, y — строка) */
  onMove?: (id: string, x: number, y: number) => void
  /** на отпускании ручки ресайза: новый размер блока в единицах сетки */
  onResize: (id: string, w: number, h: number) => void
  /**
   * Жест начался/закончился. Движку нельзя знать про сигналы, поэтому
   * реактивность строит обёртка: ./solid.ts пишет отсюда в createSignal.
   */
  onActive?: (state: { id: string; kind: 'move' | 'resize' } | null) => void
}

export type GridEngine = {
  /** ref на контейнер сетки: с него берутся ширина колонки и система координат */
  attachContainer: (el: HTMLElement) => () => void
  /** ref на блок: регистрация + старт драга (ручка = дочка с [data-drag-handle]) */
  attach: (el: HTMLElement, id: string) => () => void
  /** ref на ручку ресайза внутри блока */
  attachResize: (el: HTMLElement, id: string) => () => void
  /** ширина колонки в px по последнему ResizeObserver (0 — ещё не измерено) */
  colWidth: () => number
  /** id блока под жестом и его вид — для подсветки в UI */
  active: () => { id: string; kind: 'move' | 'resize' } | null
  destroy: () => void
}

const SLIDE = 'transform .18s cubic-bezier(.2,.8,.2,1)'
const LIFT_SHADOW = '0 12px 28px -8px rgba(0,0,0,.32)'
const PREVIEW_BG = 'rgba(59,130,246,.10)'
const PREVIEW_LINE = '2px dashed rgba(59,130,246,.85)'
const BLOCKED_BG = 'rgba(239,68,68,.10)'                 // место занято — дроп отклоним
const BLOCKED_LINE = '2px dashed rgba(239,68,68,.85)'
const ACTIVE_Z = 3     // блок под жестом — над спокойными соседями
const PREVIEW_Z = 5    // рамка — НАД самим блоком, иначе при уменьшении её не видно

type Gesture = {
  kind: 'move' | 'resize'
  mode: LayoutMode
  id: string
  pid: number
  el: HTMLElement
  startX: number; startY: number
  lastX: number; lastY: number
  blocks: Array<DumbGridBlock>   // снимок состояния на старте жеста
  base: Array<Placed>            // раскладка на старте
  m: Metrics
  fromIndex: number
  toIndex: number
  span: { w: number; h: number }  // ресайз: текущий снап
  cell: { col: number; row: number }   // free: куда встанет блок
  blocked: boolean                     // free: целевое место занято → дроп отклоняем
  scroller: HTMLElement | null
  geom: ViewGeom
  sx0: number; sy0: number
  win0X: number; win0Y: number
  /** позиция контента сетки во вьюпорте на момент снимка */
  gridLeft: number; gridTop: number
  ready: boolean
  moved: boolean
  raf: number
  touched: Set<HTMLElement>
  preview: HTMLElement | null
}

export function createGridEngine(opts: DumbGridOptions): GridEngine {
  const blockEls = new Map<string, HTMLElement>()
  let container: HTMLElement | null = null
  let ro: ResizeObserver | null = null
  let contentW = 0
  let padLeft = 0
  let padTop = 0
  let gesture: Gesture | null = null
  let activeState: { id: string; kind: 'move' | 'resize' } | null = null

  const setActive = (state: { id: string; kind: 'move' | 'resize' } | null) => {
    activeState = state
    opts.onActive?.(state)
  }

  const metrics = (): Metrics => {
    const cols = Math.max(1, Math.floor(opts.cols()))
    const gapX = opts.gapX()
    return { cols, colW: colWidth(contentW, cols, gapX), rowH: opts.rowHeight(), gapX, gapY: opts.gapY() }
  }

  const modeNow = (): LayoutMode => opts.mode?.() ?? 'flow'

  /** Раскладка по текущему режиму — одна точка, чтобы ветки не разъезжались. */
  const place = (blocks: Array<DumbGridBlock>, mode: LayoutMode, cols: number): Array<Placed> =>
    mode === 'free' ? placeFree(blocks, cols) : packFlow(blocks, cols, mode)

  /**
   * Позиция контента сетки во вьюпорте СЕЙЧАС: снятая на старте, сдвинутая на
   * то, насколько с тех пор прокрутились контейнер и окно. Так покадровый
   * getBoundingClientRect (forced layout) заменяется на чтение scroll-полей.
   * Прокрутку окна учитываем только для внутреннего скроллера — когда скроллер
   * и есть окно, она уже посчитана в первом слагаемом.
   */
  function shift(g: Gesture) {
    const { sx, sy } = scrollOf(g.scroller)
    const dx = sx - g.sx0 + (g.scroller ? window.scrollX - g.win0X : 0)
    const dy = sy - g.sy0 + (g.scroller ? window.scrollY - g.win0Y : 0)
    return { dx, dy, sy }
  }

  /** Позиция контейнера — один IntersectionObserver, без reflow. */
  function snapOrigin(cb: (rect: DOMRectReadOnly | null) => void) {
    const el = container
    if (!el || typeof IntersectionObserver !== 'function') { cb(null); return }
    const io = new IntersectionObserver(entries => {
      io.disconnect()
      cb(entries.length ? entries[0].boundingClientRect : null)
    })
    io.observe(el)
  }

  /* ────────── стили блоков ────────── */

  function slide(g: Gesture, moves: Array<{ id: string; dx: number; dy: number }>) {
    for (const mv of moves) {
      const el = blockEls.get(mv.id)
      if (!el || el === g.el) continue
      if (!mv.dx && !mv.dy) {
        if (g.touched.has(el)) el.style.transform = ''
        continue
      }
      // трогаем стили только тех, кто реально поехал, и transition вешаем
      // первым кадром — иначе это сотня лишних композиторных слоёв на старте
      if (!g.touched.has(el)) {
        g.touched.add(el)
        el.style.willChange = 'transform'
        if (!shouldAnimate(opts.animate)) {
          el.style.transform = `translate(${mv.dx}px,${mv.dy}px)`
          continue
        }
        el.style.transition = SLIDE
        continue
      }
      el.style.transform = `translate(${mv.dx}px,${mv.dy}px)`
    }
  }

  function resetStyles(g: Gesture) {
    const reset = (el: HTMLElement) => {
      el.style.transition = ''
      el.style.transform = ''
      el.style.zIndex = ''
      el.style.willChange = ''
      el.style.boxShadow = ''
      el.style.opacity = ''
      el.style.cursor = ''
    }
    reset(g.el)
    for (const el of g.touched) reset(el)
    g.preview?.remove()
    g.preview = null
  }

  /* ────────── превью: будущее место блока ────────── */

  function showPreview(
    g: Gesture,
    rect: { x: number; y: number; width: number; height: number },
    blocked = false,
  ) {
    if (!container) return
    if (!g.preview) {
      const box = document.createElement('div')
      box.style.cssText = [
        'position:absolute', 'pointer-events:none', 'box-sizing:border-box',
        'border-radius:10px', `z-index:${PREVIEW_Z}`, 'outline-offset:-2px',
        'transition:background .12s ease, outline-color .12s ease',
      ].join(';')
      box.dataset.gridPreview = ''
      container.appendChild(box)
      g.preview = box
    }
    // размер пишется только при смене снапа/ячейки — не покадрово
    g.preview.dataset.blocked = blocked ? '' : undefined as unknown as string
    g.preview.style.background = blocked ? BLOCKED_BG : PREVIEW_BG
    g.preview.style.outline = blocked ? BLOCKED_LINE : PREVIEW_LINE
    g.preview.style.width = `${rect.width}px`
    g.preview.style.height = `${rect.height}px`
    g.preview.style.transform = `translate(${padLeft + rect.x}px,${padTop + rect.y}px)`
  }

  /** Прямоугольник блока в целевой ячейке — превью свободного режима. */
  function previewFree(g: Gesture) {
    const me = g.base.find(p => p.id === g.id)
    if (!me) return
    showPreview(g, cellRect({ ...me, col: g.cell.col, row: g.cell.row, ...g.span }, g.m), g.blocked)
  }

  /* ────────── кадр ────────── */

  function frame() {
    if (!gesture) return
    const g = gesture

    if (g.kind === 'move') {
      // авто-скролл: только после реального движения, иначе захват у края
      // сразу дёргает контейнер
      const s = shift(g)
      if (g.moved) {
        const speed = autoScrollSpeed({
          pointerY: g.lastY,
          // позиция скроллера во вьюпорте сейчас — арифметикой от снятой,
          // а не свежим getBoundingClientRect
          viewTop: g.scroller ? viewOrigin(g.geom, window.scrollX, window.scrollY).top : 0,
          clientH: g.geom.clientH,
          scrollY: s.sy,
          scrollMax: g.geom.max,
        })
        if (speed) doScroll(g.scroller, 0, speed)
      }
      const d = shift(g)
      g.el.style.transform = `translate(${g.lastX - g.startX + d.dx}px,${g.lastY - g.startY + d.dy}px)`

      if (!g.ready) { g.raf = requestAnimationFrame(frame); return }

      if (g.mode === 'free') {
        // свободный режим: прилипаем не к соседям, а к сетке — куда встал
        // ЛЕВЫЙ ВЕРХНИЙ УГОЛ блока, туда он и ляжет, хоть на пустую строку ниже всех
        const me = g.base.find(p => p.id === g.id)
        if (!me) { g.raf = requestAnimationFrame(frame); return }
        const at = cellRect(me, g.m)
        const cell = pointToCell({
          x: at.x + (g.lastX - g.startX + d.dx),
          y: at.y + (g.lastY - g.startY + d.dy),
          w: g.span.w, m: g.m,
        })
        const blocked = overlaps({ placed: g.base, id: g.id, ...cell, ...g.span })
        if (cell.col !== g.cell.col || cell.row !== g.cell.row || blocked !== g.blocked) {
          g.cell = cell
          g.blocked = blocked
          previewFree(g)                 // соседи не двигаются: у каждого своё место
        }
      } else {
        const pX = g.lastX - (g.gridLeft - d.dx)
        const pY = g.lastY - (g.gridTop - d.dy)
        const k = insertIndex({ base: g.base, dragId: g.id, m: g.m, pointerX: pX, pointerY: pY })
        if (k !== g.toIndex) {
          g.toIndex = k
          const next = packFlow(reorder(g.blocks, g.fromIndex, k), g.m.cols, g.mode)
          slide(g, moveDeltas({ base: g.base, next, m: g.m, skipId: g.id }))
        }
      }
    } else if (g.ready) {
      const d = shift(g)
      const dx = g.lastX - g.startX + d.dx
      const dy = g.lastY - g.startY + d.dy
      const limits = g.blocks[g.fromIndex]
      const want = snapSpan({ start: { w: limits.w, h: limits.h }, dx, dy, m: g.m, limits })
      // free: расти можно только в свободное место — толкать соседей тут некому
      const span = g.mode === 'free'
        ? fitSpan({ placed: g.base, id: g.id, ...g.cell, want, limits })
        : want
      if (span.w !== g.span.w || span.h !== g.span.h) {
        g.span = span
        if (g.mode === 'free') {
          previewFree(g)
        } else {
          const resized = g.blocks.map((b, i) => (i === g.fromIndex ? { ...b, ...span } : b))
          const next = packFlow(resized, g.m.cols, g.mode)
          slide(g, moveDeltas({ base: g.base, next, m: g.m, skipId: g.id }))
          const me = next.find(p => p.id === g.id)
          if (me) showPreview(g, cellRect(me, g.m))
        }
      }
    }
    g.raf = requestAnimationFrame(frame)
  }

  function onMove(ev: PointerEvent) {
    if (!gesture || ev.pointerId !== gesture.pid) return
    if (!gesture.moved && (Math.abs(ev.clientX - gesture.startX) > 2 || Math.abs(ev.clientY - gesture.startY) > 2)) {
      gesture.moved = true
    }
    gesture.lastX = ev.clientX
    gesture.lastY = ev.clientY
  }

  function detach() {
    restoreTextSelection()
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
  }

  function cleanup() {
    if (!gesture) return
    const g = gesture
    if (g.raf) cancelAnimationFrame(g.raf)
    detach()
    resetStyles(g)
    gesture = null
    setActive(null)
  }

  /**
   * Приземление: доводим блок до нового места анимацией вместо телепорта.
   * Целевая позиция известна арифметически — мерить нечего.
   */
  function land(g: Gesture, done: () => void) {
    const from = g.base.find(p => p.id === g.id)
    // free: летим в выбранную ячейку, а на занятое место — обратно на своё
    const to = g.mode === 'free'
      ? (from && !g.blocked ? { ...from, col: g.cell.col, row: g.cell.row } : from)
      : place(reorder(g.blocks, g.fromIndex, g.toIndex), g.mode, g.m.cols).find(p => p.id === g.id)
    if (!shouldAnimate(opts.animate) || !from || !to) { done(); return }

    const a = cellRect(from, g.m)
    const b = cellRect(to, g.m)
    const el = g.el
    el.style.transition = SLIDE
    el.style.transform = `translate(${b.x - a.x}px,${b.y - a.y}px)`

    let fired = false
    const finish = () => {
      if (fired) return
      fired = true
      el.removeEventListener('transitionend', finish)
      done()
    }
    el.addEventListener('transitionend', finish)
    setTimeout(finish, 240)   // страховка, если transitionend не придёт
  }

  function onUp(ev: PointerEvent) {
    if (!gesture || ev.pointerId !== gesture.pid) return
    const g = gesture
    const { kind, mode, id, fromIndex, toIndex, span, ready } = g

    if (kind === 'resize') {
      const before = g.blocks[fromIndex]
      cleanup()
      if (ready && before && (span.w !== before.w || span.h !== before.h)) opts.onResize(id, span.w, span.h)
      return
    }

    // Свободный режим: коммитим ячейку, если она не занята. На занятое место
    // блок возвращается — это осознанный отказ, а не «протолкнём соседей»:
    // каскадные сдвиги в свободной раскладке ломают ровно то, зачем её включают.
    if (mode === 'free') {
      const home = g.base.find(p => p.id === id)
      const moved = !!home && (g.cell.col !== home.col || g.cell.row !== home.row)
      if (!ready || g.blocked || !moved) { cleanup(); return }

      detach()
      if (g.raf) cancelAnimationFrame(g.raf)
      gesture = null
      setActive(null)
      land(g, () => {
        resetStyles(g)
        opts.onMove?.(id, g.cell.col, g.cell.row)
      })
      return
    }

    if (!ready || toIndex === fromIndex) { cleanup(); return }

    // слушатели снимаем сразу, стили — после приземления
    detach()
    if (g.raf) cancelAnimationFrame(g.raf)
    gesture = null
    setActive(null)
    land(g, () => {
      resetStyles(g)
      opts.onReorder(fromIndex, toIndex)
    })
  }

  function begin(kind: 'move' | 'resize', id: string, handle: HTMLElement, pid: number, x: number, y: number) {
    const el = blockEls.get(id)
    if (!el || !container) return
    // фокус уже переставлен браузером — самое честное место решить,
    // что блок сейчас редактируют, а не двигают
    if (kind === 'move' && handle === el && focusInside(el)) return

    const blocks = opts.blocks()
    const fromIndex = blocks.findIndex(b => b.id === id)
    if (fromIndex < 0 || blocks[fromIndex].locked) return

    const m = metrics()
    if (!m.colW) return                       // ResizeObserver ещё не отработал

    const mode = modeNow()
    const base = place(blocks, mode, m.cols)
    const home = base.find(p => p.id === id)
    const scroller = scrollParent(el)
    const geom = measure(scroller)
    const s0 = scrollOf(scroller)
    gesture = {
      kind, mode, id, pid, el,
      startX: x, startY: y, lastX: x, lastY: y,
      blocks, base, m,
      fromIndex, toIndex: fromIndex,
      span: { w: blocks[fromIndex].w, h: blocks[fromIndex].h },
      cell: { col: home?.col ?? 0, row: home?.row ?? 0 },
      blocked: false,
      scroller, geom, sx0: s0.sx, sy0: s0.sy, win0X: window.scrollX, win0Y: window.scrollY,
      gridLeft: 0, gridTop: 0,
      ready: false, moved: false, raf: 0,
      touched: new Set(), preview: null,
    }
    setActive({ id, kind })

    el.style.zIndex = `${ACTIVE_Z}`
    el.style.willChange = 'transform'
    el.style.transition = 'box-shadow .15s ease, opacity .15s ease'
    if (kind === 'move') {
      el.style.boxShadow = LIFT_SHADOW
      el.style.opacity = '0.97'
      el.style.cursor = 'grabbing'
    }
    suppressTextSelection()

    snapOrigin(rect => {
      if (!gesture || gesture.id !== id || gesture.pid !== pid) return
      if (rect) {
        // сдвиг с момента снимка компенсируем сами: rect снят асинхронно,
        // за это время контейнер мог проскроллиться
        const d = shift(gesture)
        gesture.gridLeft = rect.left + padLeft + d.dx
        gesture.gridTop = rect.top + padTop + d.dy
      }
      gesture.ready = true
      // рамка нужна сразу: у ресайза — чтобы видеть исходный размер, в свободном
      // режиме — чтобы видеть, куда блок ляжет, ещё до первого шага снапа
      if (gesture.kind === 'resize' || gesture.mode === 'free') previewFree(gesture)
    })

    try { handle.setPointerCapture(pid) } catch { /* noop */ }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    gesture.raf = requestAnimationFrame(frame)
  }

  const gate = createPressGate(opts)

  function canStart(): boolean {
    return !opts.disabled?.() && !gesture && !gate.pending()
  }

  return {
    attachContainer(el: HTMLElement) {
      container = el
      if (typeof ResizeObserver === 'function') {
        // ширина контента приходит сама, без reflow; оттуда же отступы
        // (contentRect.left/top = padding), поэтому padding не надо вычитать
        // отдельным getComputedStyle
        ro = new ResizeObserver(entries => {
          const r = entries[entries.length - 1]?.contentRect
          if (!r) return
          contentW = r.width
          padLeft = r.left
          padTop = r.top
        })
        ro.observe(el)
      }
      return () => {
        ro?.disconnect()
        ro = null
        if (container === el) container = null
      }
    },

    attach(el: HTMLElement, id: string) {
      blockEls.set(id, el)
      el.dataset.gridBlock = id
      const down = (ev: PointerEvent) => {
        if (ev.button !== 0 || !canStart()) return
        if (!(ev.target instanceof Element)) return
        if (ev.target.closest('[data-grid-resize]')) return
        // Внутри блока может жить сортировщик (список, канбан-колонка): его
        // элементы помечены data-flip-id. Жест по такому элементу принадлежит
        // ему, а не сетке — иначе перетаскивание карточки утащило бы весь блок.
        if (ev.target.closest('[data-flip-id]')) return
        // Точно так же блок может содержать ВЛОЖЕННУЮ сетку. Её блоки ближе к
        // указателю, значит жест их: внешняя сетка вмешивается, только если
        // ближайший блок — она сама.
        const nested = ev.target.closest('[data-grid-block]')
        if (nested && nested !== el) return
        const handle = el.querySelector('[data-drag-handle]') as HTMLElement | null
        if (handle) {
          if (!(ev.target instanceof Node && handle.contains(ev.target))) return
        } else if (targetIsInteractive(ev)) {
          return                              // это поле/кнопка — пусть работает как обычно
        }
        gate.arm(ev, (x, y) => begin('move', id, handle || el, ev.pointerId, x, y))
      }
      el.addEventListener('pointerdown', down)
      const handle = el.querySelector('[data-drag-handle]') as HTMLElement | null
      if (handle) handle.style.touchAction = 'none'
      return () => {
        el.removeEventListener('pointerdown', down)
        delete el.dataset.gridBlock
        if (blockEls.get(id) === el) blockEls.delete(id)
      }
    },

    attachResize(el: HTMLElement, id: string) {
      el.dataset.gridResize = ''
      el.style.touchAction = 'none'
      const down = (ev: PointerEvent) => {
        if (ev.button !== 0 || !canStart() || opts.resizable?.() === false) return
        ev.stopPropagation()
        // ресайз стартует сразу: ручка маленькая и попасть в неё случайно нельзя
        ev.preventDefault()
        begin('resize', id, el, ev.pointerId, ev.clientX, ev.clientY)
      }
      el.addEventListener('pointerdown', down)
      return () => el.removeEventListener('pointerdown', down)
    },

    colWidth: () => metrics().colW,
    active: () => activeState,

    destroy() {
      gate.cancel()
      cleanup()
      ro?.disconnect()
      ro = null
      container = null
      blockEls.clear()
    },
  }
}
