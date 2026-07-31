// Группа сеток: блок перетаскивается ИЗ ОДНОЙ сетки В ДРУГУЮ.
//
// Это для сеток то же, чем sortableGroup является для списков, и устроено так
// же: один жест на всю группу, снимок всех контейнеров одним IntersectionObserver
// (без reflow), зона под указателем — по кэшированным прямоугольникам, а за
// курсором летит клон в top layer. Клон здесь не украшение: секции обычно
// скроллятся, и блок, вынесенный за их край, обрезался бы overflow.
//
// Одиночный движок (./gridCore) переиспользовать не вышло бы: там весь жест
// живёт в координатах ОДНОГО контейнера, а тут их несколько, с разными cols,
// шагом строки и режимом. Общее у них — математика (./gridMath), она и общая.
//
// Внутри своей сетки поведение прежнее: потоковые режимы расступаются, free
// прилипает к ячейке. В чужой соседи не двигаются — там показывается рамка
// будущего места: расталкивать чужую раскладку до дропа значит врать о том,
// куда блок встанет, если его увести обратно.

import {
  cellRect, colWidth, fitSpan, insertIndex, moveDeltas, overlaps, packFlow, placeFree, pointToCell,
  reorder, snapSpan, type LayoutMode, type Metrics, type Placed,
} from './gridMath'
import type { DumbGridBlock } from './gridCore'
import { measure, scrollOf, scrollParent, viewOrigin, type ViewGeom } from '@solid-dumb-kit/shared'
import { shouldAnimate } from '@solid-dumb-kit/shared'
import { createPressGate, focusInside, targetIsInteractive, type PressGateOptions } from '@solid-dumb-kit/shared'
import { restoreTextSelection, suppressTextSelection } from '@solid-dumb-kit/shared'

/** куда блок уехал: сетка, индекс в потоке и ячейка для свободного режима */
export type GridTransferTarget = { grid: string; index: number; x: number; y: number }
export type GridTransferSource = { grid: string; id: string; index: number }

export type GridGroupOptions = PressGateOptions & {
  animate?: boolean
  /** блок переехал в ДРУГУЮ сетку — обе раскладки правит потребитель */
  onTransfer?: (from: GridTransferSource, to: GridTransferTarget) => void
  /** идёт жест: имя сетки, блок и вид — для подсветки */
  onActive?: (state: { grid: string; id: string; kind: 'move' | 'resize' } | null) => void
  /** над какой сеткой сейчас указатель (null — ни над какой) */
  onOver?: (grid: string | null) => void
}

/** сетка внутри группы: те же опции, что у одиночной, плюс приём чужих блоков */
export type GridZoneOptions = {
  blocks: () => Array<DumbGridBlock>
  mode?: () => LayoutMode
  cols: () => number
  rowHeight: () => number
  gapX: () => number
  gapY: () => number
  disabled?: () => boolean
  resizable?: () => boolean
  /** пускать ли к себе блок из сетки `from` (по умолчанию да) */
  accepts?: (from: string) => boolean
  /** перестановка внутри этой сетки (потоковые режимы) */
  onReorder?: (from: number, to: number) => void
  /** перемещение внутри этой сетки (режим free) */
  onMove?: (id: string, x: number, y: number) => void
  /** ресайз внутри этой сетки */
  onResize?: (id: string, w: number, h: number) => void
}

export type GridZoneEngine = {
  attachContainer: (el: HTMLElement) => () => void
  attach: (el: HTMLElement, id: string) => () => void
  attachResize: (el: HTMLElement, id: string) => () => void
}

export type GridGroupEngine = {
  grid: (name: string, opts: GridZoneOptions) => GridZoneEngine
  active: () => { grid: string; id: string; kind: 'move' | 'resize' } | null
  over: () => string | null
  destroy: () => void
}

const SLIDE = 'transform .18s cubic-bezier(.2,.8,.2,1)'
const LIFT_SHADOW = '0 12px 28px -8px rgba(0,0,0,.35)'
const PREVIEW_BG = 'rgba(59,130,246,.10)'
const PREVIEW_LINE = '2px dashed rgba(59,130,246,.85)'
const BLOCKED_BG = 'rgba(239,68,68,.10)'
const BLOCKED_LINE = '2px dashed rgba(239,68,68,.85)'
const PREVIEW_Z = 5
const GHOST_STYLE_ID = 'dumb-grid-ghost'

const canPopover = () =>
  typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover === 'function'

// UA-стили [popover] (рамка, фон, inset:0 + margin:auto) утащили бы клон в центр
// экрана. Гасим их В СЛОЕ: слой проигрывает авторским стилям, поэтому
// собственное оформление блока остаётся нетронутым.
function injectGhostReset() {
  if (typeof document === 'undefined' || document.getElementById(GHOST_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = GHOST_STYLE_ID
  style.textContent = `@layer dumb-grid {
  [data-dumb-grid-ghost]:popover-open {
    position: fixed; inset: auto; margin: 0; padding: 0; border: 0;
    background: transparent; color: inherit; overflow: visible;
  }
}`
  document.head.appendChild(style)
}

function makeGhost(src: HTMLElement, r: { top: number; left: number; width: number; height: number }): HTMLElement {
  const ghost = src.cloneNode(true) as HTMLElement
  ghost.setAttribute('data-dumb-grid-ghost', '')
  ghost.removeAttribute('id')
  src.insertAdjacentElement('afterend', ghost)

  if (canPopover()) {
    ghost.setAttribute('popover', 'manual')
    try { ghost.showPopover() } catch { /* фолбэк: обычный fixed */ }
  }
  ghost.style.viewTransitionName = 'none'
  ghost.style.boxSizing = 'border-box'
  ghost.style.position = 'fixed'
  ghost.style.margin = '0'
  ghost.style.top = `${r.top}px`
  ghost.style.left = `${r.left}px`
  ghost.style.width = `${r.width}px`
  ghost.style.height = `${r.height}px`
  ghost.style.zIndex = '9999'
  ghost.style.pointerEvents = 'none'
  ghost.style.willChange = 'transform'
  ghost.style.boxShadow = LIFT_SHADOW
  ghost.style.cursor = 'grabbing'
  // ручки редактора на клоне не нужны — он не интерактивен
  for (const el of Array.from(ghost.querySelectorAll('[data-grid-resize],[data-grid-remove]'))) el.remove()
  return ghost
}

type Zone = {
  name: string
  el: HTMLElement | null
  els: Map<string, HTMLElement>
  opts: GridZoneOptions
  ro: ResizeObserver | null
  contentW: number
  padLeft: number
  padTop: number
}

type ZoneSnap = {
  name: string
  m: Metrics
  mode: LayoutMode
  blocks: Array<DumbGridBlock>
  base: Array<Placed>
  padLeft: number
  padTop: number
  /** прямоугольник контейнера на момент снимка + состояние прокрутки тогда же */
  boxTop: number; boxLeft: number; boxW: number; boxH: number
  boxWinX: number; boxWinY: number
  scroller: HTMLElement | null
  geom: ViewGeom
  sx0: number; sy0: number
}

type Drag = {
  kind: 'move' | 'resize'
  id: string
  fromZone: string
  fromIndex: number
  pid: number
  el: HTMLElement
  startX: number; startY: number
  lastX: number; lastY: number
  zones: Map<string, ZoneSnap>
  target: string
  index: number
  cell: { col: number; row: number }
  blocked: boolean
  span: { w: number; h: number }
  ghost: HTMLElement | null
  preview: HTMLElement | null
  previewZone: string | null
  touched: Set<HTMLElement>
  raf: number
  ready: boolean
  moved: boolean
}

export function createGridGroupEngine(opts: GridGroupOptions): GridGroupEngine {
  const zones = new Map<string, Zone>()
  let drag: Drag | null = null
  let activeState: { grid: string; id: string; kind: 'move' | 'resize' } | null = null
  let overName: string | null = null

  const setActive = (s: typeof activeState) => { activeState = s; opts.onActive?.(s) }
  const setOver = (name: string | null) => {
    if (overName === name) return
    overName = name
    opts.onOver?.(name)
  }

  const metricsOf = (z: Zone): Metrics => {
    const cols = Math.max(1, Math.floor(z.opts.cols()))
    const gapX = z.opts.gapX()
    return { cols, colW: colWidth(z.contentW, cols, gapX), rowH: z.opts.rowHeight(), gapX, gapY: z.opts.gapY() }
  }

  const placeOf = (blocks: Array<DumbGridBlock>, mode: LayoutMode, cols: number): Array<Placed> =>
    mode === 'free' ? placeFree(blocks, cols) : packFlow(blocks, cols, mode)

  /**
   * Снимок прямоугольников ВСЕХ контейнеров — IntersectionObserver, ноль forced
   * layout.
   *
   * Ждём записи по КАЖДОЙ цели, а не отписываемся после первого колбэка:
   * наблюдатель не обязан присылать всё одним батчем, и потерянный контейнер
   * раньше получал запасной размер «во весь экран». Такая зона накрывает
   * остальные и забирает любой хиттест — из неё блок не вынести никуда, а к ней
   * прилетает всё. Ровно такая асимметрия («из правой в левую можно, обратно
   * нет») и вылезала.
   *
   * Страховка на случай, если цель молчит совсем (например, `display: none`):
   * после нескольких порций отдаём то, что собрали.
   */
  function snapshot(cb: (rects: Map<Element, DOMRectReadOnly>) => void) {
    const out = new Map<Element, DOMRectReadOnly>()
    const targets: Element[] = []
    for (const z of zones.values()) if (z.el) targets.push(z.el)
    if (!targets.length || typeof IntersectionObserver !== 'function') { cb(out); return }

    let batches = 0
    const io = new IntersectionObserver(entries => {
      for (const e of entries) out.set(e.target, e.boundingClientRect)
      batches++
      if (out.size < targets.length && batches < 4) return
      io.disconnect()
      cb(out)
    })
    for (const t of targets) io.observe(t)
  }

  function buildSnaps(rects: Map<Element, DOMRectReadOnly>): Map<string, ZoneSnap> {
    const snaps = new Map<string, ZoneSnap>()
    for (const z of zones.values()) {
      if (!z.el) continue
      const scroller = scrollParent(z.el, true)
      const geom = measure(scroller)
      const s0 = scrollOf(scroller)
      const box = rects.get(z.el)
      const mode = z.opts.mode?.() ?? 'flow'
      const m = metricsOf(z)
      const blocks = z.opts.blocks()
      snaps.set(z.name, {
        name: z.name, m, mode, blocks,
        base: placeOf(blocks, mode, m.cols),
        padLeft: z.padLeft, padTop: z.padTop,
        // Прямоугольник не пришёл — зона просто не участвует в хиттесте
        // (нулевой размер). Подставлять сюда геометрию скроллера нельзя: для
        // страницы это весь экран, и такая зона перехватывала бы все дропы.
        boxTop: box ? box.top : 0,
        boxLeft: box ? box.left : 0,
        boxW: box ? box.width : 0,
        boxH: box ? box.height : 0,
        boxWinX: window.scrollX, boxWinY: window.scrollY,
        scroller, geom, sx0: s0.sx, sy0: s0.sy,
      })
    }
    return snaps
  }

  /**
   * Где контейнер зоны СЕЙЧАС: снятый прямоугольник, сдвинутый на то, насколько
   * с тех пор прокрутились окно и собственный скроллер зоны. Покадровый
   * getBoundingClientRect (forced layout) заменяется чтением scroll-полей.
   */
  function boxOf(z: ZoneSnap) {
    const s = scrollOf(z.scroller)
    const dx = (window.scrollX - z.boxWinX) + (z.scroller ? s.sx - z.sx0 : 0)
    const dy = (window.scrollY - z.boxWinY) + (z.scroller ? s.sy - z.sy0 : 0)
    return { left: z.boxLeft - dx, top: z.boxTop - dy, right: z.boxLeft - dx + z.boxW, bottom: z.boxTop - dy + z.boxH }
  }

  /** Зона под указателем; ни одной — держим прошлую, чтобы дроп у края не терялся. */
  function zoneAt(d: Drag, x: number, y: number): string {
    for (const z of d.zones.values()) {
      if (!z.boxW || !z.boxH) continue          // размер неизвестен — не претендует
      const b = boxOf(z)
      if (x < b.left || x > b.right || y < b.top || y > b.bottom) continue
      if (z.name !== d.fromZone) {
        const accepts = zones.get(z.name)?.opts.accepts
        if (accepts && !accepts(d.fromZone)) continue
      }
      return z.name
    }
    return d.target
  }

  /** Указатель в координатах контента зоны. */
  function pointIn(z: ZoneSnap, x: number, y: number) {
    const b = boxOf(z)
    return { x: x - b.left - z.padLeft, y: y - b.top - z.padTop }
  }

  /* ────────── стили ────────── */

  function slide(d: Drag, moves: Array<{ id: string; dx: number; dy: number }>, zoneName: string) {
    const zone = zones.get(zoneName)
    if (!zone) return
    for (const mv of moves) {
      const el = zone.els.get(mv.id)
      if (!el || el === d.el) continue
      if (!mv.dx && !mv.dy) {
        if (d.touched.has(el)) el.style.transform = ''
        continue
      }
      if (!d.touched.has(el)) {
        d.touched.add(el)
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

  /** вернуть на места всех, кого двигали (нужно при уходе в чужую сетку) */
  function calmDown(d: Drag) {
    for (const el of d.touched) el.style.transform = ''
  }

  function showPreview(d: Drag, zoneName: string, rect: { x: number; y: number; width: number; height: number }, blocked: boolean) {
    const zone = zones.get(zoneName)
    const snap = d.zones.get(zoneName)
    if (!zone?.el || !snap) return
    if (d.preview && d.previewZone !== zoneName) {
      d.preview.remove()
      d.preview = null
    }
    if (!d.preview) {
      const box = document.createElement('div')
      box.style.cssText = [
        'position:absolute', 'pointer-events:none', 'box-sizing:border-box',
        'border-radius:10px', `z-index:${PREVIEW_Z}`, 'outline-offset:-2px',
        'transition:background .12s ease, outline-color .12s ease',
      ].join(';')
      box.dataset.gridPreview = ''
      zone.el.appendChild(box)
      d.preview = box
      d.previewZone = zoneName
    }
    d.preview.dataset.blocked = blocked ? '' : undefined as unknown as string
    d.preview.style.background = blocked ? BLOCKED_BG : PREVIEW_BG
    d.preview.style.outline = blocked ? BLOCKED_LINE : PREVIEW_LINE
    d.preview.style.width = `${rect.width}px`
    d.preview.style.height = `${rect.height}px`
    d.preview.style.transform = `translate(${snap.padLeft + rect.x}px,${snap.padTop + rect.y}px)`
  }

  function resetStyles(d: Drag) {
    const reset = (el: HTMLElement) => {
      el.style.transition = ''
      el.style.transform = ''
      el.style.zIndex = ''
      el.style.willChange = ''
      el.style.boxShadow = ''
      el.style.opacity = ''
      el.style.cursor = ''
    }
    reset(d.el)
    for (const el of d.touched) reset(el)
    d.preview?.remove()
    d.preview = null
    d.previewZone = null
    d.ghost?.remove()
    d.ghost = null
  }

  /* ────────── кадр ────────── */

  function frame() {
    if (!drag) return
    const d = drag

    if (d.kind === 'resize') {
      if (d.ready) resizeFrame(d)
      d.raf = requestAnimationFrame(frame)
      return
    }

    // клон летит за курсором: он fixed, поэтому дельты курсора достаточно
    if (d.ghost) d.ghost.style.transform = `translate(${d.lastX - d.startX}px,${d.lastY - d.startY}px)`

    if (d.ready) {
      const name = zoneAt(d, d.lastX, d.lastY)
      const snap = d.zones.get(name)
      if (snap) {
        if (name !== d.target) {
          d.target = name
          calmDown(d)              // ушли к соседям — своя сетка возвращается в исходное
          setOver(name)
        }
        const p = pointIn(snap, d.lastX, d.lastY)
        if (name === d.fromZone) homeFrame(d, snap, p)
        else guestFrame(d, snap, p)
      }
    }
    d.raf = requestAnimationFrame(frame)
  }

  /** Жест над своей сеткой — то же, что делает одиночный движок. */
  function homeFrame(d: Drag, snap: ZoneSnap, p: { x: number; y: number }) {
    if (snap.mode === 'free') {
      const me = snap.base.find(b => b.id === d.id)
      if (!me) return
      const at = cellRect(me, snap.m)
      const cell = pointToCell({
        x: at.x + (d.lastX - d.startX),
        y: at.y + (d.lastY - d.startY),
        w: d.span.w, m: snap.m,
      })
      const blocked = overlaps({ placed: snap.base, id: d.id, ...cell, ...d.span })
      if (cell.col !== d.cell.col || cell.row !== d.cell.row || blocked !== d.blocked || d.previewZone !== snap.name) {
        d.cell = cell
        d.blocked = blocked
        showPreview(d, snap.name, cellRect({ ...me, ...cell, ...d.span }, snap.m), blocked)
      }
      return
    }

    const k = insertIndex({ base: snap.base, dragId: d.id, m: snap.m, pointerX: p.x, pointerY: p.y })
    if (k !== d.index || d.previewZone !== snap.name) {
      d.index = k
      const next = placeOf(reorder(snap.blocks, d.fromIndex, k), snap.mode, snap.m.cols)
      slide(d, moveDeltas({ base: snap.base, next, m: snap.m, skipId: d.id }), snap.name)
      const me = next.find(b => b.id === d.id)
      if (me) showPreview(d, snap.name, cellRect(me, snap.m), false)
    }
  }

  /**
   * Жест над чужой сеткой. Соседей там не двигаем: пока блок не отпущен, чужая
   * раскладка — не наше дело, показываем только место, куда он встанет.
   */
  function guestFrame(d: Drag, snap: ZoneSnap, p: { x: number; y: number }) {
    const w = Math.min(d.span.w, snap.m.cols)
    const h = d.span.h

    if (snap.mode === 'free') {
      const cell = pointToCell({ x: p.x, y: p.y, w, m: snap.m })
      const blocked = overlaps({ placed: snap.base, id: d.id, ...cell, w, h })
      if (cell.col !== d.cell.col || cell.row !== d.cell.row || blocked !== d.blocked || d.previewZone !== snap.name) {
        d.cell = cell
        d.blocked = blocked
        d.index = snap.blocks.length
        showPreview(d, snap.name, cellRect({ id: d.id, col: cell.col, row: cell.row, w, h }, snap.m), blocked)
      }
      return
    }

    // потоковая цель: место вставки считаем по её раскладке, а прямоугольник
    // берём из раскладки С УЖЕ вставленным блоком — иначе рамка встала бы туда,
    // где сейчас сосед, а не туда, куда блок реально попадёт
    const k = insertIndex({ base: snap.base, dragId: d.id, m: snap.m, pointerX: p.x, pointerY: p.y })
    if (k !== d.index || d.previewZone !== snap.name) {
      d.index = k
      const guest: DumbGridBlock = { id: d.id, w, h }
      const merged = snap.blocks.slice()
      merged.splice(k, 0, guest)
      const next = placeOf(merged, snap.mode, snap.m.cols)
      const me = next.find(b => b.id === d.id)
      d.blocked = false
      if (me) showPreview(d, snap.name, cellRect(me, snap.m), false)
    }
  }

  function resizeFrame(d: Drag) {
    const snap = d.zones.get(d.fromZone)
    if (!snap) return
    const limits = snap.blocks[d.fromIndex]
    if (!limits) return
    const want = snapSpan({
      start: { w: limits.w, h: limits.h },
      dx: d.lastX - d.startX, dy: d.lastY - d.startY,
      m: snap.m, limits,
    })
    const span = snap.mode === 'free'
      ? fitSpan({ placed: snap.base, id: d.id, ...d.cell, want, limits })
      : want
    if (span.w === d.span.w && span.h === d.span.h) return

    d.span = span
    if (snap.mode === 'free') {
      showPreview(d, snap.name, cellRect({ id: d.id, ...d.cell, ...span }, snap.m), false)
      return
    }
    const resized = snap.blocks.map((b, i) => (i === d.fromIndex ? { ...b, ...span } : b))
    const next = placeOf(resized, snap.mode, snap.m.cols)
    slide(d, moveDeltas({ base: snap.base, next, m: snap.m, skipId: d.id }), snap.name)
    const me = next.find(b => b.id === d.id)
    if (me) showPreview(d, snap.name, cellRect(me, snap.m), false)
  }

  /* ────────── жест ────────── */

  function onMove(ev: PointerEvent) {
    if (!drag || ev.pointerId !== drag.pid) return
    if (!drag.moved && (Math.abs(ev.clientX - drag.startX) > 2 || Math.abs(ev.clientY - drag.startY) > 2)) drag.moved = true
    drag.lastX = ev.clientX
    drag.lastY = ev.clientY
  }

  function detach() {
    restoreTextSelection()
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    window.removeEventListener('keydown', onKey)
  }

  function cleanup() {
    if (!drag) return
    const d = drag
    if (d.raf) cancelAnimationFrame(d.raf)
    detach()
    resetStyles(d)
    drag = null
    setActive(null)
    setOver(null)
  }

  /** Esc — отмена: блок остаётся там, где был. */
  function onKey(ev: KeyboardEvent) {
    if (ev.key === 'Escape') cleanup()
  }

  function onUp(ev: PointerEvent) {
    if (!drag || ev.pointerId !== drag.pid) return
    const d = drag
    const zone = zones.get(d.fromZone)
    const snap = d.zones.get(d.fromZone)

    if (d.kind === 'resize') {
      const before = snap?.blocks[d.fromIndex]
      cleanup()
      if (d.ready && before && (d.span.w !== before.w || d.span.h !== before.h)) {
        zone?.opts.onResize?.(d.id, d.span.w, d.span.h)
      }
      return
    }

    const ready = d.ready
    const target = d.target
    const blocked = d.blocked
    const index = d.index
    const cell = d.cell
    const home = snap?.base.find(b => b.id === d.id)
    cleanup()
    if (!ready) return

    if (target !== d.fromZone) {
      if (blocked) return                       // место в чужой сетке занято
      opts.onTransfer?.(
        { grid: d.fromZone, id: d.id, index: d.fromIndex },
        { grid: target, index, x: cell.col, y: cell.row },
      )
      return
    }

    if (snap?.mode === 'free') {
      if (blocked || !home || (cell.col === home.col && cell.row === home.row)) return
      zone?.opts.onMove?.(d.id, cell.col, cell.row)
      return
    }
    if (index !== d.fromIndex) zone?.opts.onReorder?.(d.fromIndex, index)
  }

  function begin(kind: 'move' | 'resize', name: string, id: string, handle: HTMLElement, pid: number, x: number, y: number) {
    const zone = zones.get(name)
    const el = zone?.els.get(id)
    if (!zone || !el || !zone.el) return
    if (kind === 'move' && handle === el && focusInside(el)) return

    const blocks = zone.opts.blocks()
    const fromIndex = blocks.findIndex(b => b.id === id)
    if (fromIndex < 0 || blocks[fromIndex].locked) return
    const m = metricsOf(zone)
    if (!m.colW) return

    drag = {
      kind, id, fromZone: name, fromIndex, pid, el,
      startX: x, startY: y, lastX: x, lastY: y,
      zones: new Map(), target: name, index: fromIndex,
      cell: { col: 0, row: 0 }, blocked: false,
      span: { w: blocks[fromIndex].w, h: blocks[fromIndex].h },
      ghost: null, preview: null, previewZone: null,
      touched: new Set(), raf: 0, ready: false, moved: false,
    }
    setActive({ grid: name, id, kind })
    setOver(name)
    suppressTextSelection()

    el.style.willChange = 'transform'
    if (kind === 'move') {
      injectGhostReset()
      el.style.opacity = '0.4'                 // оригинал держит место, летит клон
      el.style.cursor = 'grabbing'
    } else {
      el.style.zIndex = '3'
    }

    snapshot(rects => {
      if (!drag || drag.id !== id || drag.pid !== pid) return
      drag.zones = buildSnaps(rects)
      const snap = drag.zones.get(name)
      const home = snap?.base.find(b => b.id === id)
      if (snap && home) {
        drag.cell = { col: home.col, row: home.row }
        if (kind === 'move') {
          // клон ставим ровно на место оригинала: прямоугольник считается
          // арифметикой, мерить элемент не нужно
          const r = cellRect(home, snap.m)
          const b = boxOf(snap)
          drag.ghost = makeGhost(el, {
            left: b.left + snap.padLeft + r.x,
            top: b.top + snap.padTop + r.y,
            width: r.width, height: r.height,
          })
        } else {
          showPreview(drag, name, cellRect(home, snap.m), false)
        }
      }
      drag.ready = true
    })

    try { handle.setPointerCapture(pid) } catch { /* noop */ }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('keydown', onKey)
    drag.raf = requestAnimationFrame(frame)
  }

  const gate = createPressGate(opts)
  const canStart = (zone: Zone) => !zone.opts.disabled?.() && !drag && !gate.pending()

  return {
    grid(name: string, zoneOpts: GridZoneOptions): GridZoneEngine {
      const zone: Zone = zones.get(name) ?? {
        name, el: null, els: new Map(), opts: zoneOpts, ro: null, contentW: 0, padLeft: 0, padTop: 0,
      }
      zone.opts = zoneOpts
      zones.set(name, zone)

      return {
        attachContainer(el: HTMLElement) {
          zone.el = el
          if (typeof ResizeObserver === 'function') {
            zone.ro = new ResizeObserver(entries => {
              const r = entries[entries.length - 1]?.contentRect
              if (!r) return
              zone.contentW = r.width
              zone.padLeft = r.left
              zone.padTop = r.top
            })
            zone.ro.observe(el)
          }
          return () => {
            zone.ro?.disconnect()
            zone.ro = null
            if (zone.el === el) zone.el = null
          }
        },

        attach(el: HTMLElement, id: string) {
          zone.els.set(id, el)
          el.dataset.gridBlock = id
          const down = (ev: PointerEvent) => {
            if (ev.button !== 0 || !canStart(zone)) return
            if (!(ev.target instanceof Element)) return
            if (ev.target.closest('[data-grid-resize]')) return
            if (ev.target.closest('[data-flip-id]')) return
            const nested = ev.target.closest('[data-grid-block]')
            if (nested && nested !== el) return
            const handle = el.querySelector('[data-drag-handle]') as HTMLElement | null
            if (handle) {
              if (!(ev.target instanceof Node && handle.contains(ev.target))) return
            } else if (targetIsInteractive(ev)) {
              return
            }
            gate.arm(ev, (px, py) => begin('move', name, id, handle || el, ev.pointerId, px, py))
          }
          el.addEventListener('pointerdown', down)
          const handle = el.querySelector('[data-drag-handle]') as HTMLElement | null
          if (handle) handle.style.touchAction = 'none'
          return () => {
            el.removeEventListener('pointerdown', down)
            delete el.dataset.gridBlock
            if (zone.els.get(id) === el) zone.els.delete(id)
          }
        },

        attachResize(el: HTMLElement, id: string) {
          el.dataset.gridResize = ''
          el.style.touchAction = 'none'
          const down = (ev: PointerEvent) => {
            if (ev.button !== 0 || !canStart(zone) || zone.opts.resizable?.() === false) return
            ev.stopPropagation()
            ev.preventDefault()
            begin('resize', name, id, el, ev.pointerId, ev.clientX, ev.clientY)
          }
          el.addEventListener('pointerdown', down)
          return () => el.removeEventListener('pointerdown', down)
        },
      }
    },

    active: () => activeState,
    over: () => overName,
    destroy() {
      gate.cancel()
      cleanup()
      for (const z of zones.values()) {
        z.ro?.disconnect()
        z.ro = null
        z.els.clear()
        z.el = null
      }
      zones.clear()
    },
  }
}
