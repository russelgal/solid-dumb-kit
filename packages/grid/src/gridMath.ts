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

/** блок со своей позицией — для свободного режима */
export type FreeSpan = GridSpan & { x?: number; y?: number }

/**
 * Как раскладывать:
 *  • `flow`  — по порядку, курсор назад не возвращается (CSS без `dense`);
 *  • `dense` — по порядку, но дырки затыкаются следующими блоками;
 *  • `free`  — каждый блок стоит по своим `x`/`y`, дырки остаются.
 */
export type LayoutMode = 'flow' | 'dense' | 'free'
/** режимы, у которых позиция выводится из порядка массива */
export type FlowMode = 'flow' | 'dense'

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

/**
 * Карта занятых ячеек — одна на обе раскладки. Разреженная (строка → набор
 * колонок), потому что сетка вниз не ограничена: в свободном режиме блок можно
 * увести на двадцатую строку, и заводить под это массив на 20×cols незачем.
 */
function createOccupancy() {
  const busy = new Map<number, Set<number>>()

  const free = (col: number, row: number, w: number, h: number): boolean => {
    for (let r = row; r < row + h; r++) {
      const set = busy.get(r)
      if (!set) continue
      for (let k = col; k < col + w; k++) if (set.has(k)) return false
    }
    return true
  }

  return {
    free,
    take(col: number, row: number, w: number, h: number) {
      for (let r = row; r < row + h; r++) {
        let set = busy.get(r)
        if (!set) busy.set(r, (set = new Set()))
        for (let k = col; k < col + w; k++) set.add(k)
      }
    },
    /** первое свободное место от (col,row): вправо до края, потом строкой ниже */
    findFrom(col: number, row: number, w: number, h: number, cols: number) {
      let c = col
      let r = row
      for (;;) {
        if (c + w > cols) { c = 0; r++; continue }
        if (free(c, r, w, h)) return { col: c, row: r }
        c++
      }
    },
  }
}

/**
 * Ширина «по-человечески»: доля сетки вместо счёта колонок.
 * Числа тоже принимаются — пресет это удобство, а не замена.
 */
export type SpanPreset =
  | 'full'            // вся ширина
  | 'half'            // половина
  | 'third'           // треть
  | 'quarter'         // четверть
  | 'two-thirds'
  | 'three-quarters'
  | `${number}/${number}`   // любая другая доля: '1/6', '5/12', …

export type SpanValue = number | SpanPreset

const PRESETS: Record<string, [number, number]> = {
  full: [1, 1],
  half: [1, 2],
  third: [1, 3],
  quarter: [1, 4],
  'two-thirds': [2, 3],
  'three-quarters': [3, 4],
}

/**
 * Пресет → колонки. Доля округляется ВНИЗ: так N блоков ширины `1/N` всегда
 * влезают в строку, даже когда сетка на доли не делится (`half` при 5 колонках —
 * это 2, а не 3, иначе два таких блока в строку уже не встанут).
 *
 * Неизвестная строка даёт 1 колонку: опечатка в пресете должна бросаться в
 * глаза сразу, а не тихо растягивать блок на всю сетку.
 */
export function resolveSpan(value: SpanValue | undefined, cols: number): number {
  const c = Math.max(1, Math.floor(cols))
  if (value === undefined) return 1
  if (typeof value === 'number') return clamp(Math.round(value) || 1, 1, c)

  const named = PRESETS[value]
  const frac = named ?? (/^\d+\/\d+$/.test(value) ? (value.split('/').map(Number) as [number, number]) : null)
  if (!frac) return 1

  const [num, den] = frac
  if (!den || !Number.isFinite(num)) return 1
  return clamp(Math.floor((c * num) / den), 1, c)
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
 *
 * У блока может быть `minW` — ширина, до которой он согласен ужаться, чтобы
 * влезть в остаток строки вместо переноса вниз. Фактическая ширина при этом
 * НИГДЕ не хранится: она заново выводится из раскладки, поэтому на просторном
 * месте блок сам разворачивается обратно до желаемой.
 */
export function packFlow(
  items: Array<GridSpan & { minW?: number }>,
  cols: number,
  mode: FlowMode = 'flow',
): Array<Placed> {
  const c = Math.max(1, Math.floor(cols))
  const grid = createOccupancy()

  const out: Array<Placed> = []
  let curCol = 0
  let curRow = 0

  for (const it of items) {
    const want = clamp(Math.round(it.w) || 1, 1, c)
    const h = Math.max(1, Math.round(it.h) || 1)
    // dense ищет с самого начала, поэтому затыкает дырки, оставленные широкими
    // блоками; flow идёт от курсора и назад не возвращается (как CSS без dense)
    const fromCol = mode === 'dense' ? 0 : curCol
    const fromRow = mode === 'dense' ? 0 : curRow

    // Блок с `minW` согласен встать УЖЕ желаемого, лишь бы не улетать вниз:
    // перебираем ширины от желаемой к минимальной и берём ту, что встаёт раньше
    // всех. Без `minW` перебор вырождается в один проход — прежнее поведение.
    const min = clamp(Math.round(it.minW ?? want) || 1, 1, want)
    let best: { col: number; row: number; w: number } | null = null
    for (let w = want; w >= min; w--) {
      const spot = grid.findFrom(fromCol, fromRow, w, h, c)
      // раньше — это выше, а на той же строке левее; при равном месте
      // выигрывает первый проверенный, то есть самый широкий
      if (!best || spot.row < best.row || (spot.row === best.row && spot.col < best.col)) {
        best = { col: spot.col, row: spot.row, w }
      }
      if (best.row === fromRow && best.col === fromCol) break   // раньше уже не встанет
    }

    const { col, row, w } = best!
    grid.take(col, row, w, h)
    out.push({ id: it.id, w, h, col, row })
    curCol = col + w
    curRow = row
    if (curCol >= c) { curCol = 0; curRow = row + 1 }
  }
  return out
}

/**
 * Свободная раскладка: блок стоит там, где ему сказано (`x`/`y`), а не там, куда
 * его вынес поток. Это режим «двигай куда хочешь, в том числе вниз, в пустоту» —
 * дырки между блоками остаются дырками.
 *
 * Координаты приходят от потребителя (и из localStorage), поэтому им нельзя
 * доверять: `x` зажимается в сетку, а место, которое уже занято (набор блоков
 * поменялся, `cols` уменьшился, стор вчерашний), разруливается поиском ближайшего
 * свободного НИЖЕ — так блок не исчезает под соседом.
 * Блоки без координат укладываются как в dense-потоке.
 */
export function placeFree(items: Array<FreeSpan>, cols: number): Array<Placed> {
  const c = Math.max(1, Math.floor(cols))
  const grid = createOccupancy()
  const out: Array<Placed> = []

  for (const it of items) {
    const w = clamp(Math.round(it.w) || 1, 1, c)
    const h = Math.max(1, Math.round(it.h) || 1)
    const hasPos = Number.isFinite(it.x) && Number.isFinite(it.y)
    const wantCol = hasPos ? clamp(Math.round(it.x as number), 0, c - w) : 0
    const wantRow = hasPos ? Math.max(0, Math.round(it.y as number)) : 0

    const spot = grid.free(wantCol, wantRow, w, h)
      ? { col: wantCol, row: wantRow }
      : grid.findFrom(hasPos ? wantCol : 0, wantRow, w, h, c)

    grid.take(spot.col, spot.row, w, h)
    out.push({ id: it.id, w, h, col: spot.col, row: spot.row })
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

/**
 * Ячейка под блоком в свободном режиме: пиксельную позицию его левого верхнего
 * угла округляем до ближайшей ячейки и зажимаем в сетку.
 *
 * Считаем по УГЛУ блока, а не по курсору: пользователь тащит блок, значит
 * прилипать должен блок, а не точка захвата — иначе за курсор блок «убегает»
 * на половину своей ширины.
 */
export function pointToCell(args: {
  x: number
  y: number
  w: number
  m: Metrics
}): { col: number; row: number } {
  const { x, y, w, m } = args
  const stepX = m.colW + m.gapX
  const stepY = m.rowH + m.gapY
  const col = stepX > 0 ? Math.round(x / stepX) : 0
  const row = stepY > 0 ? Math.round(y / stepY) : 0
  return {
    col: clamp(col, 0, Math.max(0, m.cols - w)),
    row: Math.max(0, row),
  }
}

/**
 * Первое свободное место под блок заданного размера — куда положить НОВЫЙ блок.
 *
 * В потоковых режимах координаты не нужны (новый блок дописывается в конец
 * массива), а вот в свободном месте его надо выбрать осознанно: иначе добавленный
 * блок либо накрывает соседа, либо уезжает в конец пустоты. Ищем сверху вниз,
 * поэтому «добавить виджет» кладёт его в первую же дырку.
 */
export function firstFreeCell(args: {
  placed: Array<Placed>
  cols: number
  w: number
  h: number
}): { x: number; y: number } {
  const { placed, cols, w, h } = args
  const c = Math.max(1, Math.floor(cols))
  const width = clamp(Math.round(w) || 1, 1, c)
  const height = Math.max(1, Math.round(h) || 1)

  const grid = createOccupancy()
  for (const p of placed) grid.take(p.col, p.row, p.w, p.h)
  const spot = grid.findFrom(0, 0, width, height, c)
  return { x: spot.col, y: spot.row }
}

/** Пересекается ли прямоугольник с кем-то, кроме себя. */
export function overlaps(args: {
  placed: Array<Placed>
  id: string
  col: number
  row: number
  w: number
  h: number
}): boolean {
  const { placed, id, col, row, w, h } = args
  for (const p of placed) {
    if (p.id === id) continue
    if (col < p.col + p.w && p.col < col + w && row < p.row + p.h && p.row < row + h) return true
  }
  return false
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

/**
 * Свободный режим: обрезать желаемый размер до того, что реально свободно.
 *
 * В потоке растущий блок просто расталкивает соседей дальше по порядку, а здесь
 * толкать некого — каждый стоит на своём месте. Поэтому упираемся: сначала
 * отдаём ширину, потом высоту (ширина важнее — сетка колоночная). Если места нет
 * даже под минимум, отдаём минимум: пусть лучше рамка честно перекроет соседа и
 * дроп будет отклонён, чем блок молча схлопнется.
 */
export function fitSpan(args: {
  placed: Array<Placed>
  id: string
  col: number
  row: number
  want: { w: number; h: number }
  limits?: SpanLimits
}): { w: number; h: number } {
  const { placed, id, col, row, want, limits } = args
  const minW = Math.max(1, limits?.minW ?? 1)
  const minH = Math.max(1, limits?.minH ?? 1)

  let w = Math.max(minW, want.w)
  let h = Math.max(minH, want.h)
  while (w > minW && overlaps({ placed, id, col, row, w, h })) w--
  while (h > minH && overlaps({ placed, id, col, row, w, h })) h--
  return { w, h }
}
