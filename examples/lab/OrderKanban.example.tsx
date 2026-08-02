// Канбан на том же подходе, что вкладка CSS order + FLIP.
//
// Правило то же: внутри колонки DOM не трогаем — меняется только `order`. А вот
// переезд в соседнюю колонку без перестановки DOM невозможен: `order` живёт
// внутри одного контейнера, у соседнего он свой. Значит карточка физически
// переходит в другой список — и это единственное место, где DOM меняется.
//
// FLIP при этом одинаково доигрывает оба случая, потому что не знает про DOM
// вовсе: ему говорят «стартуй отсюда, приезжай в ноль».
//
// Позиции считаются арифметикой, а не снимаются на каждый шаг. Колонка —
// вертикальная стопка одинаковых карточек, поэтому геометрии зоны хватает трёх
// чисел: где левый край, где верх первого места и какой шаг. Место k — это
// `top + k * step`, а состав колонок на эти три числа не влияет: убрали карточку
// из колонки — места остались на прежних координатах, просто последнее опустело.
import { createSignal, onCleanup, onMount, For } from 'solid-js'
import { createFlip, createAutoScroller, type Flip } from '@solid-dumb-kit/shared'

type Card = { id: string; text: string; tag: string }

const COLS = [
  { id: 'todo', title: 'Надо сделать' },
  { id: 'doing', title: 'В работе' },
  { id: 'review', title: 'На проверке' },
  { id: 'done', title: 'Готово' },
] as const

const TAGS = ['вёрстка', 'бэк', 'дизайн', 'тесты', 'доки']
const CARDS: Array<Card> = Array.from({ length: 28 }, (_, i) => ({
  id: `k${i}`,
  text: `Задача ${i + 1}`,
  tag: TAGS[i % TAGS.length],
}))
const HUE = (i: number) => `oklch(0.75 0.12 ${(i * 47) % 360})`

/** стартовая раскладка: раскидали по колонкам */
const START: Record<string, Array<string>> = {
  todo: CARDS.slice(0, 10).map((c) => c.id),
  doing: CARDS.slice(10, 17).map((c) => c.id),
  review: CARDS.slice(17, 22).map((c) => c.id),
  done: CARDS.slice(22).map((c) => c.id),
}

type Geom = { left: number; top: number; step: number }

export default function OrderKanbanExample() {
  // состав колонок; ПОРЯДОК внутри массива значения не имеет — его задаёт place
  const [board, setBoard] = createSignal<Record<string, Array<string>>>(START)
  // карточка → её место в своей колонке (оно же CSS order)
  const [place, setPlace] = createSignal<Record<string, number>>(
    Object.fromEntries(Object.values(START).flatMap((ids) => ids.map((id, i) => [id, i]))),
  )
  const [held, setHeld] = createSignal<string | null>(null)
  // колонки сортируются тем же способом: у них свой `order`, свои места
  const [colPlace, setColPlace] = createSignal<Record<string, number>>(
    Object.fromEntries(COLS.map((c, i) => [c.id, i])),
  )
  const [heldCol, setHeldCol] = createSignal<string | null>(null)
  const [log, setLog] = createSignal('тащи карточку — или колонку за заголовок')

  const cardEls = new Map<string, HTMLElement>()
  const zoneEls = new Map<string, HTMLElement>()
  const colEls = new Map<string, HTMLElement>()
  /** места самих колонок; при перестановке они не двигаются */
  let colSlots: Array<{ left: number; top: number }> = []
  let geom: Record<string, Geom> = {}
  let flip: Flip = createFlip(true)
  const scroller = createAutoScroller()
  onCleanup(() => scroller.stop())

  /** в какой колонке карточка */
  const zoneOf = (id: string) => {
    const b = board()
    for (const col of COLS) if (b[col.id].includes(id)) return col.id
    return COLS[0].id
  }

  /** экранная позиция места k в колонке z — чистая арифметика по трём числам */
  const at = (z: string, k: number) => {
    const g = geom[z]
    return g ? { left: g.left, top: g.top + k * g.step } : null
  }

  /**
   * Снять геометрию колонок. Делается на монтировании, после дропа и на resize —
   * то есть когда угодно, только НЕ во время жеста. `IntersectionObserver`, а не
   * `getBoundingClientRect`: bounds считаются off-main-thread, без forced layout.
   */
  function measure() {
    const targets = [...cardEls.values(), ...zoneEls.values(), ...colEls.values()]
    if (!targets.length || typeof IntersectionObserver !== 'function') return
    const rects = new Map<Element, DOMRectReadOnly>()
    let batches = 0
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) rects.set(e.target, e.boundingClientRect)
      batches++
      if (rects.size < targets.length && batches < 4) return
      io.disconnect()

      const next: Record<string, Geom> = {}
      const p = place()
      for (const col of COLS) {
        const zoneEl = zoneEls.get(col.id)
        const zoneRect = zoneEl ? rects.get(zoneEl) : undefined
        // места считаем по реальным карточкам колонки: первая даёт начало,
        // вторая — шаг. Пустой колонке хватит её собственного прямоугольника.
        const own = board()[col.id]
          .map((id) => ({ k: p[id], r: cardEls.get(id) ? rects.get(cardEls.get(id)!) : undefined }))
          .filter((x): x is { k: number; r: DOMRectReadOnly } => Boolean(x.r))
          .sort((a, b) => a.k - b.k)
        if (own.length >= 2) {
          const step = (own[own.length - 1].r.top - own[0].r.top) / (own[own.length - 1].k - own[0].k)
          next[col.id] = { left: own[0].r.left, top: own[0].r.top - own[0].k * step, step }
        } else if (own.length === 1 && zoneRect) {
          next[col.id] = { left: own[0].r.left, top: own[0].r.top - own[0].k * (own[0].r.height + 8), step: own[0].r.height + 8 }
        } else if (zoneRect) {
          next[col.id] = { left: zoneRect.left + 10, top: zoneRect.top + 10, step: 64 }
        }
      }
      geom = next

      // места колонок — по их собственным прямоугольникам
      const cp = colPlace()
      const slots: Array<{ left: number; top: number }> = []
      for (const col of COLS) {
        const el = colEls.get(col.id)
        const r = el ? rects.get(el) : undefined
        if (r) slots[cp[col.id]] = { left: r.left, top: r.top }
      }
      if (slots.length === COLS.length) colSlots = slots
    })
    for (const t of targets) io.observe(t)
  }

  onMount(() => {
    measure()
    if (typeof ResizeObserver !== 'function') return
    let first = true
    const ro = new ResizeObserver(() => { if (first) { first = false; return } measure() })
    for (const el of zoneEls.values()) ro.observe(el)
    onCleanup(() => ro.disconnect())
  })

  /**
   * Применить новую раскладку и доиграть переезды. Смещения считаются ДО того,
   * как раскладка станет новой: после неё карточки уже стоят на новых местах.
   */
  function apply(nextBoard: Record<string, Array<string>>, nextPlace: Record<string, number>) {
    const prevBoard = board()
    const prevPlace = place()
    // смещения считаем по МЕСТАМ, а элементы берём после применения: при
    // переезде в соседнюю колонку карточка попадает в другой список, и Solid
    // пересоздаёт её узел — анимация на старом ушла бы в никуда
    const back: Array<{ id: string; dx: number; dy: number }> = []

    for (const card of CARDS) {
      const wasZone = COLS.find((c) => prevBoard[c.id].includes(card.id))?.id
      const nowZone = COLS.find((c) => nextBoard[c.id].includes(card.id))?.id
      if (!wasZone || !nowZone) continue
      if (wasZone === nowZone && prevPlace[card.id] === nextPlace[card.id]) continue
      const a = at(wasZone, prevPlace[card.id])
      const b = at(nowZone, nextPlace[card.id])
      if (!a || !b) continue
      back.push({ id: card.id, dx: a.left - b.left, dy: a.top - b.top })
    }

    setBoard(nextBoard)
    setPlace(nextPlace)
    for (const m of back) {
      const el = cardEls.get(m.id)
      if (el) flip.nudge(el, m.dx, m.dy)
    }
  }

  /** переставить карточку в колонку z на место k (внутри своей или в чужую) */
  function moveTo(id: string, z: string, k: number) {
    const b = board()
    const p = place()
    const from = zoneOf(id)

    // порядок мест словами: сначала выстраиваем колонки по текущим местам
    const seq: Record<string, Array<string>> = {}
    for (const col of COLS) seq[col.id] = b[col.id].slice().sort((x, y) => p[x] - p[y])

    seq[from] = seq[from].filter((x) => x !== id)
    const to = seq[z]
    to.splice(Math.max(0, Math.min(to.length, k)), 0, id)

    const nextBoard: Record<string, Array<string>> = {}
    const nextPlace: Record<string, number> = {}
    for (const col of COLS) {
      nextBoard[col.id] = seq[col.id].slice()
      seq[col.id].forEach((x, i) => { nextPlace[x] = i })
    }
    apply(nextBoard, nextPlace)
    setLog(from === z ? `${id}: место ${p[id]} → ${k}` : `${id}: ${from} → ${z}, место ${k}`)
  }

  /** Переставить колонку на место k. Та же схема: order + FLIP по слотам. */
  function moveCol(id: string, k: number) {
    const cur = colPlace()
    const order = COLS.map((c) => c.id).sort((a, b) => cur[a] - cur[b])
    const from = order.indexOf(id)
    if (from === k) return
    order.splice(k, 0, order.splice(from, 1)[0])
    const next: Record<string, number> = {}
    order.forEach((x, i) => { next[x] = i })

    const back: Array<{ id: string; dx: number; dy: number }> = []
    for (const col of COLS) {
      const a = colSlots[cur[col.id]]
      const b = colSlots[next[col.id]]
      if (!a || !b || (a.left === b.left && a.top === b.top)) continue
      back.push({ id: col.id, dx: a.left - b.left, dy: a.top - b.top })
    }
    setColPlace(next)
    for (const m of back) {
      const el = colEls.get(m.id)
      if (el) flip.nudge(el, m.dx, m.dy)
    }
    setLog(`колонка «${COLS.find((c) => c.id === id)!.title}» → место ${k}`)
  }

  /* ────────── жест: делегированные слушатели на всей доске ────────── */

  const cardOf = (ev: Event) => (ev.target as HTMLElement | null)?.closest?.('[data-card]') as HTMLElement | null
  const zoneOfEv = (ev: Event) => (ev.target as HTMLElement | null)?.closest?.('[data-zone]') as HTMLElement | null
  let lastX = -1
  let lastY = -1

  /** цель последнего нажатия — по ней отличаем «тащат колонку» от «тащат карточку» */
  let pressed: Element | null = null
  const remember = (ev: PointerEvent) => { pressed = ev.target as Element | null }

  /**
   * Синхронный признак «жест идёт». Подсветку источника мы ставим отложенно —
   * иначе полупрозрачность попадёт в картинку переноса, — и если жест успевает
   * закончиться раньше этого тика, отложенный вызов включает её уже ПОСЛЕ
   * уборки. Элемент так и остаётся приглушённым. Флаг это отсекает.
   */
  let gesture: string | null = null

  const onDragStart = (ev: DragEvent) => {
    // страховка: если прошлый жест не прибрал за собой (браузер умеет потерять
    // `dragend`, когда узел пересоздан), снимаем следы на старте нового
    setHeld(null)
    setHeldCol(null)
    // колонку тащат только за заголовок, иначе за неё цеплялось бы пустое поле
    const colEl = (ev.target as HTMLElement | null)?.closest?.('[data-col]') as HTMLElement | null
    if (colEl && !cardOf(ev) && pressed?.closest?.('[data-col-handle]')) {
      const cid = colEl.dataset.col!
      if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
      ev.dataTransfer?.setData('text/plain', cid)
      lastX = ev.clientX
      lastY = ev.clientY
      scroller.start(colEl)
      gesture = cid
    setTimeout(() => { if (gesture === cid) setHeldCol(cid) })
      setLog(`тащим колонку «${COLS.find((c) => c.id === cid)!.title}»`)
      return
    }

    const el = cardOf(ev)
    const id = el?.dataset.card
    if (!id) { ev.preventDefault(); return }
    ev.dataTransfer?.setData('text/plain', id)
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
    lastX = ev.clientX
    lastY = ev.clientY
    scroller.start(el as HTMLElement)
    gesture = id
    setTimeout(() => { if (gesture === id) setHeld(id) })
    setLog(`тащим ${id}`)
  }

  const onDragOver = (ev: DragEvent) => {
    ev.preventDefault()
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move'
    scroller.move(ev.clientX, ev.clientY)

    // тащим колонку — цель тоже колонка
    const dragCol = heldCol()
    if (dragCol) {
      if (ev.clientX === lastX && ev.clientY === lastY) return
      lastX = ev.clientX
      lastY = ev.clientY
      const overCol = (ev.target as HTMLElement | null)?.closest?.('[data-col]') as HTMLElement | null
      const target = overCol?.dataset.col
      if (!target || target === dragCol) return
      if (colEls.get(target)?.getAnimations().length) return
      moveCol(dragCol, colPlace()[target])
      return
    }

    const id = held()
    if (!id) return

    // те же два правила, что в CSS order + FLIP: без движения руки ничего не
    // меняем, и не целимся в карточку, которая сама сейчас едет
    if (ev.clientX === lastX && ev.clientY === lastY) return
    lastX = ev.clientX
    lastY = ev.clientY

    const overCard = cardOf(ev)
    const overZone = zoneOfEv(ev)
    if (!overZone) return
    const z = overZone.dataset.zone!

    if (overCard) {
      const target = overCard.dataset.card!
      if (target === id) return
      if (cardEls.get(target)?.getAnimations().length) return
      const k = place()[target]
      if (zoneOf(id) === z && place()[id] === k) return
      moveTo(id, z, k)
      return
    }
    // пустое место колонки — значит в конец
    if (zoneOf(id) === z) return
    moveTo(id, z, board()[z].length)
  }

  /**
   * Конец жеста. Ловим и `dragend`, и `drop` не для надёжности вообще, а по делу:
   * при переезде в соседнюю колонку карточка попадает в другой список, Solid
   * пересоздаёт её узел — и `dragend`, который браузер шлёт на ИСХОДНЫЙ элемент,
   * до нас уже не доходит. Без `drop` карточка так и осталась бы приглушённой.
   */
  const finish = () => {
    gesture = null
    if (heldCol()) { setHeldCol(null); scroller.stop(); measure(); return }
    if (!held()) return
    setHeld(null)
    scroller.stop()
    measure()                      // состав колонок изменился — освежаем геометрию
  }

  const cardById = (id: string) => CARDS.find((c) => c.id === id)!
  const index = (id: string) => CARDS.findIndex((c) => c.id === id)

  return (
    <div
      class="p-5 text-base-content"
      onPointerDown={remember}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={finish}
      onDrop={(ev) => { ev.preventDefault(); finish() }}
    >
      <h3 class="mb-1 text-lg font-semibold">Канбан на CSS order + FLIP</h3>
      <p class="mb-2 max-w-[90ch] text-[13px] text-base-content">
        <b>Колонки тоже сортируются</b> — тащи за заголовок; у них свой <code>order</code> и свои
        места, механика та же. Внутри колонки DOM не трогается вовсе — меняется только{' '}
        <code>order</code>. Переезд в
        соседнюю колонку без перестановки DOM невозможен (<code>order</code> живёт внутри одного
        контейнера), поэтому там карточка физически переходит в другой список — и это единственное
        место, где DOM меняется за весь жест. FLIP доигрывает оба случая одинаково: он про DOM
        ничего не знает, ему говорят «стартуй отсюда, приезжай в ноль».
      </p>
      <p class="mb-2 max-w-[90ch] text-[13px] text-base-content">
        Позиции не снимаются на каждый шаг: колонка — стопка одинаковых карточек, значит геометрии
        хватает трёх чисел (левый край, верх первого места, шаг). Место <code>k</code> — это{' '}
        <code>top + k * step</code>, и состав колонок на эти три числа не влияет. Снимок обновляется
        только на дропе и на resize — то есть никогда посреди жеста.
      </p>
      <div class="mt-2 mb-3 min-h-[18px] text-[13px] text-base-content">{log()}</div>

      <div class="grid grid-cols-[repeat(4,minmax(200px,1fr))] items-start gap-3.5">
        <For each={COLS}>
          {(col) => (
            <section
              classList={{ 'opacity-35': heldCol() === col.id }}
              data-col={col.id}
              draggable="true"
              ref={(el) => colEls.set(col.id, el)}
              style={{ order: String(colPlace()[col.id]) }}
            >
              <h4 class="mb-2 flex cursor-grab items-center gap-1.5 text-[13px] text-base-content select-none active:cursor-grabbing" data-col-handle>
                <span class="text-base-content">⠿</span>
                {col.title} <span class="rounded-full bg-base-300 px-1.5 py-px text-[11px] text-base-content">{board()[col.id].length}</span>
              </h4>
              {/* сетка в одну колонку: сюда и смотрит order */}
              <div class="grid min-h-30 grid-cols-1 content-start gap-2 rounded-xl bg-base-200 p-2.5 ring-1 ring-base-300" data-zone={col.id} ref={(el) => zoneEls.set(col.id, el)}>
                <For each={board()[col.id]}>
                  {(id) => (
                    <article
                      class="flex cursor-grab flex-col gap-0.5 rounded-box border-l-4 bg-base-100 px-2.5 py-2 shadow-sm ring-1 ring-base-300 active:cursor-grabbing"
                      classList={{ 'opacity-35': held() === id }}
                      data-card={id}
                      draggable="true"
                      ref={(el) => cardEls.set(id, el)}
                      style={{ order: String(place()[id]), 'border-left-color': HUE(index(id)) }}
                    >
                      <span class="text-[13.5px] font-medium">{cardById(id).text}</span>
                      <span class="text-[11.5px] text-base-content">{cardById(id).tag}</span>
                    </article>
                  )}
                </For>
              </div>
            </section>
          )}
        </For>
      </div>

    </div>
  )
}
