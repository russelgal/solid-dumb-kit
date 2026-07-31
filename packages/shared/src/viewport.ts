// Общая работа со скроллером и вьюпортом — для драга и для выделения рамкой.
//
// Правило кита: layout читаем ОДИН раз на старте жеста (measure), а в кадре
// только scrollTop/scrollLeft и window.scrollX/Y — они не форсят layout.
// Сдвиг контейнера от прокрутки страницы считается арифметикой (viewOrigin).

/** снятая на старте геометрия скроллера (живыми остаются только scrollTop/Left) */
export type ViewGeom = {
  /** позиция скроллера во вьюпорте на момент старта */
  top: number
  left: number
  clientH: number
  clientW: number
  /** предел прокрутки на старте */
  max: number
  /** полный размер содержимого (scrollWidth/scrollHeight) */
  scrollW: number
  scrollH: number
  /** скролл окна на момент старта — по нему компенсируем сдвиг контейнера */
  winX: number
  winY: number
}

export const EDGE = 48          // зона авто-скролла у края, px
export const MAX_SPEED = 18     // скорость авто-скролла у самого края, px/кадр
export const ACCEL = 3.5        // во сколько раз быстрее при сильном уходе за контейнер

/** ближайший прокручиваемый предок (включая сам элемент) */
export function scrollParent(el: HTMLElement, includeSelf = false): HTMLElement | null {
  let n: HTMLElement | null = includeSelf ? el : el.parentElement
  while (n) {
    const oy = getComputedStyle(n).overflowY
    if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && n.scrollHeight > n.clientHeight) return n
    n = n.parentElement
  }
  return null
}

/** Единственное синхронное чтение геометрии — один раз на старте жеста. */
export function measure(scroller: HTMLElement | null): ViewGeom {
  if (scroller) {
    const r = scroller.getBoundingClientRect()
    return {
      top: r.top, left: r.left,
      clientH: scroller.clientHeight, clientW: scroller.clientWidth,
      max: scroller.scrollHeight - scroller.clientHeight,
      scrollW: scroller.scrollWidth, scrollH: scroller.scrollHeight,
      winX: window.scrollX, winY: window.scrollY,
    }
  }
  const se = document.scrollingElement || document.documentElement
  return {
    top: 0, left: 0,
    clientH: window.innerHeight, clientW: window.innerWidth,
    max: se.scrollHeight - window.innerHeight,
    scrollW: se.scrollWidth, scrollH: se.scrollHeight,
    winX: 0, winY: 0,
  }
}

/** Живой скролл — дешёвое чтение, layout не форсит. */
export function scrollOf(scroller: HTMLElement | null) {
  return scroller
    ? { sx: scroller.scrollLeft, sy: scroller.scrollTop }
    : { sx: window.scrollX, sy: window.scrollY }
}

export function doScroll(scroller: HTMLElement | null, dx: number, dy: number) {
  if (scroller) {
    if (dy) scroller.scrollTop += dy
    if (dx) scroller.scrollLeft += dx
  } else {
    window.scrollBy(dx, dy)
  }
}

/**
 * Позиция скроллера во вьюпорте СЕЙЧАС: снятая на старте, сдвинутая на то,
 * насколько с тех пор прокрутилось окно. Так покадровый getBoundingClientRect
 * (forced layout!) заменяется на чтение window.scrollX/Y.
 */
export function viewOrigin(geom: ViewGeom, winX: number, winY: number) {
  return { top: geom.top - (winY - geom.winY), left: geom.left - (winX - geom.winX) }
}

/**
 * Скорость авто-скролла: чем дальше указатель за краем контейнера, тем быстрее
 * (до ACCEL× потолка). 0 — если указатель не в краевой зоне либо скроллить некуда.
 */
export function autoScrollSpeed(args: {
  pointerY: number
  viewTop: number
  clientH: number
  scrollY: number
  scrollMax: number
}): number {
  const { pointerY, viewTop, clientH, scrollY, scrollMax } = args
  const distTop = pointerY - viewTop
  const distBot = viewTop + clientH - pointerY

  if (distTop < EDGE && scrollY > 0) {
    const over = (EDGE - distTop) / EDGE       // 0 у границы зоны, 1 у края, >1 за пределами
    return -Math.min(MAX_SPEED * ACCEL, MAX_SPEED * over)
  }
  if (distBot < EDGE && scrollY < scrollMax) {
    const over = (EDGE - distBot) / EDGE
    return Math.min(MAX_SPEED * ACCEL, MAX_SPEED * over)
  }
  return 0
}
