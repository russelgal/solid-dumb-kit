// Выделение рамкой «как в Finder» — свой движок, без @viselect.
//
// Почему свой: viselect на КАЖДЫЙ move зовёт getBoundingClientRect по каждому
// элементу — сотни forced layout в кадр, ровно то, что кит запрещает. Здесь
// позиции снимаются ОДИН раз через IntersectionObserver (bounds считаются
// off-main-thread), а в кадре — только арифметика пересечений.
//
// Файл НЕ зависит от Solid — обёртка в ./solid.ts.
//
// Побочно уходит и болячка viselect со скроллом: рамка живёт в координатах
// КОНТЕНТА, поэтому при прокрутке она растёт вместе с ним, и уже задетые
// элементы не выпадают из выделения.

import {
  autoScrollSpeed, doScroll, measure, scrollOf, scrollParent, viewOrigin,
  type ViewGeom,
} from '@solid-dumb-kit/shared'
import {
  areaFrom, clampPoint, diffSelection, pickHits, resolveSelection, tapSelection,
  type Bounds, type Box, type IntersectMode,
} from './selectionMath'
import { restoreTextSelection, suppressTextSelection } from '@solid-dumb-kit/shared'

/**
 * Движок выделения рамкой. Без привязки к фреймворку: принимает контейнер и
 * возвращает функцию отписки; Solid-обёртка (createSelectionArea) — в ./solid.ts.
 */
export type SelectionEngine = {
  /** повесить жест на контейнер; вернёт отписку */
  attach: (el: HTMLElement) => () => void
  /** снять всё */
  destroy: () => void
}

export type SelectionCoreOptions = {
  /** контейнер: и область жеста, и (обычно) скроллер */
  container: () => HTMLElement | null
  /** CSS-селектор выбираемых элементов */
  selectables: string
  /** атрибут-ключ элемента (по умолчанию data-key) */
  keyAttr?: string
  /** режим попадания в рамку */
  intersect?: () => IntersectMode
  /** выделение изменилось (в процессе жеста и по его окончании) */
  onChange: (selected: Set<string>, info: { added: string[]; removed: string[] }) => void
  /** жест завершён */
  onStop?: (selected: Set<string>) => void
  /** старт запрещён (вернуть false) */
  onBeforeStart?: (ev: PointerEvent) => boolean | void
  /** выделение на момент старта жеста */
  current: () => Set<string>
  /** сколько px пройти до старта рамки */
  threshold?: number
  /** класс на прямоугольник рамки */
  areaClass?: string
}

type Drag = {
  pid: number
  /** старт в координатах контента */
  x0: number; y0: number
  lastX: number; lastY: number
  scroller: HTMLElement | null
  geom: ViewGeom
  /** смещение контейнера в системе координат контента (для отрисовки рамки) */
  hostX: number; hostY: number
  /** границы, за которые рамка не выезжает */
  bounds: Bounds
  cells: Box[]
  keys: string[]
  base: Set<string>
  prev: Set<string>
  additive: boolean
  box: HTMLDivElement
  raf: number
  ready: boolean
}

// [data-drag-handle] — иначе протяжка строки за ручку заодно рисовала бы рамку
const IGNORE = 'button, a, input, select, textarea, [data-no-select], [data-drag-handle]'

export function createSelectionEngine(opts: SelectionCoreOptions): SelectionEngine {
  const threshold = opts.threshold ?? 10
  let drag: Drag | null = null
  let pending: { pid: number; x: number; y: number; ev: PointerEvent } | null = null

  /** снимок позиций всех выбираемых — один батч, ноль forced layout */
  function snapshot(host: HTMLElement, cb: (cells: Box[], keys: string[]) => void) {
    const els = Array.from(host.querySelectorAll<HTMLElement>(opts.selectables))
    if (!els.length) { cb([], []); return }

    const scroller = scrollParent(host, true)
    const geom = measure(scroller)
    const origin = scroller ? viewOrigin(geom, window.scrollX, window.scrollY) : { top: 0, left: 0 }
    const s = scrollOf(scroller)

    const rects = new Map<Element, DOMRectReadOnly>()
    const io = new IntersectionObserver(entries => {
      for (const e of entries) rects.set(e.target, e.boundingClientRect)
      io.disconnect()
      const cells: Box[] = []
      const keys: string[] = []
      const attr = opts.keyAttr ?? 'data-key'
      for (const el of els) {
        const r = rects.get(el)
        const key = el.getAttribute(attr)
        if (!r || key == null) continue
        cells.push({
          left: r.left - origin.left + s.sx,
          top: r.top - origin.top + s.sy,
          width: r.width, height: r.height,
        })
        keys.push(key)
      }
      cb(cells, keys)
    })
    for (const el of els) io.observe(el)
  }

  function frame() {
    if (!drag) return
    const d = drag
    const origin = d.scroller ? viewOrigin(d.geom, window.scrollX, window.scrollY) : { top: 0, left: 0 }
    let { sx, sy } = scrollOf(d.scroller)

    // автоскролл у края — та же механика, что у драга
    const speed = autoScrollSpeed({
      pointerY: d.lastY, viewTop: origin.top, clientH: d.geom.clientH,
      scrollY: sy, scrollMax: d.geom.max,
    })
    if (speed) {
      doScroll(d.scroller, 0, speed)
      ;({ sx, sy } = scrollOf(d.scroller))
    }

    // указатель в координатах КОНТЕНТА: рамка растёт вместе с прокруткой,
    // поэтому задетое выше не выпадает из выделения при скролле.
    // Прижимаем к границам контейнера — иначе рамка вылезет наружу и заодно
    // растянет ему scrollWidth/Height, добавив полосы прокрутки на ходу.
    const p = clampPoint(d.lastX - origin.left + sx, d.lastY - origin.top + sy, d.bounds)
    const area = areaFrom(d.x0, d.y0, p.x, p.y)

    // Рамка — absolute внутри контейнера, а такой элемент прибит к КОНТЕНТУ
    // (не к видимой области), поэтому вычитаем только смещение самого контейнера.
    d.box.style.transform = `translate(${area.left - d.hostX}px,${area.top - d.hostY}px)`
    d.box.style.width = `${area.width}px`
    d.box.style.height = `${area.height}px`

    if (d.ready) {
      const touched = pickHits(area, d.cells, opts.intersect?.() ?? 'touch').map(i => d.keys[i])
      const next = resolveSelection({ base: d.base, touched, additive: d.additive })
      const info = diffSelection(d.prev, next)
      if (info.added.length || info.removed.length) {
        d.prev = next
        opts.onChange(next, info)
      }
    }
    d.raf = requestAnimationFrame(frame)
  }

  function begin(ev: PointerEvent) {
    const host = opts.container()
    if (!host) return

    const scroller = scrollParent(host, true)
    const geom = measure(scroller)
    const origin = scroller ? viewOrigin(geom, window.scrollX, window.scrollY) : { top: 0, left: 0 }
    const s = scrollOf(scroller)

    // Рамка рисуется инлайном — компонент самодостаточен, CSS импортировать не надо.
    // Цвет берётся от currentColor, поэтому она вписывается в любую тему; задан
    // areaClass — оформляй как хочешь, структурные стили останутся.
    const box = document.createElement('div')
    if (opts.areaClass) box.className = opts.areaClass
    Object.assign(box.style, {
      position: 'absolute', top: '0', left: '0', pointerEvents: 'none',
      willChange: 'transform', zIndex: '9999',
      background: 'oklch(from currentColor l c h / 0.08)',
      border: '1.5px solid oklch(from currentColor l c h / 0.3)',
      borderRadius: '4px',
    } as Partial<CSSStyleDeclaration>)
    host.appendChild(box)

    // Если контейнер сам является скроллером, система координат контента —
    // его собственная, и смещение нулевое. Иначе берём его положение в этой
    // системе (одно чтение на старт жеста, не в кадре).
    let hostX = 0, hostY = 0
    let bounds: Bounds
    if (scroller === host) {
      // контейнер сам прокручивается: рамка живёт в его контенте целиком
      bounds = { minX: 0, minY: 0, maxX: geom.scrollW, maxY: geom.scrollH }
    } else {
      const hr = host.getBoundingClientRect()
      hostX = hr.left - origin.left + s.sx
      hostY = hr.top - origin.top + s.sy
      bounds = { minX: hostX, minY: hostY, maxX: hostX + hr.width, maxY: hostY + hr.height }
    }

    const additive = ev.shiftKey || ev.metaKey || ev.ctrlKey
    drag = {
      pid: ev.pointerId,
      x0: ev.clientX - origin.left + s.sx,
      y0: ev.clientY - origin.top + s.sy,
      lastX: ev.clientX, lastY: ev.clientY,
      scroller, geom, hostX, hostY, bounds,
      cells: [], keys: [],
      base: additive ? new Set(opts.current()) : new Set(),
      prev: new Set(opts.current()),
      additive,
      box, raf: 0, ready: false,
    }

    // без модификатора жест начинается с чистого листа
    if (!additive && drag.prev.size) {
      const empty = new Set<string>()
      opts.onChange(empty, diffSelection(drag.prev, empty))
      drag.prev = empty
    }

    snapshot(host, (cells, keys) => {
      if (!drag) return
      drag.cells = cells
      drag.keys = keys
      drag.ready = true
    })

    suppressTextSelection()
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    drag.raf = requestAnimationFrame(frame)
  }

  function onMove(ev: PointerEvent) {
    if (!drag || ev.pointerId !== drag.pid) return
    drag.lastX = ev.clientX
    drag.lastY = ev.clientY
    ev.preventDefault()
  }

  function cleanup() {
    if (!drag) return
    if (drag.raf) cancelAnimationFrame(drag.raf)
    drag.box.remove()
    restoreTextSelection()
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    drag = null
  }

  function onUp(ev: PointerEvent) {
    if (!drag || ev.pointerId !== drag.pid) return
    const selected = drag.prev
    cleanup()
    opts.onStop?.(selected)
  }

  // до порога жест не начинаем — иначе обычный клик стирал бы выделение рамкой
  function pendMove(ev: PointerEvent) {
    if (!pending || ev.pointerId !== pending.pid) return
    if (Math.abs(ev.clientX - pending.x) < threshold && Math.abs(ev.clientY - pending.y) < threshold) return
    const start = pending.ev
    clearPending()
    begin(start)
    if (drag) { drag.lastX = ev.clientX; drag.lastY = ev.clientY }
  }
  /** отпустили, не пройдя порог — это клик, а не рамка */
  function pendUp(ev: PointerEvent) {
    if (!pending || ev.pointerId !== pending.pid) return
    const down = pending.ev
    clearPending()

    const attr = opts.keyAttr ?? 'data-key'
    const el = (ev.target as HTMLElement | null)?.closest(opts.selectables) as HTMLElement | null
    const key = el?.getAttribute(attr) ?? null
    const additive = down.shiftKey || down.metaKey || down.ctrlKey

    const current = opts.current()
    const next = tapSelection({ current, key, additive })
    const info = diffSelection(current, next)
    if (!info.added.length && !info.removed.length) return
    opts.onChange(next, info)
    opts.onStop?.(next)
  }
  function clearPending() {
    if (!drag) restoreTextSelection()   // жест так и не начался — вернуть как было
    pending = null
    window.removeEventListener('pointermove', pendMove)
    window.removeEventListener('pointerup', pendUp)
    window.removeEventListener('pointercancel', pendUp)
  }

  function onDown(ev: PointerEvent) {
    if (ev.button !== 0 || drag || pending) return
    const target = ev.target as HTMLElement | null
    if (target?.closest(IGNORE)) return
    if (opts.onBeforeStart?.(ev) === false) return

    // Гасим выделение текста сразу: жест ещё не начался (ждём порога), но
    // браузер уже тянет выделение от точки нажатия — в Safari это особенно заметно.
    suppressTextSelection()
    pending = { pid: ev.pointerId, x: ev.clientX, y: ev.clientY, ev }
    window.addEventListener('pointermove', pendMove)
    window.addEventListener('pointerup', pendUp)
    window.addEventListener('pointercancel', pendUp)
  }

  return {
    attach(el: HTMLElement) {
      el.addEventListener('pointerdown', onDown)
      return () => el.removeEventListener('pointerdown', onDown)
    },
    destroy() {
      clearPending()
      cleanup()
    },
  }
}
