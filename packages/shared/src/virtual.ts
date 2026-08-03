// Виртуализация: рисуем только то, что видно.
//
// Зачем своя, а не готовая. Все ходовые виртуализаторы меряют элементы —
// `getBoundingClientRect` по строке, чтобы узнать её высоту. Это ровно то, что
// киту запрещено: на тысяче строк такой замер превращается в тысячу forced
// layout. Здесь размер строки ЗАЯВЛЕН заранее, и окно считается арифметикой.
//
// Что читается из DOM и когда:
//
// - геометрия скроллера (высота видимой части) — ОДИН раз на старте и потом
//   только по `ResizeObserver`, то есть когда она правда изменилась;
// - `scrollTop` — покадрово, но это не forced layout: браузер отдаёт его из
//   уже посчитанной раскладки.
//
// Элементы не измеряются НИКОГДА. Отсюда и ограничение: строки одной высоты
// (или сетка одинаковых плиток). Разновысокие списки — это другой примитив с
// другой ценой, и его тут нет намеренно.
//
// Файл не зависит от Solid: движок принимает колбэк и возвращает `destroy`.

export type VirtualRange = {
  /** первый индекс, который надо нарисовать */
  start: number
  /** последний + 1 */
  end: number
  /** насколько сдвинуть нарисованное вниз, px */
  offset: number
  /** высота всего списка, px — под неё растягивается распорка */
  total: number
}

export type VirtualOptions = {
  /** сколько всего элементов */
  count: () => number
  /** высота строки (или плитки) вместе с зазором, px */
  itemSize: () => number
  /** сколько элементов в ряду; 1 — обычный список */
  columns?: () => number
  /** что прокручивается */
  scroller: () => HTMLElement | null
  /**
   * Сколько рядов рисовать сверх видимого — по одному запасному экрану сверху
   * и снизу мало кому мало. Меньше двух рядов брать не стоит: при быстрой
   * прокрутке появляется белая полоса.
   */
  overscan?: number
  /** окно изменилось */
  onChange: (range: VirtualRange) => void
}

export type Virtual = {
  /** пересчитать принудительно: сменилось число элементов или размер строки */
  refresh: () => void
  destroy: () => void
}

export function createVirtualizer(opts: VirtualOptions): Virtual {
  const overscan = opts.overscan ?? 3
  let viewH = 0
  let raf = 0
  let last: VirtualRange | null = null
  let dead = false

  const el = () => opts.scroller()

  function compute(): VirtualRange {
    const size = Math.max(1, opts.itemSize())
    const cols = Math.max(1, opts.columns?.() ?? 1)
    const count = Math.max(0, opts.count())
    const rows = Math.ceil(count / cols)
    const node = el()
    const scrolled = node ? node.scrollTop : 0

    // Сколько рядов пролетело мимо и сколько влезает в окно — обычная
    // арифметика по заявленному размеру. Ни одного обращения к элементам.
    const firstRow = Math.max(0, Math.floor(scrolled / size) - overscan)
    const visibleRows = Math.ceil(viewH / size) + overscan * 2
    const lastRow = Math.min(rows, firstRow + visibleRows)

    return {
      start: firstRow * cols,
      end: Math.min(count, lastRow * cols),
      offset: firstRow * size,
      total: rows * size,
    }
  }

  function emit() {
    if (dead) return
    const next = compute()
    // не дёргаем потребителя, пока окно не сдвинулось: при инерционной
    // прокрутке событий больше, чем реальных изменений
    if (
      last &&
      last.start === next.start &&
      last.end === next.end &&
      last.total === next.total
    ) {
      return
    }
    last = next
    opts.onChange(next)
  }

  /** прокрутка приходит чаще кадра — считаем не чаще кадра */
  function onScroll() {
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      emit()
    })
  }

  const ro = new ResizeObserver((entries) => {
    // `contentRect` считается наблюдателем, а не нашим чтением: forced layout
    // тут не возникает
    for (const e of entries) viewH = e.contentRect.height
    emit()
  })

  const node = el()
  if (node) {
    viewH = node.clientHeight       // одно чтение на старте, дальше — по RO
    node.addEventListener('scroll', onScroll, { passive: true })
    ro.observe(node)
  }
  emit()

  return {
    refresh: () => {
      last = null
      emit()
    },
    destroy: () => {
      dead = true
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
      el()?.removeEventListener('scroll', onScroll)
    },
  }
}

/**
 * Куда прокрутить, чтобы элемент оказался в окне. Отдельно от движка, потому
 * что это чистая арифметика и её удобно проверять тестом.
 *
 * Возвращает `null`, если элемент и так виден: лишняя прокрутка к уже видимой
 * строке выглядит как дёрганье.
 */
export function scrollOffsetFor(args: {
  index: number
  itemSize: number
  columns?: number
  viewHeight: number
  scrollTop: number
  /** прижать к краю, даже если элемент виден */
  force?: boolean
}): number | null {
  const cols = Math.max(1, args.columns ?? 1)
  const row = Math.floor(args.index / cols)
  const top = row * args.itemSize
  const bottom = top + args.itemSize

  // просят прижать — прижимаем к ВЕРХНЕМУ краю: так ведёт себя переход к
  // элементу по ссылке, и так его видно целиком вместе с соседями снизу
  if (args.force) return Math.max(0, top)
  if (top >= args.scrollTop && bottom <= args.scrollTop + args.viewHeight) return null
  // выше окна — ставим строку под верхний край, ниже — под нижний
  if (top < args.scrollTop) return top
  return bottom - args.viewHeight
}
