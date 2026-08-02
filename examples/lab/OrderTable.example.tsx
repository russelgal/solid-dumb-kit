// Таблица на CSS order + FLIP: сортировка и перетаскивание строк.
//
// Главная засада таблицы: `order` на `<tr>` не действует. Строки живут в
// табличной модели раскладки, а `order` понимают только flex- и grid-контейнеры.
// Обходится это не хаком, а честной сеткой:
//
//     table          → display: grid; grid-template-columns: <по колонкам>
//     thead/tbody/tr → display: grid; grid-template-columns: subgrid
//
// `subgrid` — то, ради чего он и появился: строки остаются настоящими
// grid-элементами (значит `order` работает), а колонки продолжают выравниваться
// по общей сетке, как в таблице. Семантика разметки при этом не страдает —
// `<table>/<thead>/<tbody>/<tr>/<td>` остаются на месте, для скринридера это
// по-прежнему таблица.
//
// Дальше всё как на соседних вкладках: место строки — это её `order`, позиции
// считаются арифметикой по трём числам, FLIP доигрывает переезд. Приятный
// побочный эффект: анимируется не только драг, но и СОРТИРОВКА по колонке —
// строки разъезжаются по новым местам, и видно, куда именно уехала каждая.
import { createSignal, onCleanup, onMount, For } from 'solid-js'
import { createFlip, createAutoScroller, type Flip } from '@solid-dumb-kit/shared'

type Row = { id: string; name: string; status: string; sum: number; date: string }

const STATUS = ['новый', 'в работе', 'оплачен', 'отменён']
const NAMES = ['Аврора', 'Берег', 'Вектор', 'Гамма', 'Дельта', 'Ель', 'Жемчуг', 'Зенит', 'Исток', 'Кедр']
const ROWS: Array<Row> = Array.from({ length: 40 }, (_, i) => ({
  id: `r${i}`,
  name: `${NAMES[i % NAMES.length]} ${Math.floor(i / NAMES.length) + 1}`,
  status: STATUS[(i * 3) % STATUS.length],
  sum: 1000 + ((i * 7919) % 90000),
  date: `2026-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`,
}))

type SortKey = 'name' | 'status' | 'sum' | 'date'
type Geom = { top: number; step: number }

const money = (v: number) => v.toLocaleString('ru-RU') + ' ₽'

export default function OrderTableExample() {
  // строка → её место (оно же CSS order). Порядок в DOM не меняется НИКОГДА
  const [place, setPlace] = createSignal<Record<string, number>>(
    Object.fromEntries(ROWS.map((r, i) => [r.id, i])),
  )
  const [sort, setSort] = createSignal<{ key: SortKey; desc: boolean } | null>(null)
  const [held, setHeld] = createSignal<string | null>(null)
  const [log, setLog] = createSignal('кликни заголовок или потяни строку за ⠿')

  const rowEls = new Map<string, HTMLElement>()
  let body!: HTMLElement
  let geom: Geom | null = null
  const flip: Flip = createFlip(true)
  const scroller = createAutoScroller()
  onCleanup(() => scroller.stop())

  /** место k по вертикали — строки одинаковой высоты, значит хватает двух чисел */
  const at = (k: number) => (geom ? geom.top + k * geom.step : null)

  /** снимок: на монтировании и на resize, но не во время жеста */
  function measure() {
    const targets = [...rowEls.values()]
    if (!targets.length || typeof IntersectionObserver !== 'function') return
    const rects = new Map<string, DOMRectReadOnly>()
    let batches = 0
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const id = (e.target as HTMLElement).dataset.row
        if (id) rects.set(id, e.boundingClientRect)
      }
      batches++
      if (rects.size < targets.length && batches < 4) return
      io.disconnect()
      const p = place()
      const own = ROWS.map((r) => ({ k: p[r.id], rect: rects.get(r.id) }))
        .filter((x): x is { k: number; rect: DOMRectReadOnly } => Boolean(x.rect))
        .sort((a, b) => a.k - b.k)
      if (own.length < 2) return
      const step = (own[own.length - 1].rect.top - own[0].rect.top) / (own[own.length - 1].k - own[0].k)
      geom = { top: own[0].rect.top - own[0].k * step, step }
    })
    for (const t of targets) io.observe(t)
  }

  onMount(() => {
    measure()
    if (typeof ResizeObserver !== 'function') return
    let first = true
    const ro = new ResizeObserver(() => { if (first) { first = false; return } measure() })
    ro.observe(body)
    onCleanup(() => ro.disconnect())
  })

  /** применить новые места и доиграть переезд */
  function apply(next: Record<string, number>) {
    const prev = place()
    const back: Array<{ el: HTMLElement; dy: number }> = []
    for (const row of ROWS) {
      const el = rowEls.get(row.id)
      if (!el || prev[row.id] === next[row.id]) continue
      const a = at(prev[row.id])
      const b = at(next[row.id])
      if (a === null || b === null) continue
      back.push({ el, dy: a - b })
    }
    setPlace(next)
    for (const m of back) flip.nudge(m.el, 0, m.dy)
  }

  /** порядок строк по местам */
  const seq = () => ROWS.map((r) => r.id).sort((a, b) => place()[a] - place()[b])

  /* ────────── сортировка по колонке ────────── */

  const value = (id: string, key: SortKey) => {
    const r = ROWS.find((x) => x.id === id)!
    return key === 'sum' ? r.sum : r[key]
  }

  const sortBy = (key: SortKey) => {
    const cur = sort()
    const desc = cur?.key === key ? !cur.desc : false
    const ids = seq().slice().sort((a, b) => {
      const x = value(a, key)
      const y = value(b, key)
      const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ru')
      return desc ? -cmp : cmp
    })
    const next: Record<string, number> = {}
    ids.forEach((id, i) => { next[id] = i })
    setSort({ key, desc })
    apply(next)
    setLog(`сортировка: ${key} ${desc ? '↓' : '↑'} — строки разъехались по новым местам`)
  }

  const reset = () => {
    setSort(null)
    const next: Record<string, number> = {}
    ROWS.forEach((r, i) => { next[r.id] = i })
    apply(next)
    setLog('вернули исходный порядок')
  }

  /* ────────── перетаскивание строк ────────── */

  const rowOf = (ev: Event) => (ev.target as HTMLElement | null)?.closest?.('[data-row]') as HTMLElement | null
  let lastY = -1

  /**
   * Куда именно нажали, в `dragstart` уже не узнать: `draggable` стоит на строке,
   * и целью события будет она сама, а не ручка внутри. Поэтому запоминаем цель
   * нажатия заранее — одним делегированным слушателем на всю таблицу.
   */
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
    const el = rowOf(ev)
    const id = el?.dataset.row
    // тянуть можно только за ручку: у таблицы полно своих интерактивных мест
    if (!id || !pressed?.closest?.('[data-drag-handle]')) {
      ev.preventDefault()
      return
    }
    ev.dataTransfer?.setData('text/plain', id)
    if (ev.dataTransfer) {
      ev.dataTransfer.effectAllowed = 'move'
      // картинку переноса задаём явно — иначе браузер снимает её с элемента
      // вместе со всем, что внутри, и за курсором едет лишнее
      ev.dataTransfer.setDragImage(el as HTMLElement, 20, 15)
    }
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
    const id = held()
    if (!id) return
    if (ev.clientY === lastY) return             // рука не двигалась
    lastY = ev.clientY

    const over = rowOf(ev)
    const target = over?.dataset.row
    if (!target || target === id) return
    if (rowEls.get(target)?.getAnimations().length) return   // цель сама едет

    const ids = seq().filter((x) => x !== id)
    ids.splice(place()[target], 0, id)
    const next: Record<string, number> = {}
    ids.forEach((x, i) => { next[x] = i })
    apply(next)
    setLog(`${id} → место ${place()[target]}`)
  }

  const finish = () => {
    gesture = null
    if (!held()) return
    setHeld(null)
    scroller.stop()
  }

  const arrow = (key: SortKey) => {
    const s = sort()
    return s?.key === key ? (s.desc ? ' ↓' : ' ↑') : ''
  }

  return (
    <div
      class="ot-example"
      onPointerDown={remember}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={finish}
      onDrop={(ev) => { ev.preventDefault(); finish() }}
    >
      <h3>Таблица на CSS order + FLIP</h3>
      <p class="note">
        У таблицы своя засада: <code>order</code> на <code>&lt;tr&gt;</code> не действует — строки
        живут в табличной модели раскладки, а <code>order</code> понимают только flex и grid.
        Обходится честно, без хаков: таблица становится <code>display: grid</code>, а{' '}
        <code>thead/tbody/tr</code> — <code>subgrid</code>. Строки снова настоящие grid-элементы
        (значит <code>order</code> работает), колонки продолжают выравниваться по общей сетке, а
        разметка остаётся таблицей — для скринридера ничего не изменилось.
      </p>
      <p class="note">
        <b>Кликни по заголовку</b> — сортировка тоже анимирована: видно, куда уехала каждая строка,
        а не «моргнуло и стало по-другому». <b>Потяни за ⠿</b> — то же самое руками. DOM при этом не
        трогается ни разу: порядок <code>&lt;tr&gt;</code> в разметке всё время исходный.
      </p>
      <div class="bar">
        {log()} <button type="button" onClick={reset}>Исходный порядок</button>
      </div>

      <table class="grid-table">
        <thead>
          <tr>
            <th class="h-drag" />
            <th onClick={() => sortBy('name')}>Название{arrow('name')}</th>
            <th onClick={() => sortBy('status')}>Статус{arrow('status')}</th>
            <th class="num" onClick={() => sortBy('sum')}>Сумма{arrow('sum')}</th>
            <th onClick={() => sortBy('date')}>Дата{arrow('date')}</th>
          </tr>
        </thead>
        <tbody ref={body}>
          <For each={ROWS}>
            {(row) => (
              <tr
                classList={{ held: held() === row.id }}
                data-row={row.id}
                draggable="true"
                ref={(el) => rowEls.set(row.id, el)}
                style={{ order: String(place()[row.id]) }}
              >
                <td class="drag"><span data-drag-handle title="перетащить">⠿</span></td>
                <td>{row.name}</td>
                <td><span class="chip" data-status={row.status}>{row.status}</span></td>
                <td class="num">{money(row.sum)}</td>
                <td class="dim">{row.date}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>

      <style>{`
        .ot-example { padding: 16px 20px; color: var(--color-base-content) }
        .ot-example h3 { margin: 0 0 4px }
        .ot-example .note { margin: 0 0 8px; font-size: 13px; color: var(--color-base-content); max-width: 92ch }
        .ot-example .bar { display: flex; align-items: center; gap: 10px; margin: 8px 0 12px;
                           font-size: 13px; color: var(--color-base-content); min-height: 26px }
        .ot-example .bar button { padding: 5px 10px; font: inherit; font-size: 12.5px; cursor: pointer;
                                  border: 1px solid var(--color-base-300); border-radius: 8px; background: var(--color-base-100) }

        /* ВОТ ОНО: таблица как сетка, строки как subgrid — только так работает order */
        .ot-example .grid-table { display: grid; width: 100%; max-width: 900px;
                                  grid-template-columns: 34px minmax(120px, 1.4fr) 120px 120px 110px;
                                  border-collapse: collapse; font-size: 13.5px }
        .ot-example thead, .ot-example tbody, .ot-example tr {
                                  display: grid; grid-column: 1 / -1;
                                  grid-template-columns: subgrid }
        .ot-example th, .ot-example td { padding: 8px 10px; text-align: left;
                                         border-bottom: 1px solid var(--color-base-200) }
        .ot-example th { position: relative; font-size: 12px; font-weight: 600; color: var(--color-base-content);
                         cursor: pointer; user-select: none; border-bottom: 1px solid var(--color-base-300) }
        .ot-example th.h-drag { cursor: default }
        .ot-example tbody tr { background: var(--color-base-100) }
        .ot-example tbody tr:hover { background: var(--color-base-200) }
        .ot-example tbody tr.held { opacity: .35 }
        .ot-example .drag { color: var(--color-base-content) }
        .ot-example .drag span { cursor: grab }
        .ot-example .drag span:active { cursor: grabbing }
        .ot-example .num { text-align: right; font-variant-numeric: tabular-nums }
        .ot-example .dim { color: var(--color-base-content); font-variant-numeric: tabular-nums }
        .ot-example .chip { padding: 2px 8px; border-radius: 999px; font-size: 11.5px;
                            background: color-mix(in oklch, var(--color-primary) 18%, var(--color-base-100)); color: color-mix(in oklch, var(--color-primary) 50%, var(--color-base-content)) }
        .ot-example .chip[data-status="оплачен"] { background: color-mix(in oklch, var(--color-success) 18%, var(--color-base-100)); color: color-mix(in oklch, var(--color-success) 50%, var(--color-base-content)) }
        .ot-example .chip[data-status="отменён"] { background: color-mix(in oklch, var(--color-error) 18%, var(--color-base-100)); color: color-mix(in oklch, var(--color-error) 50%, var(--color-base-content)) }
        .ot-example .chip[data-status="в работе"] { background: color-mix(in oklch, var(--color-warning) 18%, var(--color-base-100)); color: color-mix(in oklch, var(--color-warning) 50%, var(--color-base-content)) }
      `}</style>
    </div>
  )
}
