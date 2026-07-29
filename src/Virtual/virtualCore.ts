// Виртуальное окно с измерением строк. Без привязки к фреймворку.
//
// Высоты снимаются тем же приёмом, что позиции в драге: IntersectionObserver
// отдаёт boundingClientRect батчем, посчитанным вне главного потока, — то есть
// без forced layout, даже когда в окне полсотни строк.
//
// Строки находятся по атрибуту-ключу (DumbTable проставляет data-key сам),
// поэтому рефы на каждую строку не нужны.

import { buildOffsets, windowOf, type VirtualWindow } from './virtualMath'

export type VirtualOptions = {
  /** ключи ВСЕХ строк набора, в текущем порядке */
  keys: () => Array<string>
  /** высота строки, пока её не измерили */
  estimate?: number
  /** сколько строк рисовать про запас */
  overscan?: number
  /** атрибут, по которому строки находятся в DOM */
  keyAttr?: string
  /** окно пересчитано — перерисуй */
  onChange: (win: VirtualWindow) => void
}

export type VirtualEngine = {
  attach: (scroller: HTMLElement) => () => void
  /** пересчитать (после смены данных или сортировки) */
  refresh: () => void
  /** снять высоты отрисованных строк — звать после перерисовки окна */
  measure: () => void
  window: () => VirtualWindow
  destroy: () => void
}

const EMPTY: VirtualWindow = { first: 0, last: 0, padTop: 0, padBottom: 0, total: 0 }

export function createVirtualEngine(opts: VirtualOptions): VirtualEngine {
  const attr = opts.keyAttr ?? 'data-key'
  const estimate = opts.estimate ?? 40
  const heights = new Map<string, number>()

  let scroller: HTMLElement | null = null
  let offsets: number[] = [0]
  let win: VirtualWindow = EMPTY
  let scheduled = 0
  let measuring = false

  function recompute() {
    offsets = buildOffsets(opts.keys(), { get: (k) => heights.get(k), estimate })
    const next = windowOf({
      offsets,
      scrollTop: scroller?.scrollTop ?? 0,
      viewportH: scroller?.clientHeight ?? 0,
      overscan: opts.overscan,
    })
    const changed =
      next.first !== win.first || next.last !== win.last ||
      next.padTop !== win.padTop || next.padBottom !== win.padBottom
    win = next
    if (changed) opts.onChange(win)
  }

  /** высоты отрисованных строк — одним батчем, без forced layout */
  function measure() {
    if (!scroller || measuring) return
    const els = Array.from(scroller.querySelectorAll<HTMLElement>(`[${attr}]`))
    if (!els.length) return
    measuring = true

    const io = new IntersectionObserver((entries) => {
      io.disconnect()
      measuring = false
      let dirty = false
      for (const e of entries) {
        const key = (e.target as HTMLElement).getAttribute(attr)
        const h = e.boundingClientRect.height
        if (!key || !h) continue
        if (heights.get(key) !== h) { heights.set(key, h); dirty = true }
      }
      if (dirty) recompute()
    })
    for (const el of els) io.observe(el)
  }

  function onScroll() {
    if (scheduled) return
    scheduled = requestAnimationFrame(() => {   // не чаще кадра
      scheduled = 0
      recompute()
    })
  }

  return {
    attach(el) {
      scroller = el
      el.addEventListener('scroll', onScroll, { passive: true })
      recompute()
      return () => {
        el.removeEventListener('scroll', onScroll)
        if (scroller === el) scroller = null
      }
    },
    refresh: recompute,
    measure,
    window: () => win,
    destroy() {
      if (scheduled) cancelAnimationFrame(scheduled)
      scheduled = 0
      heights.clear()
    },
  }
}
