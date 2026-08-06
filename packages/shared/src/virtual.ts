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
  /** насколько сдвинуть нарисованное вдоль оси (вниз или вправо), px */
  offset: number
  /** размер распорки, px — НЕ всегда `rows * itemSize`, см. `MAX_SCROLL_HEIGHT` */
  total: number
}

/**
 * Потолок высоты элемента, за которым браузер начинает врать.
 *
 * Высота блока не бесконечна: Chrome обрезает примерно на 33.5 млн px, Firefox
 * — около 17.8 млн, и дальше распорка просто перестаёт расти, а полоса
 * прокрутки — соответствовать содержимому. При строке в 28px это всего ~600
 * тысяч строк на Firefox: миллион строк простой арифметикой уже не берётся.
 *
 * Поэтому распорка зажимается этим числом (с запасом под самый строгий
 * браузер), а прокрутка перестаёт быть один-к-одному: `scrollTop` растягивается
 * до виртуальной высоты списка. Расплата — строки внутри одного «пикселя»
 * полосы перескакивают через несколько позиций; на таких объёмах это ровно то
 * же, что делает нативная полоса прокрутки, только честнее.
 */
export const MAX_SCROLL_HEIGHT = 15_000_000

export type VirtualOptions = {
  /** сколько всего элементов */
  count: () => number
  /** высота строки (или плитки) вместе с зазором, px */
  itemSize: () => number
  /**
   * Размеры рядов поштучно, когда они РАЗНЫЕ. Заявленные, а не измеренные:
   * шахматка знает высоту строки как «этажей × высота этажа», и это по-прежнему
   * арифметика без единого обращения к элементам.
   *
   * Задан — `itemSize` не используется, `columns` игнорируется (сетка плиток
   * разной высоты — другая задача, её здесь нет). Массив должен быть НОВЫМ
   * при изменении: движок узнаёт правку по ссылке, а не по содержимому.
   * Правишь массив на месте — зови `refresh()`.
   */
  itemSizes?: () => ArrayLike<number>
  /** сколько элементов в ряду; 1 — обычный список */
  columns?: () => number
  /**
   * Вдоль какой оси прокрутка. `y` — обычный список, `x` — шкала времени и
   * прочие сетки, едущие вбок: читается `scrollLeft` и ширина видимой части.
   */
  axis?: 'x' | 'y'
  /**
   * Сколько пикселей стоит ПЕРЕД первым рядом внутри того же скроллера:
   * липкая колонка с названиями, шапка, отступ. Без этой поправки окно
   * считается сдвинутым ровно на её размер — на шахматке это полдюжины
   * колонок мимо.
   */
  lead?: () => number
  /** что прокручивается */
  scroller: () => HTMLElement | null
  /**
   * Сколько рядов рисовать сверх видимого — по одному запасному экрану сверху
   * и снизу мало кому мало. Меньше двух рядов брать не стоит: при быстрой
   * прокрутке появляется белая полоса.
   */
  overscan?: number
  /**
   * Потолок высоты распорки, px. По умолчанию `MAX_SCROLL_HEIGHT`; ниже имеет
   * смысл опускать разве что для проверки самого маппинга на коротком списке.
   */
  maxHeight?: number
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
  const horizontal = opts.axis === 'x'
  let viewH = 0
  let raf = 0
  let last: VirtualRange | null = null
  let dead = false

  const el = () => opts.scroller()

  /**
   * Накопленные размеры рядов — то, что заменяет умножение, когда ряды разной
   * высоты. Считается один раз на новый массив размеров: пересчитывать его на
   * каждый кадр прокрутки было бы обиднее любого forced layout.
   */
  let sumsFor: ArrayLike<number> | null = null
  let sums: Float64Array | null = null
  function prefixOf(sizes: ArrayLike<number>): Float64Array {
    if (sumsFor === sizes && sums && sums.length === sizes.length + 1) return sums
    const next = new Float64Array(sizes.length + 1)
    for (let i = 0; i < sizes.length; i++) next[i + 1] = next[i] + Math.max(0, sizes[i])
    sumsFor = sizes
    sums = next
    return next
  }

  function compute(): VirtualRange {
    const sizes = opts.itemSizes?.()
    const size = Math.max(1, opts.itemSize())
    // при поштучных размерах ряд = элемент: раскладывать их ещё и по колонкам
    // некому и незачем
    const cols = sizes ? 1 : Math.max(1, opts.columns?.() ?? 1)
    const count = Math.max(0, opts.count())
    const rows = sizes ? Math.min(count, sizes.length) : Math.ceil(count / cols)
    const prefix = sizes ? prefixOf(sizes) : null
    const node = el()
    const lead = opts.lead?.() ?? 0
    const raw = node ? (horizontal ? node.scrollLeft : node.scrollTop) : 0
    // до начала рядов ещё стоит липкая колонка (или шапка) — её пиксели к
    // рядам отношения не имеют
    const scrolled = Math.max(0, raw - lead)

    /** где начинается ряд */
    const posOf = (row: number) =>
      prefix ? prefix[Math.min(Math.max(0, row), rows)] : row * size
    /** какой ряд накрывает точку: делением или поиском по накопленным суммам */
    const rowAt = (pos: number) => {
      if (!prefix) return Math.floor(pos / size)
      let lo = 0
      let hi = rows
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if (prefix[mid] <= pos) lo = mid
        else hi = mid - 1
      }
      return lo
    }

    // Настоящий размер списка и размер распорки — разные числа, как только
    // список длиннее потолка (см. `MAX_SCROLL_HEIGHT`).
    const real = posOf(rows)
    const total = Math.min(real, Math.max(viewH, opts.maxHeight ?? MAX_SCROLL_HEIGHT))

    // Прокрутка растягивается до настоящего размера: пролистали полполосы —
    // значит, стоим на середине списка. Пока распорка не зажата, коэффициент
    // равен единице и всё сводится к обычному `scrolled`.
    const runwayReal = Math.max(0, real - viewH)
    const runwayFake = Math.max(0, total - viewH)
    const virtual = runwayFake > 0 ? (scrolled * runwayReal) / runwayFake : 0

    // Ряд под верхним краем окна и то, насколько он из-под него выехал: при
    // зажатой распорке `virtual` уже не кратен пикселю полосы, и без этой
    // поправки список дрожал бы на каждый кадр прокрутки.
    const anchorRow = Math.min(Math.max(0, rows - 1), Math.max(0, rowAt(virtual)))
    const inRow = virtual - posOf(anchorRow)

    // Сколько рядов влезает в окно — обычная арифметика по ЗАЯВЛЕННЫМ
    // размерам. Ни одного обращения к элементам.
    const firstRow = Math.max(0, anchorRow - overscan)
    const lastRow = Math.min(rows, rowAt(virtual + viewH) + 1 + overscan)

    return {
      start: firstRow * cols,
      end: Math.min(count, Math.max(firstRow, lastRow) * cols),
      // верх окна (`scrolled`) минус выехавшая часть якорного ряда минус
      // запасные ряды сверху; при незажатой распорке это ровно `posOf(firstRow)`
      offset: scrolled - inRow - (posOf(anchorRow) - posOf(firstRow)),
      total,
    }
  }

  function emit() {
    if (dead) return
    const next = compute()
    // не дёргаем потребителя, пока окно не сдвинулось: при инерционной
    // прокрутке событий больше, чем реальных изменений.
    // `offset` в сравнении обязателен: при зажатой распорке он меняется на
    // каждый пиксель прокрутки, а индексы окна — нет
    if (
      last &&
      last.start === next.start &&
      last.end === next.end &&
      last.offset === next.offset &&
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
    for (const e of entries) viewH = horizontal ? e.contentRect.width : e.contentRect.height
    emit()
  })

  const node = el()
  if (node) {
    // одно чтение на старте, дальше — по RO
    viewH = horizontal ? node.clientWidth : node.clientHeight
    node.addEventListener('scroll', onScroll, { passive: true })
    ro.observe(node)
  }
  emit()

  return {
    refresh: () => {
      last = null
      // размеры рядов могли поправить на месте — считаем суммы заново
      sumsFor = null
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
  /**
   * Сколько всего элементов. Нужно только длинным спискам: без этого числа
   * нельзя понять, зажата ли распорка потолком, и прокрутка к строке
   * промахнётся тем сильнее, чем длиннее список.
   */
  count?: number
  /** потолок высоты распорки; по умолчанию `MAX_SCROLL_HEIGHT` */
  maxHeight?: number
}): number | null {
  const cols = Math.max(1, args.columns ?? 1)
  const row = Math.floor(args.index / cols)
  const top = row * args.itemSize
  const bottom = top + args.itemSize

  // Если распорка зажата, `scrollTop` живёт в сжатых координатах: сравнивать с
  // ним настоящие `top`/`bottom` нельзя, надо сперва разжать прокрутку.
  const rows = args.count == null ? 0 : Math.ceil(Math.max(0, args.count) / cols)
  const real = rows * args.itemSize
  const total = Math.min(real, Math.max(args.viewHeight, args.maxHeight ?? MAX_SCROLL_HEIGHT))
  const runwayReal = Math.max(0, real - args.viewHeight)
  const runwayFake = Math.max(0, total - args.viewHeight)
  const squeezed = runwayReal > runwayFake
  /** настоящая координата → координата полосы прокрутки */
  const toScroll = (y: number) =>
    squeezed ? (Math.max(0, y) * runwayFake) / runwayReal : Math.max(0, y)
  const view = squeezed ? (args.scrollTop * runwayReal) / runwayFake : args.scrollTop

  // просят прижать — прижимаем к ВЕРХНЕМУ краю: так ведёт себя переход к
  // элементу по ссылке, и так его видно целиком вместе с соседями снизу
  if (args.force) return toScroll(top)
  if (top >= view && bottom <= view + args.viewHeight) return null
  // выше окна — ставим строку под верхний край, ниже — под нижний
  if (top < view) return toScroll(top)
  return toScroll(bottom - args.viewHeight)
}
