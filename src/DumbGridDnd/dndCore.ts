// Сетка на НАТИВНОМ drag-and-drop. Отдельная реализация: `DumbGrid` со своим
// указательным движком остаётся нетронутым, эти двое не пересекаются нигде,
// кроме общей математики (../DumbGrid/gridMath) — она про числа, а не про жесты.
//
// Разделение труда с браузером:
//   • он решает, НАД КАКОЙ сеткой указатель — `dragover` приходит прямо на
//     контейнер, всплытие останавливает ближайший (значит вложенные сетки
//     работают сами собой), он же рисует картинку переноса и скроллит у краёв;
//   • мы решаем, КУДА ИМЕННО внутри сетки встанет блок: та же арифметика, то же
//     расступание соседей трансформом, та же рамка будущего места.
//
// Чего здесь нет и не будет: работы на тач-устройствах. HTML5 DnD там не
// реализован вовсе — для пальца берите `DumbGrid`, он на указательных событиях.
//
// Ресайз — единственное место с указателем: он не перенос, из своей сетки не
// уходит, и ему нужна покадровая точность, которой `dragover` не даёт.

import {
  cellRect, colWidth, fitSpan, insertIndex, moveDeltas, overlaps, packFlow, placeFree, pointToCell,
  reorder, snapSpan,
  type FreeSpan, type GridSpan, type LayoutMode, type Metrics, type Placed, type SpanLimits,
} from '../DumbGrid/gridMath'
import { measure, scrollOf, scrollParent, type ViewGeom } from '../shared/viewport'
import { shouldAnimate } from '../shared/motion'

/** блок сетки: размеры, пределы, позиция для свободного режима */
export type DndBlock = GridSpan & FreeSpan & SpanLimits & { locked?: boolean }

/** откуда и куда переехал блок */
export type DndTransferSource = { grid: string; id: string; index: number }
export type DndTransferTarget = { grid: string; index: number; x: number; y: number }

export type DndGroupOptions = {
  animate?: boolean
  /** блок переехал в ДРУГУЮ сетку — обе раскладки правит потребитель */
  onTransfer?: (from: DndTransferSource, to: DndTransferTarget) => void
  /** идёт жест: сетка, блок и его вид */
  onActive?: (state: { grid: string; id: string; kind: 'move' | 'resize' } | null) => void
  /** над какой сеткой указатель */
  onOver?: (grid: string | null) => void
}

export type DndZoneOptions = {
  blocks: () => Array<DndBlock>
  mode?: () => LayoutMode
  cols: () => number
  rowHeight: () => number
  gapX: () => number
  gapY: () => number
  disabled?: () => boolean
  resizable?: () => boolean
  /** пускать ли к себе блок из сетки `from` (по умолчанию да) */
  accepts?: (from: string) => boolean
  onReorder?: (from: number, to: number) => void
  onMove?: (id: string, x: number, y: number) => void
  onResize?: (id: string, w: number, h: number) => void
}

export type DndZoneEngine = {
  attachContainer: (el: HTMLElement) => () => void
  attach: (el: HTMLElement, id: string) => () => void
  attachResize: (el: HTMLElement, id: string) => () => void
}

export type DndEngine = {
  grid: (name: string, opts: DndZoneOptions) => DndZoneEngine
  active: () => { grid: string; id: string; kind: 'move' | 'resize' } | null
  over: () => string | null
  destroy: () => void
}

/** формат данных переноса: по нему блок узнаёт и чужой приёмник */
export const DND_MIME = 'application/x-dumb-grid'

const SLIDE = 'transform .18s cubic-bezier(.2,.8,.2,1)'
const PREVIEW_BG = 'rgba(59,130,246,.10)'
const PREVIEW_LINE = '2px dashed rgba(59,130,246,.85)'
const BLOCKED_BG = 'rgba(239,68,68,.10)'
const BLOCKED_LINE = '2px dashed rgba(239,68,68,.85)'
const PREVIEW_Z = 5

export const dndSupported = () =>
  typeof DataTransfer === 'function' && typeof DragEvent === 'function'

type Zone = {
  name: string
  el: HTMLElement | null
  els: Map<string, HTMLElement>
  opts: DndZoneOptions
  ro: ResizeObserver | null
  contentW: number
  padLeft: number
  padTop: number
}

/** зона, снятая на время жеста: метрики, раскладка и где она была */
type Snap = {
  name: string
  m: Metrics
  mode: LayoutMode
  blocks: Array<DndBlock>
  base: Array<Placed>
  padLeft: number
  padTop: number
  boxLeft: number; boxTop: number
  winX: number; winY: number
  scroller: HTMLElement | null
  sx0: number; sy0: number
}

type Drag = {
  fromZone: string
  id: string
  fromIndex: number
  el: HTMLElement
  span: { w: number; h: number }
  target: string
  index: number
  cell: { col: number; row: number }
  blocked: boolean
  snaps: Map<string, Snap>
  preview: HTMLElement | null
  previewZone: string | null
  touched: Set<HTMLElement>
}

type Resize = {
  zone: string
  id: string
  el: HTMLElement
  pid: number
  startX: number; startY: number
  lastX: number; lastY: number
  snap: Snap
  home: Placed
  span: { w: number; h: number }
  preview: HTMLElement | null
  touched: Set<HTMLElement>
  raf: number
}

export function createGridDndEngine(opts: DndGroupOptions): DndEngine {
  const zones = new Map<string, Zone>()
  let drag: Drag | null = null
  let resize: Resize | null = null
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

  const placeOf = (blocks: Array<DndBlock>, mode: LayoutMode, cols: number): Array<Placed> =>
    mode === 'free' ? placeFree(blocks, cols) : packFlow(blocks, cols, mode)

  /**
   * Снимок зоны. Прямоугольник контейнера читаем ОДИН раз — на входе в неё:
   * layout в этот момент чист (за жест мы пишем только transform), а дальше
   * прокрутка компенсируется арифметикой, как и везде в ките.
   */
  function snapOf(zone: Zone): Snap | null {
    if (!zone.el) return null
    const box = zone.el.getBoundingClientRect()
    const scroller = scrollParent(zone.el, true)
    const s0 = scrollOf(scroller)
    const mode = zone.opts.mode?.() ?? 'flow'
    const m = metricsOf(zone)
    const blocks = zone.opts.blocks()
    return {
      name: zone.name, m, mode, blocks,
      base: placeOf(blocks, mode, m.cols),
      padLeft: zone.padLeft, padTop: zone.padTop,
      boxLeft: box.left, boxTop: box.top,
      winX: window.scrollX, winY: window.scrollY,
      scroller, sx0: s0.sx, sy0: s0.sy,
    }
  }

  /** Указатель в координатах контента зоны (с компенсацией прокрутки). */
  function pointIn(s: Snap, x: number, y: number) {
    const sc = scrollOf(s.scroller)
    const dx = (window.scrollX - s.winX) + (s.scroller ? sc.sx - s.sx0 : 0)
    const dy = (window.scrollY - s.winY) + (s.scroller ? sc.sy - s.sy0 : 0)
    return { x: x - (s.boxLeft - dx) - s.padLeft, y: y - (s.boxTop - dy) - s.padTop }
  }

  /* ────────── общие стили жеста ────────── */

  function slide(touched: Set<HTMLElement>, zoneName: string, moves: Array<{ id: string; dx: number; dy: number }>, skip?: HTMLElement) {
    const zone = zones.get(zoneName)
    if (!zone) return
    for (const mv of moves) {
      const el = zone.els.get(mv.id)
      if (!el || el === skip) continue
      if (!mv.dx && !mv.dy) {
        if (touched.has(el)) el.style.transform = ''
        continue
      }
      if (!touched.has(el)) {
        touched.add(el)
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

  function calm(touched: Set<HTMLElement>) {
    for (const el of touched) {
      el.style.transition = ''
      el.style.transform = ''
      el.style.willChange = ''
    }
    touched.clear()
  }

  function preview(
    holder: { preview: HTMLElement | null; previewZone?: string | null },
    zoneName: string,
    rect: { x: number; y: number; width: number; height: number },
    pad: { left: number; top: number },
    blocked = false,
  ) {
    const zone = zones.get(zoneName)
    if (!zone?.el) return
    if (holder.preview && holder.previewZone && holder.previewZone !== zoneName) {
      holder.preview.remove()
      holder.preview = null
    }
    if (!holder.preview) {
      const box = document.createElement('div')
      box.style.cssText = [
        'position:absolute', 'pointer-events:none', 'box-sizing:border-box',
        'border-radius:10px', `z-index:${PREVIEW_Z}`, 'outline-offset:-2px',
        'transition:background .12s ease, outline-color .12s ease',
      ].join(';')
      box.dataset.gridPreview = ''
      zone.el.appendChild(box)
      holder.preview = box
      if ('previewZone' in holder) holder.previewZone = zoneName
    }
    holder.preview.dataset.blocked = blocked ? '' : undefined as unknown as string
    holder.preview.style.background = blocked ? BLOCKED_BG : PREVIEW_BG
    holder.preview.style.outline = blocked ? BLOCKED_LINE : PREVIEW_LINE
    holder.preview.style.width = `${rect.width}px`
    holder.preview.style.height = `${rect.height}px`
    holder.preview.style.transform = `translate(${pad.left + rect.x}px,${pad.top + rect.y}px)`
  }

  /* ────────── перенос: только нативные события ────────── */

  function clearDrag() {
    if (!drag) return
    calm(drag.touched)
    drag.preview?.remove()
    drag.el.style.opacity = ''
    drag = null
    setActive(null)
    setOver(null)
  }

  function onDragStart(zone: Zone, id: string, el: HTMLElement, ev: DragEvent) {
    if (!ev.dataTransfer || zone.opts.disabled?.()) { ev.preventDefault(); return }
    if (ev.target instanceof Element) {
      // ручка ресайза и вложенные сетки/сортировщики забирают жест себе
      if (ev.target.closest('[data-grid-resize]')) { ev.preventDefault(); return }
      if (ev.target.closest('[data-flip-id]')) { ev.preventDefault(); return }
      const nested = ev.target.closest('[data-grid-block]')
      if (nested && nested !== el) { ev.preventDefault(); return }
      const handle = el.querySelector('[data-drag-handle]') as HTMLElement | null
      if (handle && !handle.contains(ev.target)) { ev.preventDefault(); return }
    }

    const blocks = zone.opts.blocks()
    const fromIndex = blocks.findIndex(b => b.id === id)
    if (fromIndex < 0 || blocks[fromIndex].locked) { ev.preventDefault(); return }

    const snap = snapOf(zone)
    const home = snap?.base.find(b => b.id === id)
    if (!snap || !home) { ev.preventDefault(); return }

    ev.dataTransfer.effectAllowed = 'move'
    // Firefox без данных перенос не начнёт; заодно блок становится понятен
    // внешнему миру — его можно принять в другом окне или чужим приёмником
    try { ev.dataTransfer.setData(DND_MIME, JSON.stringify({ grid: zone.name, id })) } catch { /* noop */ }
    try { ev.dataTransfer.setData('text/plain', id) } catch { /* noop */ }
    // где метода нет (или он капризничает, как местами в Safari) — остаёмся с
    // картинкой переноса по умолчанию
    try { ev.dataTransfer.setDragImage?.(el, ev.offsetX || 0, ev.offsetY || 0) } catch { /* noop */ }

    drag = {
      fromZone: zone.name, id, fromIndex, el,
      span: { w: blocks[fromIndex].w, h: blocks[fromIndex].h },
      target: zone.name, index: fromIndex,
      cell: { col: home.col, row: home.row }, blocked: false,
      snaps: new Map([[zone.name, snap]]),
      preview: null, previewZone: null, touched: new Set(),
    }
    setActive({ grid: zone.name, id, kind: 'move' })
    setOver(zone.name)
    // приглушаем ПОСЛЕ кадра: иначе таким же уедет и снимок для картинки переноса
    requestAnimationFrame(() => { if (drag) el.style.opacity = '0.4' })
  }

  /** Куда блок встанет в СВОЕЙ сетке: соседи расступаются, как при обычной сортировке. */
  function homeTarget(d: Drag, s: Snap, p: { x: number; y: number }) {
    if (s.mode === 'free') {
      const me = s.base.find(b => b.id === d.id)
      if (!me) return
      const cell = pointToCell({ x: p.x - (d.span.w * (s.m.colW + s.m.gapX)) / 2, y: p.y - s.m.rowH / 2, w: d.span.w, m: s.m })
      const blocked = overlaps({ placed: s.base, id: d.id, ...cell, ...d.span })
      if (cell.col === d.cell.col && cell.row === d.cell.row && blocked === d.blocked && d.previewZone === s.name) return
      d.cell = cell
      d.blocked = blocked
      preview(d, s.name, cellRect({ ...me, ...cell, ...d.span }, s.m), { left: s.padLeft, top: s.padTop }, blocked)
      return
    }

    const k = insertIndex({ base: s.base, dragId: d.id, m: s.m, pointerX: p.x, pointerY: p.y })
    if (k === d.index && d.previewZone === s.name) return
    d.index = k
    d.blocked = false
    const next = placeOf(reorder(s.blocks, d.fromIndex, k), s.mode, s.m.cols)
    slide(d.touched, s.name, moveDeltas({ base: s.base, next, m: s.m, skipId: d.id }), d.el)
    const me = next.find(b => b.id === d.id)
    if (me) preview(d, s.name, cellRect(me, s.m), { left: s.padLeft, top: s.padTop }, false)
  }

  /**
   * Куда блок встанет в ЧУЖОЙ сетке. Соседей там не двигаем: пока блок не
   * отпущен, чужая раскладка — не наше дело, показываем только будущее место.
   */
  function guestTarget(d: Drag, s: Snap, p: { x: number; y: number }) {
    const w = Math.min(d.span.w, s.m.cols)
    const h = d.span.h

    if (s.mode === 'free') {
      const cell = pointToCell({ x: p.x - (w * (s.m.colW + s.m.gapX)) / 2, y: p.y - s.m.rowH / 2, w, m: s.m })
      const blocked = overlaps({ placed: s.base, id: d.id, ...cell, w, h })
      if (cell.col === d.cell.col && cell.row === d.cell.row && blocked === d.blocked && d.previewZone === s.name) return
      d.cell = cell
      d.blocked = blocked
      d.index = s.blocks.length
      preview(d, s.name, cellRect({ id: d.id, col: cell.col, row: cell.row, w, h }, s.m), { left: s.padLeft, top: s.padTop }, blocked)
      return
    }

    const k = insertIndex({ base: s.base, dragId: d.id, m: s.m, pointerX: p.x, pointerY: p.y })
    if (k === d.index && d.previewZone === s.name) return
    d.index = k
    d.blocked = false
    // прямоугольник берём из раскладки С УЖЕ вставленным блоком, иначе рамка
    // встала бы туда, где сейчас сосед, а не туда, где окажется блок
    const merged = s.blocks.slice()
    merged.splice(k, 0, { id: d.id, w, h })
    const next = placeOf(merged, s.mode, s.m.cols)
    const me = next.find(b => b.id === d.id)
    if (me) preview(d, s.name, cellRect(me, s.m), { left: s.padLeft, top: s.padTop }, false)
  }

  function onDragOver(zone: Zone, ev: DragEvent) {
    if (!drag || !zone.el) return
    if (zone.name !== drag.fromZone) {
      const accepts = zone.opts.accepts
      if (accepts && !accepts(drag.fromZone)) return     // без preventDefault дроп не случится
    }
    ev.preventDefault()
    ev.stopPropagation()          // ближайшая сетка забирает событие себе
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move'

    let s = drag.snaps.get(zone.name)
    if (!s) {
      const fresh = snapOf(zone)
      if (!fresh) return
      drag.snaps.set(zone.name, (s = fresh))
    }
    if (drag.target !== zone.name) {
      drag.target = zone.name
      calm(drag.touched)          // прошлая сетка возвращается в исходное
      setOver(zone.name)
    }

    const p = pointIn(s, ev.clientX, ev.clientY)
    if (zone.name === drag.fromZone) homeTarget(drag, s, p)
    else guestTarget(drag, s, p)
  }

  function onDrop(zone: Zone, ev: DragEvent) {
    if (!drag) return
    // Приём проверяем и здесь: полагаться на то, что без preventDefault в
    // dragover браузер не доставит drop, — значит держать правило приёма в
    // обработчике, который к решению отношения не имеет.
    if (zone.name !== drag.fromZone) {
      const accepts = zone.opts.accepts
      if (accepts && !accepts(drag.fromZone)) return
    }
    ev.preventDefault()
    ev.stopPropagation()

    const d = drag
    const s = d.snaps.get(d.fromZone)
    const home = s?.base.find(b => b.id === d.id)
    const to = zone.name
    const { index, cell, blocked } = d
    clearDrag()

    if (to !== d.fromZone) {
      if (blocked) return
      opts.onTransfer?.({ grid: d.fromZone, id: d.id, index: d.fromIndex }, { grid: to, index, x: cell.col, y: cell.row })
      return
    }
    const from = zones.get(d.fromZone)
    if (s?.mode === 'free') {
      if (blocked || !home || (cell.col === home.col && cell.row === home.row)) return
      from?.opts.onMove?.(d.id, cell.col, cell.row)
      return
    }
    if (index !== d.fromIndex) from?.opts.onReorder?.(d.fromIndex, index)
  }

  /* ────────── ресайз: единственный указательный жест ────────── */

  function resizeFrame() {
    if (!resize) return
    const r = resize
    const limits = r.snap.blocks.find(b => b.id === r.id)
    if (limits) {
      const want = snapSpan({
        start: { w: limits.w, h: limits.h },
        dx: r.lastX - r.startX, dy: r.lastY - r.startY,
        m: r.snap.m, limits,
      })
      const span = r.snap.mode === 'free'
        ? fitSpan({ placed: r.snap.base, id: r.id, col: r.home.col, row: r.home.row, want, limits })
        : want
      if (span.w !== r.span.w || span.h !== r.span.h) {
        r.span = span
        if (r.snap.mode === 'free') {
          preview(r, r.snap.name, cellRect({ ...r.home, ...span }, r.snap.m), { left: r.snap.padLeft, top: r.snap.padTop })
        } else {
          const resized = r.snap.blocks.map(b => (b.id === r.id ? { ...b, ...span } : b))
          const next = placeOf(resized, r.snap.mode, r.snap.m.cols)
          slide(r.touched, r.snap.name, moveDeltas({ base: r.snap.base, next, m: r.snap.m, skipId: r.id }), r.el)
          const me = next.find(b => b.id === r.id)
          if (me) preview(r, r.snap.name, cellRect(me, r.snap.m), { left: r.snap.padLeft, top: r.snap.padTop })
        }
      }
    }
    r.raf = requestAnimationFrame(resizeFrame)
  }

  function onResizeMove(ev: PointerEvent) {
    if (!resize || ev.pointerId !== resize.pid) return
    resize.lastX = ev.clientX
    resize.lastY = ev.clientY
  }

  function endResize(ev: PointerEvent) {
    if (!resize || ev.pointerId !== resize.pid) return
    const r = resize
    cancelAnimationFrame(r.raf)
    window.removeEventListener('pointermove', onResizeMove)
    window.removeEventListener('pointerup', endResize)
    window.removeEventListener('pointercancel', endResize)
    calm(r.touched)
    r.preview?.remove()
    r.el.style.zIndex = ''
    resize = null
    setActive(null)

    const before = r.snap.blocks.find(b => b.id === r.id)
    if (before && (r.span.w !== before.w || r.span.h !== before.h)) {
      zones.get(r.zone)?.opts.onResize?.(r.id, r.span.w, r.span.h)
    }
  }

  function beginResize(zone: Zone, id: string, ev: PointerEvent) {
    const el = zone.els.get(id)
    if (!el || drag || resize) return
    const blocks = zone.opts.blocks()
    const block = blocks.find(b => b.id === id)
    if (!block || block.locked) return
    const snap = snapOf(zone)
    const home = snap?.base.find(b => b.id === id)
    if (!snap || !home || !snap.m.colW) return

    resize = {
      zone: zone.name, id, el, pid: ev.pointerId,
      startX: ev.clientX, startY: ev.clientY, lastX: ev.clientX, lastY: ev.clientY,
      snap, home, span: { w: block.w, h: block.h },
      preview: null, touched: new Set(), raf: 0,
    }
    setActive({ grid: zone.name, id, kind: 'resize' })
    el.style.zIndex = '3'
    preview(resize, zone.name, cellRect(home, snap.m), { left: snap.padLeft, top: snap.padTop })

    window.addEventListener('pointermove', onResizeMove)
    window.addEventListener('pointerup', endResize)
    window.addEventListener('pointercancel', endResize)
    resize.raf = requestAnimationFrame(resizeFrame)
  }

  /* ────────── регистрация ────────── */

  return {
    grid(name: string, zoneOpts: DndZoneOptions): DndZoneEngine {
      const zone: Zone = zones.get(name) ?? {
        name, el: null, els: new Map(), opts: zoneOpts, ro: null, contentW: 0, padLeft: 0, padTop: 0,
      }
      zone.opts = zoneOpts
      zones.set(name, zone)

      return {
        attachContainer(el: HTMLElement) {
          zone.el = el
          const enter = (ev: DragEvent) => { if (drag) { ev.preventDefault(); ev.stopPropagation() } }
          const over = (ev: DragEvent) => onDragOver(zone, ev)
          const leave = (ev: DragEvent) => {
            // dragleave прилетает и при переходе на потомка — это не выход
            if (!drag || (ev.relatedTarget instanceof Node && el.contains(ev.relatedTarget))) return
            if (drag.target === zone.name) setOver(null)
          }
          const drop = (ev: DragEvent) => onDrop(zone, ev)
          el.addEventListener('dragenter', enter)
          el.addEventListener('dragover', over)
          el.addEventListener('dragleave', leave)
          el.addEventListener('drop', drop)

          if (typeof ResizeObserver === 'function') {
            // ширина контента приходит сама, без reflow; оттуда же отступы
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
            el.removeEventListener('dragenter', enter)
            el.removeEventListener('dragover', over)
            el.removeEventListener('dragleave', leave)
            el.removeEventListener('drop', drop)
            zone.ro?.disconnect()
            zone.ro = null
            if (zone.el === el) zone.el = null
          }
        },

        attach(el: HTMLElement, id: string) {
          zone.els.set(id, el)
          el.dataset.gridBlock = id
          el.setAttribute('draggable', 'true')
          const start = (ev: DragEvent) => onDragStart(zone, id, el, ev)
          const end = () => clearDrag()
          el.addEventListener('dragstart', start)
          el.addEventListener('dragend', end)
          return () => {
            el.removeEventListener('dragstart', start)
            el.removeEventListener('dragend', end)
            el.removeAttribute('draggable')
            delete el.dataset.gridBlock
            if (zone.els.get(id) === el) zone.els.delete(id)
          }
        },

        attachResize(el: HTMLElement, id: string) {
          el.dataset.gridResize = ''
          el.style.touchAction = 'none'
          // ручка не должна начинать нативный перенос блока
          el.setAttribute('draggable', 'false')
          const down = (ev: PointerEvent) => {
            if (ev.button !== 0 || zone.opts.disabled?.() || zone.opts.resizable?.() === false) return
            ev.stopPropagation()
            ev.preventDefault()
            beginResize(zone, id, ev)
          }
          el.addEventListener('pointerdown', down)
          return () => el.removeEventListener('pointerdown', down)
        },
      }
    },

    active: () => activeState,
    over: () => overName,
    destroy() {
      clearDrag()
      if (resize) {
        cancelAnimationFrame(resize.raf)
        window.removeEventListener('pointermove', onResizeMove)
        window.removeEventListener('pointerup', endResize)
        window.removeEventListener('pointercancel', endResize)
        resize.preview?.remove()
        resize = null
        setActive(null)
      }
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
