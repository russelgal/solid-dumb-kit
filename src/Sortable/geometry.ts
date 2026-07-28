// Чистая геометрия сортировщика: ни DOM, ни Solid — только числа.
// Вынесено из sortableCore, чтобы (а) логику вставки/раскладки можно было
// покрыть тестами (happy-dom не считает layout, живой драг не проверить),
// (б) при переходе на несколько контейнеров эта математика переиспользовалась
// как есть — меняется только то, откуда приходят снимки.

// Работа со скроллером/вьюпортом общая с выделением рамкой — живёт в shared.
export {
  viewOrigin, autoScrollSpeed, EDGE, MAX_SPEED, ACCEL, type ViewGeom,
} from '../shared/viewport'

/** позиция ячейки в координатах контента контейнера */
export type Cell = { left: number; top: number; width: number; height: number }

/** чужая ячейка для хиттеста: центры и вертикальные границы */
export type Item = { id: string; cx: number; cy: number; top: number; bottom: number }

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
 * Куда встанет карточка — по ВИДИМЫМ сейчас позициям, а не по снятым.
 *
 * Раскладка уже раздвинула колонку: карточки ниже дырки стоят на holeH+gap ниже
 * своих снятых мест. Если сравнивать курсор со снятыми центрами, дырка
 * перескакивает раньше, чем курсор дошёл до середины видимой карточки (и
 * позже — при движении вверх). Поэтому считаем от текущего k инкрементально:
 *   • вниз  — когда курсор прошёл центр карточки, стоящей сразу ПОД дыркой;
 *   • вверх — когда поднялся выше центра карточки, стоящей сразу НАД ней.
 * Пороги вниз и вверх разнесены ровно на высоту дырки, поэтому на границе
 * ничего не дребезжит — гистерезис получается сам собой.
 */
export function nextInsertIndex(args: {
  /** плотные позиции карточек зоны БЕЗ перетаскиваемой, сверху вниз */
  cells: Array<Cell>
  gap: number
  top: number
  /** высота места, которое занимает перетаскиваемая */
  holeH: number
  /** текущая позиция дырки */
  k: number
  pointerY: number
}): number {
  const { cells, gap, top, holeH, pointerY } = args
  const n = cells.length
  if (!n) return 0

  // позиции в плотной укладке (как если бы дырки не было)
  const pos: number[] = []
  let cursor = top
  for (let i = 0; i < n; i++) { pos.push(cursor); cursor += cells[i].height + gap }

  const shift = holeH + gap
  let k = Math.max(0, Math.min(n, args.k))
  // центр карточки i при дырке на позиции k
  const center = (i: number, at: number) => pos[i] + (i >= at ? shift : 0) + cells[i].height / 2

  // за кадр указатель может пройти несколько карточек — двигаем, пока движется
  for (let guard = 0; guard <= n; guard++) {
    if (k < n && pointerY > center(k, k)) { k++; continue }
    if (k > 0 && pointerY < center(k - 1, k)) { k--; continue }
    break
  }
  return k
}

/** зазор между строками, выведенный из снимка (первые две ячейки) */
export function gapOf(cells: Array<Cell>): number {
  return cells.length > 1 ? Math.max(0, cells[1].top - cells[0].top - cells[0].height) : 0
}

/**
 * Раскладка = СДВИГ БЛОКА строк ровно на место перетаскиваемой.
 *
 * Считаем не «уложим колонку заново», а «кто именно и на сколько уезжает
 * относительно своей СНЯТОЙ позиции». Это принципиально: накопительная укладка
 * (`cursor += высота + зазор`) опирается на один усреднённый зазор, и при
 * субпиксельных высотах каждая следующая строка получает крошечное расхождение
 * со своим настоящим местом — строки дёргаются на пару пикселей уже в момент
 * захвата, когда переставлять ещё нечего. Здесь незатронутые строки получают
 * ровно 0, всегда.
 *
 * Индексы — в списке БЕЗ перетаскиваемой.
 * `from === null` — гость из другой колонки (своего места здесь нет).
 * `to === null` — перетаскиваемую увели в другую колонку, место держим.
 */
export function shiftLayout(args: {
  count: number
  from: number | null
  to: number | null
  /** высота перетаскиваемой вместе с зазором */
  amount: number
}): Array<number> {
  const { count, from, to, amount } = args
  const out = new Array<number>(count).fill(0)
  if (to === null) return out                       // ушла к соседям — здесь ничего не двигается

  if (from === null) {                              // гость: раздвигаем всё от точки вставки
    for (let i = to; i < count; i++) out[i] = amount
    return out
  }
  if (to > from) {                                  // едет вниз: блок между старым и новым местом поднимается
    for (let i = from; i < to; i++) out[i] = -amount
  } else if (to < from) {                           // едет вверх: блок опускается
    for (let i = to; i < from; i++) out[i] = amount
  }
  return out
}

/** Вертикальный список в пределах одной колонки. */
export function listLayout(args: {
  ids: Array<string>
  dragId: string
  fromIndex: number
  k: number
  cells: Array<Cell>
}): Array<{ id: string; dy: number }> {
  const { ids, dragId, fromIndex, k, cells } = args
  if (!cells.length) return []

  const rest = ids.filter(id => id !== dragId)
  const amount = cells[fromIndex].height + gapOf(cells)
  const dy = shiftLayout({ count: rest.length, from: fromIndex, to: k, amount })
  return rest.map((id, i) => ({ id, dy: dy[i] }))
}
