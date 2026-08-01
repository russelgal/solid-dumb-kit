// Сортировка списка и сетки на нативном drag-and-drop.
//
// Устроено так же, как `@solid-dumb-kit/board`, и по той же причине: порядок
// меняется СРАЗУ, на каждом шаге, а не копится внутри до отпускания.
//
// Копить было ошибкой. Коммит тогда висит на событии `drop`, а браузер
// доставляет его не всегда: при быстром движении Chrome глотает `dragover`, и
// без свежего дроп не считается состоявшимся — особенно при автопрокрутке, где
// курсор стоит и событий почти нет. Пользователь видит, как соседи расступались,
// отпускает — и порядок прежний. Различить это по `dropEffect` нельзя: у
// несостоявшегося дропа он `none`, ровно как у отменённого жеста.
//
// Когда порядок меняется сразу, терять нечего: `drop` ничего не решает, а
// `dragend` только прибирает. Заодно данные потребителя всё время совпадают с
// тем, что на экране.
//
// Место вставки мы не считаем: зона приёма висит на каждом элементе, и
// `dragover` приходит ровно на тот, над которым указатель.
//
// Тач не поддерживается: HTML5 DnD там не существует. Для пальца — `DumbSortable`.

import { createAutoScroller, createFlip, shouldAnimate, type Flip } from '@solid-dumb-kit/shared'

export type SortDndOptions = {
  /** текущий порядок id — совпадает с порядком данных */
  order: () => Array<string>
  /** `y` — вертикальный список (по умолчанию), `grid` — двумерная сетка плиток */
  axis?: () => 'y' | 'grid'
  /** перетаскивание запрещено */
  disabled?: () => boolean
  /** анимировать расступание; по умолчанию да, но не при prefers-reduced-motion */
  animate?: boolean
  /**
   * Переставить ПРЯМО СЕЙЧАС, посреди жеста. Источник истины — данные
   * потребителя, поэтому движок ничего не переставляет сам.
   */
  onMove?: (fromIndex: number, toIndex: number) => void
  /** жест закончен: откуда и куда переехал элемент — для персиста */
  onEnd?: (fromIndex: number, toIndex: number) => void
  /** id элемента, который тащат (null — жеста нет) */
  onActive?: (id: string | null) => void
}

export type SortDndEngine = {
  /** ref на контейнер */
  attachContainer: (el: HTMLElement) => () => void
  /** ref на элемент; ручка — дочка с [data-drag-handle] */
  attach: (el: HTMLElement, id: string) => () => void
  active: () => string | null
  destroy: () => void
}

type Slot = { left: number; top: number }

export function createSortDndEngine(opts: SortDndOptions): SortDndEngine {
  const els = new Map<string, HTMLElement>()
  let container: HTMLElement | null = null
  let flip: Flip | null = null
  const scroller = createAutoScroller()

  /** кого тащат и откуда начали — для `onEnd` и отмены */
  /** сколько ждать признака отмены после `dragend` — полтора кадра */
  const SETTLE_MS = 24

  let dragId: string | null = null
  let stopRo: (() => void) | null = null
  let startIndex = -1
  /** нажали Escape — вернуть на место */
  let escaped = false

  /**
   * Геометрия мест. Снимается ОДИН раз на старте жеста: `IntersectionObserver`
   * считает bounds off-main-thread, forced layout не случается даже на трёхстах
   * строках.
   *
   * Высоты хранятся ПО ЭЛЕМЕНТАМ, а не по местам: строки бывают разной высоты, и
   * место k — это сумма высот тех, кто стоит до него.
   */
  let sizes = new Map<string, number>()
  let origin: Slot = { left: 0, top: 0 }
  /** сетка: места равные, поэтому хватает шага и числа колонок */
  let grid: { stepX: number; stepY: number; cols: number } | null = null

  const isGrid = () => opts.axis?.() === 'grid'
  const indexOf = (id: string) => opts.order().indexOf(id)

  /** где лежит место k при заданном порядке */
  function slotAt(order: Array<string>, k: number): Slot {
    if (grid) {
      return {
        left: origin.left + (k % grid.cols) * grid.stepX,
        top: origin.top + Math.floor(k / grid.cols) * grid.stepY,
      }
    }
    let top = origin.top
    for (let i = 0; i < k && i < order.length; i++) top += sizes.get(order[i]) ?? 0
    return { left: origin.left, top }
  }

  /** сняты ли места хоть раз — до первого замера жест просто ничего не двигает */
  let measured = false

  function measure() {
    const ids = opts.order()
    const targets = ids.map((id) => els.get(id)).filter(Boolean) as Array<HTMLElement>
    if (!targets.length || typeof IntersectionObserver !== 'function') return

    const rects = new Map<string, DOMRectReadOnly>()
    let batches = 0
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const id = (e.target as HTMLElement).dataset.sortDndId
        if (id) rects.set(id, e.boundingClientRect)
      }
      batches++
      // наблюдатель не обязан прислать всё одним батчем — ждём каждую цель, но
      // не бесконечно: молчащая (display:none) не должна вешать жест
      if (rects.size < targets.length && batches < 4) return
      io.disconnect()

      const list = ids.map((id) => rects.get(id))
      const first = list.find(Boolean)
      if (!first) return
      origin = { left: first.left, top: first.top }

      // зазор берём из первой пары соседей: он один на всех
      let gap = 0
      for (let i = 1; i < list.length; i++) {
        const a = list[i - 1]
        const b = list[i]
        if (!a || !b || b.top <= a.top) continue
        gap = Math.max(0, b.top - (a.top + a.height))
        break
      }

      if (isGrid()) {
        // шаг по X — первая пара из одной строки, по Y — из соседних
        let stepX = first.width + gap
        let stepY = first.height + gap
        let cols = 1
        for (let i = 1; i < list.length; i++) {
          const r = list[i]
          if (!r) continue
          if (r.top > first.top + 1) { stepY = r.top - first.top; cols = i; break }
          stepX = (r.left - first.left) / i
        }
        grid = { stepX, stepY, cols: Math.max(1, cols) }
      } else {
        grid = null
        sizes = new Map(ids.map((id, i) => [id, (list[i]?.height ?? 0) + gap]))
      }
      measured = true
    })
    for (const t of targets) io.observe(t)
  }

  /**
   * Переставить и доиграть движение. Смещения считаются ДО перестановки: после
   * неё элементы уже стоят на новых местах, остаётся стартовать их со старых.
   *
   * Элементы берём из карты ПОСЛЕ смены: если потребитель отдаст новые объекты,
   * фреймворк пересоздаст узлы, и анимация на старых ушла бы в никуда.
   */
  function commit(from: number, to: number) {
    const was = opts.order()
    const next = was.slice()
    next.splice(to, 0, next.splice(from, 1)[0])

    const back: Array<{ id: string; dx: number; dy: number }> = []
    for (let i = 0; i < was.length; i++) {
      const id = was[i]
      const a = slotAt(was, i)
      const b = slotAt(next, next.indexOf(id))
      if (a.left === b.left && a.top === b.top) continue
      back.push({ id, dx: a.left - b.left, dy: a.top - b.top })
    }

    opts.onMove?.(from, to)
    for (const m of back) {
      const el = els.get(m.id)
      if (el) flip?.nudge(el, m.dx, m.dy)
    }
  }

  /* ────────── жест ────────── */

  const idOf = (ev: Event) => {
    const el = (ev.target as HTMLElement | null)?.closest?.('[data-sort-dnd-id]') as HTMLElement | null
    return el?.dataset.sortDndId ?? null
  }

  /** цель последнего нажатия — по ней решаем, тянут ли за ручку */
  let pressed: Element | null = null
  const remember = (ev: PointerEvent) => { pressed = ev.target as Element | null }
  if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', remember, { capture: true, passive: true })
  }

  // Escape во время нативного драга до страницы НЕ ДОХОДИТ: клавиатуру забирает
  // себе сам механизм переноса, и `keydown` мы не увидим никогда. Долетает
  // только `keyup` — и уже после `dragend`, примерно через миллисекунду. Отсюда
  // и отложенный итог в `finish`.
  const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') escaped = true }

  let lastX = -1
  let lastY = -1

  const onDragStart = (ev: DragEvent) => {
    if (opts.disabled?.()) { ev.preventDefault(); return }
    const el = (ev.target as HTMLElement | null)?.closest?.('[data-sort-dnd-id]') as HTMLElement | null
    const id = el?.dataset.sortDndId
    if (!id) return

    // Ручка: `draggable` стоит на элементе, поэтому целью события будет он сам,
    // а не ручка внутри — куда нажали, знает только запомненный `pointerdown`.
    const handle = el!.querySelector('[data-drag-handle]')
    if (handle && !(pressed && handle.contains(pressed))) { ev.preventDefault(); return }

    const from = indexOf(id)
    if (from < 0) { ev.preventDefault(); return }

    ev.dataTransfer?.setData('text/plain', id)   // без него жест не начнётся в Firefox
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'

    dragId = id
    startIndex = from
    escaped = false
    lastX = ev.clientX
    lastY = ev.clientY
    flip = createFlip(shouldAnimate(opts.animate))
    opts.onActive?.(id)
    // Прятать оригинал нельзя: `visibility: hidden` лишает его событий `drag`,
    // а на них держится автопрокрутка. Глушим прозрачностью.
    el!.style.opacity = '0.35'
    scroller.start(container ?? el!)
    // Замер уже есть — со старта или с прошлой перерисовки. Снимаем заново
    // только если его нет вовсе: наблюдатель асинхронный, и ждать его на первом
    // же движении значит потерять начало анимации.
    if (!measured) measure()
  }

  const onDragOver = (ev: DragEvent) => {
    ev.preventDefault()                       // без этого не будет `drop`
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move'
    const id = dragId
    if (!id) return
    scroller.move(ev.clientX, ev.clientY)

    // Курсор обязан реально сдвинуться. Пока элементы едут, браузер шлёт
    // `dragover` и при неподвижной мыши, а хиттест идёт по ВИДИМОЙ картинке —
    // под курсор попадает то одно, то другое, и порядок дёргается сам.
    if (ev.clientX === lastX && ev.clientY === lastY) return
    lastX = ev.clientX
    lastY = ev.clientY

    // Над самим собой пересчитывать нечего. Промах — это зазор сетки, дырка в
    // хиттесте, а не приглашение уехать в конец списка.
    const over = idOf(ev)
    if (!over || over === id) return
    if (els.get(over)?.getAnimations().length) return   // цель сама едет

    const order = opts.order()
    const cur = order.indexOf(id)
    const t = order.indexOf(over)
    if (cur < 0 || t < 0 || cur === t) return
    commit(cur, t)
  }

  /**
   * Конец жеста. Порядок уже применён — прибираем и, если отменили, возвращаем.
   * Пришёл `drop` или нет, не имеет значения: терять нечего.
   */
  const finish = () => {
    const id = dragId
    if (!id) return
    dragId = null
    scroller.stop()
    opts.onActive?.(null)

    const el = els.get(id)

    // Итог подводим не сразу, а через кадр: признак отмены (`keyup` от Escape)
    // приходит ПОСЛЕ `dragend`, и решать в самом `dragend` попросту рано.
    // По `dropEffect` отмену не отличить — у недоставленного дропа он тоже
    // `none`, и раньше именно на этом жест молча откатывался.
    setTimeout(() => {
      const cur = indexOf(id)
      if (escaped && cur >= 0 && cur !== startIndex) commit(cur, startIndex)
      else if (cur >= 0 && cur !== startIndex) opts.onEnd?.(startIndex, cur)

      // сдвиги снимаем следующим кадром: к этому моменту раскладка уже новая, и
      // снятие проходит незаметно, а не рывком через старые места
      requestAnimationFrame(() => {
        flip?.clear()
        flip = null
        if (el) el.style.opacity = ''
      })
    }, SETTLE_MS)
  }

  const onDrop = (ev: DragEvent) => { ev.preventDefault(); finish() }

  return {
    attachContainer(el: HTMLElement) {
      // ВСЕ слушатели жеста — здесь, четыре штуки на любое число элементов
      // Места снимаем на монтировании и на смене размеров — как в пробе
      // `CssOrder`, а не на каждом жесте: раскладка между жестами не меняется,
      // а триста наблюдений на старте каждого драга не бесплатны.
      if (typeof ResizeObserver === 'function') {
        const ro = new ResizeObserver(() => { measured = false; measure() })
        ro.observe(el)
        stopRo = () => ro.disconnect()
      }

      el.addEventListener('dragstart', onDragStart)
      el.addEventListener('dragover', onDragOver)
      el.addEventListener('drop', onDrop)
      el.addEventListener('dragend', finish)
      document.addEventListener('keyup', onKey)
      container = el
      return () => {
        el.removeEventListener('dragstart', onDragStart)
        el.removeEventListener('dragover', onDragOver)
        el.removeEventListener('drop', onDrop)
        el.removeEventListener('dragend', finish)
        document.removeEventListener('keyup', onKey)
        stopRo?.()
        stopRo = null
        if (container === el) container = null
      }
    },

    attach(el: HTMLElement, id: string) {
      els.set(id, el)
      el.dataset.sortDndId = id
      // атрибутом, а не свойством: свойство отражается в атрибут только в
      // настоящем браузере, а в happy-dom (тесты) — нет
      el.setAttribute('draggable', 'true')

      return () => {
        el.removeAttribute('draggable')
        delete el.dataset.sortDndId
        if (els.get(id) === el) els.delete(id)
      }
    },

    active: () => dragId,
    destroy() {
      finish()
      if (typeof document !== 'undefined') {
        document.removeEventListener('pointerdown', remember, true)
      }
      els.clear()
    },
  }
}
