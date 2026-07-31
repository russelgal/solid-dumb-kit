// Песочница: сортировка карточек через CSS `order` + FLIP.
//
// Тащить можно мышью (нативный drag-and-drop: `dragstart`/`dragover`/`dragend`,
// без снимков координат — над чем курсор, знает браузер) либо перемешивать
// кнопками. Путь дальше один и тот же.
//
// Идея — не трогать DOM вообще. Карточки как лежали в разметке 1…N, так и
// лежат: меняется только свойство `order`, а браузер перекладывает сетку сам.
// Само по себе это выглядит как телепорт — `order` не анимируется в принципе
// (дискретное layout-свойство, никакой transition его не подхватит). Значит
// перекладку надо доиграть, и делает это FLIP: элемент уже стоит на новом
// месте, мы лишь стартуем его со старого и отпускаем (`createFlip().nudge`).
//
// Альтернатива, View Transitions, тут не годится: она снимочная и плохо
// переживает прерывание на полпути, а нам нужно перебивать анимацию новым
// перемешиванием в любой момент.
//
// Позиции мест снимаются РАЗ (IntersectionObserver, off-main-thread) и потом
// только пересчитываются на изменение ширины. В момент перекладки не читается
// ничего: смещение — это разница двух известных мест.
import { createSignal, createEffect, onCleanup, onMount, For, Show } from 'solid-js'
import { createFlip, createAutoScroller, type Flip } from 'solid-dumb-kit'

const HUE = (i: number) => `oklch(0.75 0.12 ${(i * 41) % 360})`

type Slot = { left: number; top: number }

type DeckProps = {
  count: number
  /** колода живёт в контейнере со своей прокруткой */
  scroll?: boolean
  /** включить автопрокрутку к краю (галочку всё равно видно) */
  autoScroll?: boolean
  /** одна колонка: тот же движок, просто сетка шириной в один столбец */
  list?: boolean
}

function Deck(props: DeckProps) {
  const cards = () => Array.from({ length: props.count }, (_, i) => i)

  // pos[i] — какое МЕСТО занимает карточка i; это и есть её CSS order
  const [pos, setPos] = createSignal<Array<number>>(cards())
  const [animate, setAnimate] = createSignal(true)
  const [auto, setAuto] = createSignal(props.autoScroll === true)
  const [moved, setMoved] = createSignal(0)
  const [ready, setReady] = createSignal(false)

  const els: Array<HTMLElement | undefined> = []
  let box!: HTMLDivElement
  let slots: Array<Slot> = []
  let flip: Flip = createFlip(true)

  createEffect(() => { flip = createFlip(animate()) })

  // Автопрокрутка — готовая из кита. Своего кода тут ноль: сказали, от какого
  // элемента искать прокручиваемых предков, и когда жест закончился. Позицию
  // курсора она берёт из нативного `drag` сама — он приходит и при неподвижной
  // мыши, а `dragover` в этот момент молчит, и прокрутка встала бы у самого края.
  const scroller = createAutoScroller()
  onCleanup(() => scroller.stop())

  /**
   * Снять позиции мест. Один раз при монтировании и на смену ширины.
   *
   * Прокрутка контейнера сюда не приходит намеренно: места снимаются в
   * координатах экрана, но пользуемся мы только их РАЗНОСТЯМИ — «отсюда дотуда».
   * Разность от прокрутки не зависит, поэтому пересчитывать нечего.
   */
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
      // карточка i стоит на месте cur[i] — значит её прямоугольник и есть место
      for (const [i, r] of rects) next[cur[i]] = { left: r.left, top: r.top }
      slots = next
      setReady(next.length === props.count)
    })
    for (const t of targets) io.observe(t)
  }

  onMount(() => {
    measure()
    if (typeof ResizeObserver !== 'function') return
    let first = true
    const ro = new ResizeObserver(() => {
      if (first) { first = false; return }   // первый вызов — это само монтирование
      measure()
    })
    ro.observe(box)
    onCleanup(() => ro.disconnect())
  })

  /** Применить новую раскладку мест и доиграть переезд. */
  function apply(next: Array<number>) {
    const cur = pos()
    // смещения считаем ДО смены: после неё карточки уже на новых местах
    const back: Array<{ el: HTMLElement; dx: number; dy: number }> = []
    for (let i = 0; i < props.count; i++) {
      const el = els[i]
      const a = slots[cur[i]]
      const b = slots[next[i]]
      if (!el || !a || !b) continue
      const dx = a.left - b.left
      const dy = a.top - b.top
      if (dx || dy) back.push({ el, dx, dy })
    }

    setPos(next)                              // ← меняется только CSS order
    for (const m of back) flip.nudge(m.el, m.dx, m.dy)
    setMoved(back.length)
  }

  /* ────────── перетаскивание: нативные события, ноль расчётов ────────── */
  //
  // Хиттест делает браузер: `dragover` приходит ровно на ту карточку, над
  // которой курсор. Нам остаётся переложить МЕСТА (перетаскиваемая занимает
  // место цели, промежуточные сдвигаются на одно) — и это та же самая `apply`,
  // что у кнопок. DOM не трогается и здесь.
  const [held, setHeld] = createSignal<number | null>(null)

  /** кто на каком месте: seq[место] = карточка */
  const seq = () => {
    const s: Array<number> = []
    pos().forEach((p, i) => { s[p] = i })
    return s
  }

  /** где курсор был на прошлом событии — чтобы отличить движение от «стоим» */
  let lastX = -1
  let lastY = -1

  /** какая карточка под событием: слушатели висят на контейнере, не на каждой */
  const cardOf = (ev: Event) => {
    const el = (ev.target as HTMLElement | null)?.closest?.('[data-card]') as HTMLElement | null
    return el ? Number(el.dataset.card) : null
  }

  /**
   * Синхронный признак «жест идёт». Подсветку источника мы ставим отложенно —
   * иначе полупрозрачность попадёт в картинку переноса, — и если жест успевает
   * закончиться раньше этого тика, отложенный вызов включает её уже ПОСЛЕ
   * уборки. Элемент так и остаётся приглушённым. Флаг это отсекает.
   */
  let gesture: string | null = null

  const onDragStart = (ev: DragEvent) => {
    const i = cardOf(ev)
    if (i === null) return
    ev.dataTransfer?.setData('text/plain', String(i))   // без этого Firefox не начнёт
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
    lastX = ev.clientX
    lastY = ev.clientY
    if (auto()) scroller.start(box)
    // красим следующим тиком: картинку переноса браузер снимает синхронно, и
    // полупрозрачность попала бы прямо в неё
    gesture = i
    setTimeout(() => { if (gesture === i) setHeld(i) })
  }

  const onDragOver = (ev: DragEvent) => {
    ev.preventDefault()                                 // без этого не будет `drop`
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move'
    scroller.move(ev.clientX, ev.clientY)
    const i = cardOf(ev)
    const from = held()
    if (i === null || from === null || from === i) return  // над собой — место уже наше

    // Два правила против автоколебания. Хиттест идёт по ВИДИМОЙ картинке, а она
    // во время FLIP едет — значит под курсор попадает то одна карточка, то
    // другая, и каждая просит занять её место. Порядок начинает дёргаться сам,
    // без участия руки.
    //
    //   1. курсор обязан реально сдвинуться: браузер шлёт `dragover` и при
    //      неподвижной мыши, а перестановка должна быть следствием движения
    //      руки, а не движения анимации;
    if (ev.clientX === lastX && ev.clientY === lastY) return
    lastX = ev.clientX
    lastY = ev.clientY

    //   2. карточка под курсором не должна сама ехать: она оказалась там
    //      случайно, по пути на своё место, и брать её за ориентир — значит
    //      целиться в то, чего через полкадра уже не будет.
    if (els[i]?.getAnimations().length) return

    const s = seq()
    const a = pos()[from]
    const b = pos()[i]
    s.splice(b, 0, s.splice(a, 1)[0])
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
    apply(next)
  }
  const rotate = () => apply(pos().map((p) => (p + 1) % props.count))
  const reverse = () => apply(pos().map((p) => props.count - 1 - p))
  const reset = () => apply(cards())

  /** порядок, который видно на экране, — по возрастанию места */
  const visual = () => cards().sort((a, b) => pos()[a] - pos()[b]).map((i) => i + 1)

  return (
    <div class="deck">
      <div class="bar">
        <button type="button" onClick={shuffle}>Перемешать</button>
        <button type="button" onClick={rotate}>Сдвинуть на 1</button>
        <button type="button" onClick={reverse}>Наоборот</button>
        <button type="button" onClick={reset}>По порядку</button>
        <label>
          <input type="checkbox" checked={animate()} onChange={(e) => setAnimate(e.currentTarget.checked)} />
          анимация
        </label>
        <label>
          <input type="checkbox" checked={auto()} onChange={(e) => setAuto(e.currentTarget.checked)} />
          автоскролл
        </label>
        <span class="stat">
          поехало: <b>{moved()}</b> из {props.count}
          {ready() ? '' : ' · места ещё снимаются'}
        </span>
      </div>

      {/* Слушатели висят ЗДЕСЬ, а не на каждой карточке: события drag-and-drop
          всплывают, поэтому четырёх на контейнер хватает на любое их число —
          иначе на двухстах карточках висело бы восемьсот. Кто под курсором,
          отвечает `ev.target.closest('[data-card]')`. */}
      <div
        class="grid"
        classList={{ scroller: props.scroll, list: props.list }}
        ref={box}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={() => { gesture = null; setHeld(null); scroller.stop() }}
        onDrop={(ev) => ev.preventDefault()}
      >
        <For each={cards()}>
          {(i) => (
            <div
              class="card"
              classList={{ held: held() === i }}
              data-card={i}
              draggable="true"
              ref={(el) => { els[i] = el }}
              style={{ order: String(pos()[i]), '--hue': HUE(i) }}
            >
              {props.list ? `Строка ${i + 1}` : i + 1}
            </div>
          )}
        </For>
      </div>

      <p class="note small">
        порядок на экране: {visual().slice(0, 24).join(' ')} …
      </p>
    </div>
  )
}

export default function CssOrderExample() {
  return (
    <div class="co-example">
      <h3>CSS order + FLIP — сортировка без единой перестановки DOM</h3>
      <p class="note">
        <b>Тяни карточки мышью</b> или жми кнопки — результат один: карточки в разметке всегда идут
        по порядку и никуда не переезжают, меняется только свойство <code>order</code>, раскладку
        делает сам браузер. Перетаскивание — голые нативные события (<code>dragstart</code>,{' '}
        <code>dragover</code>, <code>dragend</code>), где над чем курсор, решает тоже браузер:
        считать нечего.
      </p>
      <p class="note">
        Анимировать <code>order</code> нельзя — он дискретный, и без FLIP карточки просто
        телепортируются (сними галочку и сравни). FLIP догоняет перекладку: элемент уже на новом
        месте, мы стартуем его со старого. Позиции мест сняты <b>один раз</b> через{' '}
        <code>IntersectionObserver</code>; ни при перетаскивании, ни при перемешивании не читается
        ничего — смещение это разница двух известных мест.
      </p>

      <h4 class="sec">200 карточек, сетка во всю ширину</h4>
      <p class="note">
        Прокручиваемого предка у этой сетки нет, поэтому автопрокрутка возьмётся за саму страницу:
        подтащи карточку к нижней кромке окна.
      </p>
      <Deck count={200} autoScroll />

      <h4 class="sec">Та же колода в контейнере с прокруткой</h4>
      <p class="note">
        Секция со своим <code>overflow-y: auto</code>. Проверяется главное: места сняты в координатах
        экрана, но в дело идут только их <b>разности</b> — «отсюда дотуда», — а разность от прокрутки
        не зависит. Поэтому пересчитывать снимок при скролле не нужно вовсе, и порядок не врёт, на
        сколько бы контейнер ни прокрутили. Автопрокрутка тут своя, из кита
        (<code>createAutoScroller</code>): уведи карточку к нижней кромке секции — и дальше за неё,
        за пределы, — список листается сам. Сними галочку и сравни: без неё дотащить до конца
        нечем, колесо во время нативного DnD странице не доставляется вовсе.
      </p>
      <Deck count={120} scroll autoScroll />

      <h4 class="sec">Список — одна колонка, без прокрутки</h4>
      <p class="note">
        Тот же <code>Deck</code>, просто сетка шириной в один столбец: для движка ничего не меняется,
        места как были массивом координат, так и остались — соседи разъезжаются по вертикали, потому
        что так легли места. Прокручиваемого предка нет, поэтому автопрокрутка возьмётся за страницу.
      </p>
      <Deck count={40} list autoScroll />

      <h4 class="sec">Список в контейнере с прокруткой</h4>
      <p class="note">
        Самый частый случай в жизни: длинный список в окне фиксированной высоты. Уведи строку к нижней
        кромке — листается сама; сними «автоскролл» и убедись, что без неё до конца не добраться.
      </p>
      <Deck count={120} scroll list autoScroll />

      <style>{`
        .co-example { padding: 16px 20px; color: #0f172a }
        .co-example h3 { margin: 0 0 4px }
        .co-example .sec { margin: 22px 0 8px; font-size: 14px; color: #334155 }
        .co-example .note { margin: 0 0 10px; font-size: 13px; color: #64748b; max-width: 90ch }
        .co-example .note.small { font-size: 12px; font-family: ui-monospace, monospace; color: #94a3b8 }
        .co-example .bar { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; flex-wrap: wrap }
        .co-example .bar button { padding: 6px 12px; font: inherit; font-size: 13px; cursor: pointer;
                                  border: 1px solid #cbd5e1; border-radius: 8px; background: #fff }
        .co-example .bar button:hover { background: #f1f5f9 }
        .co-example .bar label { display: flex; align-items: center; gap: 5px; font-size: 13px; color: #475569 }
        .co-example .stat { font-size: 13px; color: #64748b }

        .co-example .grid { display: grid; gap: 8px;
                            grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)) }
        .co-example .grid.list { grid-template-columns: 1fr; gap: 6px; max-width: 560px }
        /* контейнер со своей прокруткой: место под полосу резервируем заранее,
           иначе её появление меняет ширину — и сетка пересчитывается посреди жеста */
        .co-example .grid.scroller { max-height: 360px; overflow-y: auto; scrollbar-gutter: stable;
                                     align-content: start;
                                     padding: 8px; border-radius: 12px; background: #f8fafc;
                                     box-shadow: inset 0 0 0 1px #e2e8f0 }
        .co-example .card { display: grid; place-items: center; height: 64px; border-radius: 10px;
                            cursor: grab; font-weight: 600; font-size: 15px; color: #1e293b;
                            background: #fff; box-shadow: inset 0 0 0 1px #e2e8f0;
                            border-top: 5px solid var(--hue) }
        .co-example .grid.list .card { height: 42px; place-items: center start; padding-left: 14px;
                                      font-weight: 500; font-size: 14px; border-top: none;
                                      border-left: 5px solid var(--hue) }
        .co-example .card:active { cursor: grabbing }
        /* только прозрачность: спрятать оригинал совсем — оборвать жест */
        .co-example .card.held { opacity: .35 }
      `}</style>
    </div>
  )
}
