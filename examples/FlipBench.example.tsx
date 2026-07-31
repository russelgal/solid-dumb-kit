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
import { createFlip, createAutoScroller, type Flip } from 'solid-dumb-kit'

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
    <div class="fb-example">
      <h3>Замер на лету против снимка — сколько стоит «просто померить»</h3>
      <p class="note">
        Оба способа дают одинаковую картинку, отличается цена. <b>Замер до/после</b> — учебный FLIP:
        прочитать <code>getBoundingClientRect</code> у всех карточек, поменять <code>order</code>,
        прочитать снова. Второе чтение обязано дождаться новой раскладки, то есть это{' '}
        <b>forced layout</b>, синхронный, в обработчике события. <b>Снимок мест</b> — как на вкладке
        CSS order + FLIP: позиции сняты один раз через <code>IntersectionObserver</code>, смещение
        считается вычитанием, чтений ноль.
      </p>
      <p class="note">
        Тащи карточку и следи за панелью: цифры — про ОДНУ перекладку, а их за жест столько, сколько
        раз ты пересёк соседа. Переключи режим и протащи так же.
      </p>

      <div class="bar">
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

      <div class="stats">
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
        class="grid"
        ref={box}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={() => { setHeld(null); scroller.stop() }}
        onDrop={(ev) => ev.preventDefault()}
      >
        <For each={CARDS}>
          {(i) => (
            <div
              class="card"
              classList={{ held: held() === i }}
              data-card={i}
              draggable="true"
              ref={(el) => { els[i] = el }}
              style={{ order: String(pos()[i]), '--hue': HUE(i) }}
            >
              {i + 1}
            </div>
          )}
        </For>
      </div>

      <style>{`
        .fb-example { padding: 16px 20px; color: #0f172a }
        .fb-example h3 { margin: 0 0 4px }
        .fb-example .note { margin: 0 0 8px; font-size: 13px; color: #64748b; max-width: 90ch }
        .fb-example .bar { display: flex; align-items: center; gap: 14px; margin: 12px 0; flex-wrap: wrap }
        .fb-example .bar label { display: flex; align-items: center; gap: 5px; font-size: 13px; color: #475569 }
        .fb-example .bar button { padding: 6px 12px; font: inherit; font-size: 13px; cursor: pointer;
                                  border: 1px solid #cbd5e1; border-radius: 8px; background: #fff }
        .fb-example .stats { display: flex; gap: 24px; margin: 0 0 14px; padding: 10px 14px;
                             border-radius: 10px; background: #f8fafc; box-shadow: inset 0 0 0 1px #e2e8f0 }
        .fb-example .stats > div { display: flex; flex-direction: column; gap: 2px; font-size: 12.5px; color: #475569 }
        .fb-example .stats b { font-size: 11px; letter-spacing: .05em; text-transform: uppercase; color: #94a3b8 }

        .fb-example .grid { display: grid; gap: 8px; align-content: start;
                            grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)) }
        .fb-example .card { display: grid; place-items: center; height: 64px; border-radius: 10px;
                            cursor: grab; font-weight: 600; font-size: 15px; color: #1e293b;
                            background: #fff; box-shadow: inset 0 0 0 1px #e2e8f0;
                            border-top: 5px solid var(--hue) }
        .fb-example .card:active { cursor: grabbing }
        .fb-example .card.held { opacity: .35 }
      `}</style>
    </div>
  )
}
