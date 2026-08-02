// Проба-сравнение: а нельзя ли просто мерить позиции до и после?
//
// Вопрос честный. Классический FLIP так и описан: замерил (First), поменял
// раскладку (Last), вычел, поставил обратный сдвиг (Invert), отпустил (Play).
// Здесь оба способа стоят рядом на одной колоде, и переключатель сравнивает их
// на живом жесте:
//
//   • «замер до/после» — как в учебнике: читаем `getBoundingClientRect` у всех
//     карточек, меняем `order`, читаем ещё раз. Второе чтение обязано
//     дождаться пересчёта раскладки — это forced layout, и он синхронный;
//   • «снимок мест раз» — как на вкладке CSS order + FLIP: позиции мест сняты
//     один раз через IntersectionObserver, а смещение считается вычитанием.
//
// Разница видна прямо в цифрах на панели: сколько замеров и сколько миллисекунд
// стоила ОДНА перекладка. Умножь на частоту `dragover` — это и есть цена.
import { createSignal, createEffect, onCleanup, onMount, For } from 'solid-js'
import { createFlip, createAutoScroller, type Flip } from '@solid-dumb-kit/shared'

const N = 200
const CARDS = Array.from({ length: N }, (_, i) => i)
const HUE = (i: number) => `oklch(0.75 0.12 ${(i * 41) % 360})`

type Mode = 'live' | 'snapshot'
type Slot = { left: number; top: number }

export default function FlipBenchExample() {
  const [pos, setPos] = createSignal<Array<number>>(CARDS.slice())
  const [mode, setMode] = createSignal<Mode>('live')
  const [last, setLast] = createSignal({ reads: 0, ms: 0 })
  const [run, setRun] = createSignal({ steps: 0, reads: 0, ms: 0 })

  const els: Array<HTMLElement | undefined> = []
  let box!: HTMLDivElement
  let slots: Array<Slot> = []
  let flip: Flip = createFlip(true)
  createEffect(() => { flip = createFlip(true) })

  const scroller = createAutoScroller()
  onCleanup(() => scroller.stop())

  /** снимок мест — только для режима «снимок раз» */
  function measure() {
    const targets = els.filter(Boolean) as Array<HTMLElement>
    if (!targets.length || typeof IntersectionObserver !== 'function') return
    const rects = new Map<number, DOMRectReadOnly>()
    let batches = 0
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const i = Number((e.target as HTMLElement).dataset.card)
        rects.set(i, e.boundingClientRect)
      }
      batches++
      if (rects.size < targets.length && batches < 4) return
      io.disconnect()
      const cur = pos()
      const next: Array<Slot> = []
      for (const [i, r] of rects) next[cur[i]] = { left: r.left, top: r.top }
      slots = next
    })
    for (const t of targets) io.observe(t)
  }

  onMount(() => {
    measure()
    if (typeof ResizeObserver !== 'function') return
    let first = true
    const ro = new ResizeObserver(() => { if (first) { first = false; return } measure() })
    ro.observe(box)
    onCleanup(() => ro.disconnect())
  })

  const note = (reads: number, ms: number) => {
    setLast({ reads, ms })
    setRun((r) => ({ steps: r.steps + 1, reads: r.reads + reads, ms: r.ms + ms }))
  }

  /**
   * Учебный FLIP. Обрати внимание на порядок: читаем всё пачкой, потом пишем,
   * потом снова читаем пачкой. Иначе (чтение-запись-чтение поэлементно) вместо
   * двух пересчётов раскладки получится двести.
   */
  function applyLive(next: Array<number>) {
    const t0 = performance.now()
    const before: Array<Slot> = []
    for (let i = 0; i < N; i++) {
      const el = els[i]
      if (!el) continue
      const r = el.getBoundingClientRect()
      before[i] = { left: r.left, top: r.top }
    }

    setPos(next)                       // раскладка поменялась — layout «грязный»

    const after: Array<Slot> = []
    for (let i = 0; i < N; i++) {
      const el = els[i]
      if (!el) continue
      const r = el.getBoundingClientRect()   // ← вот здесь браузер обязан пересчитать
      after[i] = { left: r.left, top: r.top }
    }
    const ms = performance.now() - t0

    for (let i = 0; i < N; i++) {
      const el = els[i]
      const a = before[i]
      const b = after[i]
      if (!el || !a || !b) continue
      const dx = a.left - b.left
      const dy = a.top - b.top
      if (dx || dy) flip.nudge(el, dx, dy)
    }
    note(N * 2, ms)
  }

  /** То же самое, но по снятому один раз снимку мест: чтений ноль. */
  function applySnapshot(next: Array<number>) {
    const t0 = performance.now()
    const cur = pos()
    const back: Array<{ el: HTMLElement; dx: number; dy: number }> = []
    for (let i = 0; i < N; i++) {
      const el = els[i]
      const a = slots[cur[i]]
      const b = slots[next[i]]
      if (!el || !a || !b) continue
      const dx = a.left - b.left
      const dy = a.top - b.top
      if (dx || dy) back.push({ el, dx, dy })
    }
    setPos(next)
    for (const m of back) flip.nudge(m.el, m.dx, m.dy)
    note(0, performance.now() - t0)
  }

  const apply = (next: Array<number>) => (mode() === 'live' ? applyLive(next) : applySnapshot(next))

  /* ── жест: делегированные слушатели, как везде ── */
  const [held, setHeld] = createSignal<number | null>(null)
  const seq = () => { const s: Array<number> = []; pos().forEach((p, i) => { s[p] = i }); return s }
  const cardOf = (ev: Event) => {
    const el = (ev.target as HTMLElement | null)?.closest?.('[data-card]') as HTMLElement | null
    return el ? Number(el.dataset.card) : null
  }
  let lastX = -1
  let lastY = -1

  const onDragStart = (ev: DragEvent) => {
    const i = cardOf(ev)
    if (i === null) return
    ev.dataTransfer?.setData('text/plain', String(i))
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
    lastX = ev.clientX
    lastY = ev.clientY
    setRun({ steps: 0, reads: 0, ms: 0 })
    scroller.start(box)
    setTimeout(() => setHeld(i))
  }

  const onDragOver = (ev: DragEvent) => {
    ev.preventDefault()
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move'
    scroller.move(ev.clientX, ev.clientY)
    const i = cardOf(ev)
    const from = held()
    if (i === null || from === null || from === i) return
    if (ev.clientX === lastX && ev.clientY === lastY) return
    lastX = ev.clientX
    lastY = ev.clientY
    if (els[i]?.getAnimations().length) return

    const s = seq()
    s.splice(pos()[i], 0, s.splice(pos()[from], 1)[0])
    const next: Array<number> = []
    s.forEach((card, place) => { next[card] = place })
    apply(next)
  }

  const shuffle = () => {
    const next = pos().slice()
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[next[i], next[j]] = [next[j], next[i]]
    }
    setRun({ steps: 0, reads: 0, ms: 0 })
    apply(next)
  }
  const reset = () => { setRun({ steps: 0, reads: 0, ms: 0 }); apply(CARDS.slice()) }

  const ms = (v: number) => `${v.toFixed(2)} мс`

  return (
    <div class="p-5 text-base-content">
      <h3 class="mb-1 text-lg font-semibold">Замер на лету против снимка — сколько стоит «просто померить»</h3>
      <p class="mb-2 max-w-[90ch] text-[13px] text-base-content">
        Оба способа дают одинаковую картинку, отличается цена. <b>Замер до/после</b> — учебный FLIP:
        прочитать <code>getBoundingClientRect</code> у всех карточек, поменять <code>order</code>,
        прочитать снова. Второе чтение обязано дождаться новой раскладки, то есть это{' '}
        <b>forced layout</b>, синхронный, в обработчике события. <b>Снимок мест</b> — как на вкладке
        CSS order + FLIP: позиции сняты один раз через <code>IntersectionObserver</code>, смещение
        считается вычитанием, чтений ноль.
      </p>
      <p class="mb-2 max-w-[90ch] text-[13px] text-base-content">
        Тащи карточку и следи за панелью: цифры — про ОДНУ перекладку, а их за жест столько, сколько
        раз ты пересёк соседа. Переключи режим и протащи так же.
      </p>

      <div class="my-3 flex flex-wrap items-center gap-3.5 [&_label]:flex [&_label]:items-center [&_label]:gap-1.5 [&_label]:text-[13px] [&_button]:cursor-pointer [&_button]:rounded-lg [&_button]:border [&_button]:border-base-300 [&_button]:bg-base-100 [&_button]:px-3 [&_button]:py-1.5 [&_button]:text-[13px]">
        <label>
          <input type="radio" name="fb" checked={mode() === 'live'} onChange={() => setMode('live')} />
          замер до/после (учебный FLIP)
        </label>
        <label>
          <input type="radio" name="fb" checked={mode() === 'snapshot'} onChange={() => setMode('snapshot')} />
          снимок мест один раз
        </label>
        <button type="button" onClick={shuffle}>Перемешать</button>
        <button type="button" onClick={reset}>По порядку</button>
      </div>

      <div class="mb-3.5 flex gap-6 rounded-box bg-base-200 px-3.5 py-2.5 ring-1 ring-base-300 [&>div]:flex [&>div]:flex-col [&>div]:gap-0.5 [&>div]:text-[12.5px] [&_b]:text-[11px] [&_b]:uppercase [&_b]:tracking-wider">
        <div>
          <b>последняя перекладка</b>
          <span>замеров: {last().reads}</span>
          <span>время: {ms(last().ms)}</span>
        </div>
        <div>
          <b>за текущий жест</b>
          <span>перекладок: {run().steps}</span>
          <span>замеров: {run().reads}</span>
          <span>суммарно: {ms(run().ms)}</span>
        </div>
      </div>

      <div
        class="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] content-start gap-2"
        ref={box}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={() => { setHeld(null); scroller.stop() }}
        onDrop={(ev) => ev.preventDefault()}
      >
        <For each={CARDS}>
          {(i) => (
            <div
              class="card grid h-16 cursor-grab place-items-center rounded-box border-t-5 bg-base-100 text-[15px] font-semibold ring-1 ring-base-300 active:cursor-grabbing"
              classList={{ 'opacity-35': held() === i }}
              data-card={i}
              draggable="true"
              ref={(el) => { els[i] = el }}
              style={{ order: String(pos()[i]), 'border-top-color': HUE(i) }}
            >
              {i + 1}
            </div>
          )}
        </For>
      </div>

    </div>
  )
}
