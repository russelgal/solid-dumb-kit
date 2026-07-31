// Чистая математика выделения рамкой: ни DOM, ни Solid — только числа.
//
// Позиции элементов снимаются ОДИН раз (IntersectionObserver, без reflow), а в
// кадре считается пересечение прямоугольника со снимком. Именно этим свой
// движок отличается от @viselect/vanilla, который на каждый move зовёт
// getBoundingClientRect по КАЖДОМУ элементу — сотни forced layout в кадр.

export type Box = { left: number; top: number; width: number; height: number }

/** Как элемент попадает в выделение */
export type IntersectMode =
  /** рамка коснулась элемента */
  | 'touch'
  /** рамка накрыла элемент целиком */
  | 'cover'
  /** рамка накрыла центр элемента */
  | 'center'

/** Прямоугольник по двум точкам — в любом порядке (тянуть можно в любую сторону). */
export function areaFrom(x1: number, y1: number, x2: number, y2: number): Box {
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  }
}

/** границы, за которые рамка не выезжает (координаты контента) */
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number }

/**
 * Прижать точку к границам контейнера.
 *
 * Нужно не только ради вида: рамка — absolute внутри контейнера, и уехав за
 * его пределы она растянула бы scrollWidth/scrollHeight, то есть добавила бы
 * полосы прокрутки прямо во время выделения.
 */
export function clampPoint(x: number, y: number, b: Bounds) {
  return {
    x: Math.min(Math.max(x, b.minX), b.maxX),
    y: Math.min(Math.max(y, b.minY), b.maxY),
  }
}

export function hits(area: Box, cell: Box, mode: IntersectMode): boolean {
  const aRight = area.left + area.width
  const aBottom = area.top + area.height
  const cRight = cell.left + cell.width
  const cBottom = cell.top + cell.height

  if (mode === 'center') {
    const cx = cell.left + cell.width / 2
    const cy = cell.top + cell.height / 2
    return cx >= area.left && cx <= aRight && cy >= area.top && cy <= aBottom
  }
  if (mode === 'cover') {
    return cell.left >= area.left && cRight <= aRight && cell.top >= area.top && cBottom <= aBottom
  }
  return cell.left < aRight && cRight > area.left && cell.top < aBottom && cBottom > area.top
}

/** Индексы ячеек, попавших в рамку. */
export function pickHits(area: Box, cells: Array<Box>, mode: IntersectMode): Array<number> {
  const out: Array<number> = []
  for (let i = 0; i < cells.length; i++) if (hits(area, cells[i], mode)) out.push(i)
  return out
}

/**
 * Итоговое выделение при протяжке рамкой.
 *
 * `additive` — зажат Shift/Cmd/Ctrl: рамка только ДОБАВЛЯЕТ к тому, что было
 * (ничего не снимает — иначе, ведя рамку по уже выделенному, пользователь
 * случайно бы его гасил). Без модификатора прежнее выделение заменяется.
 */
export function resolveSelection<T>(args: {
  /** выделение на момент начала жеста */
  base: Set<T>
  /** что сейчас под рамкой */
  touched: Array<T>
  additive: boolean
}): Set<T> {
  const { base, touched, additive } = args
  if (!additive) return new Set(touched)
  return new Set([...base, ...touched])
}

/**
 * Одиночный клик (без протяжки).
 *
 * `key === null` — попали в пустое место: без модификатора выделение сбрасывается,
 * с модификатором не трогаем (иначе Cmd+клик мимо стирал бы набранное).
 * С модификатором клик по элементу переключает его, без — выделяет только его.
 */
export function tapSelection<T>(args: {
  current: Set<T>
  key: T | null
  additive: boolean
}): Set<T> {
  const { current, key, additive } = args
  if (key === null) return additive ? new Set(current) : new Set()
  if (!additive) return new Set([key])

  const next = new Set(current)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

/** Что изменилось между двумя выделениями — чтобы не трогать лишние классы. */
export function diffSelection<T>(prev: Set<T>, next: Set<T>) {
  const added: Array<T> = []
  const removed: Array<T> = []
  for (const id of next) if (!prev.has(id)) added.push(id)
  for (const id of prev) if (!next.has(id)) removed.push(id)
  return { added, removed }
}
