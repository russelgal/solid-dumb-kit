// Чистая геометрия сортировщика: ни DOM, ни Solid — только числа.
// Вынесено из sortableCore, чтобы (а) логику вставки/раскладки можно было
// покрыть тестами (happy-dom не считает layout, живой драг не проверить),
// (б) при переходе на несколько контейнеров эта математика переиспользовалась
// как есть — меняется только то, откуда приходят снимки.

/** позиция ячейки в координатах контента контейнера */
export type Cell = { left: number; top: number; width: number; height: number }

/** чужая ячейка для хиттеста: центры и вертикальные границы */
export type Item = { id: string; cx: number; cy: number; top: number; bottom: number }

/** снятая на старте геометрия скроллера (живыми остаются только scrollTop/Left) */
export type ViewGeom = {
  /** позиция скроллера во вьюпорте на момент старта */
  top: number
  left: number
  clientH: number
  clientW: number
  /** предел прокрутки на старте */
  max: number
  /** скролл окна на момент старта — по нему компенсируем сдвиг контейнера */
  winX: number
  winY: number
}

export const EDGE = 48          // зона авто-скролла у края, px
export const MAX_SPEED = 18     // скорость авто-скролла у самого края, px/кадр
export const ACCEL = 3.5        // во сколько раз быстрее при сильном уходе за контейнер

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

/** Перетаскиваемый не должен выезжать за видимую область контейнера. */
export function clampDragged(args: {
  cell: Cell
  tx: number
  ty: number
  scrollX: number
  scrollY: number
  clientW: number
  clientH: number
  grid: boolean
}): { tx: number; ty: number } {
  const { cell, scrollX, scrollY, clientW, clientH, grid } = args
  const top = Math.max(scrollY, Math.min(scrollY + clientH - cell.height, cell.top + args.ty))
  const ty = top - cell.top
  if (!grid) return { tx: args.tx, ty }
  const left = Math.max(scrollX, Math.min(scrollX + clientW - cell.width, cell.left + args.tx))
  return { tx: left - cell.left, ty }
}

/**
 * Позиция вставки по указателю (индекс в списке БЕЗ перетаскиваемого).
 * Сетка: считаем всех, кто «раньше» по строкам-колонкам; список: кто выше центра.
 */
export function hitIndex(others: Array<Item>, pX: number, pY: number, grid: boolean): number {
  let k = 0
  for (const o of others) {
    if (grid) {
      if (pY > o.bottom) k++                    // указатель ниже всей строки
      else if (pY >= o.top && pX > o.cx) k++    // в той же строке, правее центра
    } else {
      if (pY > o.cy) k++                        // вертикаль: ниже центра
    }
  }
  return k
}

/**
 * Сетка: FLIP-маппинг «элемент → исходная ячейка его нового визуального индекса».
 * Корректно при одинаковых ячейках — для грида это норма.
 */
export function gridLayout(args: {
  ids: Array<string>
  dragId: string
  fromIndex: number
  k: number
  cells: Array<Cell>
}): Array<{ id: string; dx: number; dy: number }> {
  const { ids, dragId, fromIndex, k, cells } = args
  const out: Array<{ id: string; dx: number; dy: number }> = []
  ids.forEach((id, i) => {
    if (id === dragId) return
    const ri = i < fromIndex ? i : i - 1          // индекс в списке без перетаскиваемого
    const newVis = ri < k ? ri : ri + 1           // куда он визуально уезжает
    const cell = cells[newVis], me = cells[i]
    if (!cell || !me) return
    out.push({ id, dx: cell.left - me.left, dy: cell.top - me.top })
  })
  return out
}

/**
 * Вертикальный список: накопительная раскладка по РЕАЛЬНЫМ высотам — поэтому
 * строки разной высоты сдвигаются каждая на своё, а не на усреднённый шаг.
 * На позиции k резервируется дырка под перетаскиваемого.
 */
export function listLayout(args: {
  ids: Array<string>
  dragId: string
  fromIndex: number
  k: number
  cells: Array<Cell>
}): Array<{ id: string; dy: number }> {
  const { ids, dragId, fromIndex, k, cells } = args
  if (!cells.length) return []

  const dragH = cells[fromIndex].height
  const gap = cells.length > 1 ? Math.max(0, cells[1].top - cells[0].top - cells[0].height) : 0
  const out: Array<{ id: string; dy: number }> = []

  let cursor = cells[0].top
  let oi = 0
  for (let v = 0; v < ids.length; v++) {
    if (v === k) { cursor += dragH + gap; continue }   // дырка под перетаскиваемого
    while (ids[oi] === dragId) oi++                    // сам перетаскиваемый пропускается
    const cell = cells[oi]
    const id = ids[oi]
    oi++
    if (cell) {
      out.push({ id, dy: cursor - cell.top })
      cursor += cell.height + gap
    }
  }
  return out
}
