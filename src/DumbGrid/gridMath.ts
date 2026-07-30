// Чистая математика колоночного грида: ни DOM, ни Solid — только числа.
//
// Вся суть DumbGrid в том, что размеры блоков ЦЕЛЫЕ (w колонок × h строк), а
// ширина колонки известна из ResizeObserver контейнера. Значит позицию любого
// блока можно ПОСЧИТАТЬ, а не измерить: снимок через IntersectionObserver, как
// в sortableCore, здесь не нужен вовсе — ноль обращений к layout за жест.
//
// Отсюда же берётся расступание соседей: раскладываем порядок дважды (как есть
// и с перетаскиваемым на новом месте) и вычитаем — получаем точные dx/dy для
// transform, включая перенос блока на другую строку.

/** блок в единицах сетки */
export type GridSpan = {
  id: string
  /** ширина в колонках */
  w: number
  /** высота в строках */
  h: number
}

/** блок, которому нашлось место: колонка и строка — нулевые индексы */
export type Placed = GridSpan & { col: number; row: number }

/** метрики сетки в px (colW приходит из ResizeObserver, остальное — пропы) */
export type Metrics = {
  cols: number
  colW: number
  rowH: number
  gapX: number
  gapY: number
}

/** прямоугольник блока в координатах контента контейнера */
export type Rect = { x: number; y: number; width: number; height: number }

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

/** Ширина колонки при заданной ширине контента: остаток после всех зазоров. */
export function colWidth(contentW: number, cols: number, gapX: number): number {
  const c = Math.max(1, Math.floor(cols))
  return Math.max(0, (contentW - gapX * (c - 1)) / c)
}

/** Размер блока шириной n единиц: сами единицы плюс зазоры между ними. */
export function spanSize(n: number, unit: number, gap: number): number {
  return n * unit + (n - 1) * gap
}

/**
 * Раскладка порядка в сетку — та же схема, что у CSS `grid-auto-flow: row`
 * (без `dense`): курсор идёт слева-вниз и назад не возвращается, поэтому
 * порядок блоков виден глазами и совпадает с порядком массива.
 *
 * Результат отдаётся блокам как ЯВНЫЕ `grid-column-start`/`grid-row-start`, а не
 * как auto-flow: браузер тогда не «домысливает» раскладку, и наша арифметика для
 * FLIP гарантированно описывает то, что нарисовано.
 */
export function packFlow(items: Array<GridSpan>, cols: number): Array<Placed> {
  const c = Math.max(1, Math.floor(cols))
  const busy = new Map<number, Set<number>>()   // строка → занятые колонки

  const free = (col: number, row: number, w: number, h: number): boolean => {
    for (let r = row; r < row + h; r++) {
      const set = busy.get(r)
      if (!set) continue
      for (let k = col; k < col + w; k++) if (set.has(k)) return false
    }
    return true
  }
  const take = (col: number, row: number, w: number, h: number) => {
    for (let r = row; r < row + h; r++) {
      let set = busy.get(r)
      if (!set) busy.set(r, (set = new Set()))
      for (let k = col; k < col + w; k++) set.add(k)
    }
  }

  const out: Array<Placed> = []
  let curCol = 0
  let curRow = 0

  for (const it of items) {
    const w = clamp(Math.round(it.w) || 1, 1, c)
    const h = Math.max(1, Math.round(it.h) || 1)
    let col = curCol
    let row = curRow
    // ищем первое место от курсора: вправо до края строки, потом строкой ниже
    for (;;) {
      if (col + w > c) { col = 0; row++; continue }
      if (free(col, row, w, h)) break
      col++
    }
    take(col, row, w, h)
    out.push({ id: it.id, w, h, col, row })
    curCol = col + w
    curRow = row
    if (curCol >= c) { curCol = 0; curRow = row + 1 }
  }
  return out
}

/** Сколько строк занимает раскладка — нужно для min-height контейнера. */
export function rowCount(placed: Array<Placed>): number {
  let n = 0
  for (const p of placed) n = Math.max(n, p.row + p.h)
  return n
}

/** Прямоугольник блока в px. */
export function cellRect(p: Placed, m: Metrics): Rect {
  return {
    x: p.col * (m.colW + m.gapX),
    y: p.row * (m.rowH + m.gapY),
    width: spanSize(p.w, m.colW, m.gapX),
    height: spanSize(p.h, m.rowH, m.gapY),
  }
}

/** Переставить элемент массива, не мутируя исходный. */
export function reorder<T>(list: Array<T>, from: number, to: number): Array<T> {
  const next = list.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/**
 * Позиция вставки по указателю — индекс в списке БЕЗ перетаскиваемого.
 *
 * Считаем по ИСХОДНОЙ раскладке (той, что была на старте жеста), а не по
 * разъехавшейся: пороги тогда стоят на месте и дырка не дребезжит на границе.
 * Логика чтения та же, что у сортировщика-сетки: блок «раньше» указателя, если
 * он целиком выше него либо в той же полосе и левее его центра.
 */
export function insertIndex(args: {
  /** исходная раскладка всех блоков, в порядке массива */
  base: Array<Placed>
  dragId: string
  m: Metrics
  pointerX: number
  pointerY: number
}): number {
  const { base, dragId, m, pointerX, pointerY } = args
  let k = 0
  for (const p of base) {
    if (p.id === dragId) continue
    const r = cellRect(p, m)
    if (pointerY > r.y + r.height) k++
    else if (pointerY >= r.y && pointerX > r.x + r.width / 2) k++
  }
  return k
}

/**
 * Насколько каждый блок уезжает от своего места — вычитанием двух раскладок.
 * Перетаскиваемый исключён: он следует за курсором и своим transform живёт сам.
 */
export function moveDeltas(args: {
  base: Array<Placed>
  next: Array<Placed>
  m: Metrics
  skipId?: string
}): Array<{ id: string; dx: number; dy: number }> {
  const { base, next, m, skipId } = args
  const to = new Map<string, Placed>()
  for (const p of next) to.set(p.id, p)

  const out: Array<{ id: string; dx: number; dy: number }> = []
  for (const p of base) {
    if (p.id === skipId) continue
    const t = to.get(p.id)
    if (!t) continue
    if (t.col === p.col && t.row === p.row) { out.push({ id: p.id, dx: 0, dy: 0 }); continue }
    const a = cellRect(p, m)
    const b = cellRect(t, m)
    out.push({ id: p.id, dx: b.x - a.x, dy: b.y - a.y })
  }
  return out
}

/** пределы размера блока в единицах сетки */
export type SpanLimits = {
  minW?: number
  maxW?: number
  minH?: number
  maxH?: number
}

/**
 * Новый размер блока при ресайзе: пиксельную дельту переводим в единицы сетки и
 * округляем к ближайшей. Никаких замеров — только start-размер и dx/dy курсора.
 */
export function snapSpan(args: {
  start: { w: number; h: number }
  dx: number
  dy: number
  m: Metrics
  limits?: SpanLimits
}): { w: number; h: number } {
  const { start, dx, dy, m, limits } = args
  const stepX = m.colW + m.gapX
  const stepY = m.rowH + m.gapY
  const lim = limits ?? {}

  const w = stepX > 0
    ? Math.round((spanSize(start.w, m.colW, m.gapX) + dx + m.gapX) / stepX)
    : start.w
  const h = stepY > 0
    ? Math.round((spanSize(start.h, m.rowH, m.gapY) + dy + m.gapY) / stepY)
    : start.h

  return {
    w: clamp(w, Math.max(1, lim.minW ?? 1), Math.min(m.cols, lim.maxW ?? m.cols)),
    h: clamp(h, Math.max(1, lim.minH ?? 1), lim.maxH ?? Number.MAX_SAFE_INTEGER),
  }
}
