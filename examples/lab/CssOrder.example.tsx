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
import { createFlip, createAutoScroller, type Flip } from '@solid-dumb-kit/shared'

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
  let gesture: number | null = null

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
      <div class="mb-3 flex flex-wrap items-center gap-2 [&_button]:cursor-pointer [&_button]:rounded-lg [&_button]:border [&_button]:border-base-300 [&_button]:bg-base-100 [&_button]:px-3 [&_button]:py-1.5 [&_button]:text-[13px] [&_button:hover]:bg-base-200 [&_label]:flex [&_label]:items-center [&_label]:gap-1.5 [&_label]:text-[13px]">
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
        <span class="text-[13px] text-base-content">
          поехало: <b>{moved()}</b> из {props.count}
          {ready() ? '' : ' · места ещё снимаются'}
        </span>
      </div>

      {/* Слушатели висят ЗДЕСЬ, а не на каждой карточке: события drag-and-drop
          всплывают, поэтому четырёх на контейнер хватает на любое их число —
          иначе на двухстах карточках висело бы восемьсот. Кто под курсором,
          отвечает `ev.target.closest('[data-card]')`. */}
      <div
        class="grid gap-2"
        classList={{
          'grid-cols-[repeat(auto-fill,minmax(76px,1fr))]': !props.list,
          'max-w-[560px] grid-cols-1 gap-1.5': props.list,
          // контейнер со своей прокруткой: место под полосу резервируем заранее
          // (`sd-scroll`), иначе её появление меняет ширину — и сетка
          // пересчитывается посреди жеста
          'sd-scroll max-h-90 content-start rounded-xl bg-base-200 p-2 ring-1 ring-base-300': props.scroll,
        }}
        ref={box}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={() => { gesture = null; setHeld(null); scroller.stop() }}
        onDrop={(ev) => ev.preventDefault()}
      >
        <For each={cards()}>
          {(i) => (
            <div
              class="grid cursor-grab place-items-center rounded-box bg-base-100 font-semibold ring-1 ring-base-300 active:cursor-grabbing"
              classList={{
                'h-16 border-t-5 text-[15px]': !props.list,
                'h-10.5 justify-items-start border-l-5 pl-3.5 text-sm font-medium': props.list,
                // только прозрачность: спрятать оригинал совсем — оборвать жест
                'opacity-35': held() === i,
              }}
              data-card={i}
              draggable="true"
              ref={(el) => { els[i] = el }}
              style={{
                order: String(pos()[i]),
                [props.list ? 'border-left-color' : 'border-top-color']: HUE(i),
              }}
            >
              {props.list ? `Строка ${i + 1}` : i + 1}
            </div>
          )}
        </For>
      </div>

      <p class="mb-2.5 max-w-[90ch] font-mono text-xs text-base-content">
        порядок на экране: {visual().slice(0, 24).join(' ')} …
      </p>
    </div>
  )
}

export default function CssOrderExample() {
  return (
    <div class="p-5 text-base-content">
      <h3 class="mb-1 text-lg font-semibold">CSS order + FLIP — сортировка без единой перестановки DOM</h3>
      <p class="mb-2.5 max-w-[90ch] text-[13px] text-base-content">
        <b>Тяни карточки мышью</b> или жми кнопки — результат один: карточки в разметке всегда идут
        по порядку и никуда не переезжают, меняется только свойство <code>order</code>, раскладку
        делает сам браузер. Перетаскивание — голые нативные события (<code>dragstart</code>,{' '}
        <code>dragover</code>, <code>dragend</code>), где над чем курсор, решает тоже браузер:
        считать нечего.
      </p>
      <p class="mb-2.5 max-w-[90ch] text-[13px] text-base-content">
        Анимировать <code>order</code> нельзя — он дискретный, и без FLIP карточки просто
        телепортируются (сними галочку и сравни). FLIP догоняет перекладку: элемент уже на новом
        месте, мы стартуем его со старого. Позиции мест сняты <b>один раз</b> через{' '}
        <code>IntersectionObserver</code>; ни при перетаскивании, ни при перемешивании не читается
        ничего — смещение это разница двух известных мест.
      </p>

      <h4 class="mt-5 mb-2 text-sm text-base-content">200 карточек, сетка во всю ширину</h4>
      <p class="mb-2.5 max-w-[90ch] text-[13px] text-base-content">
        Прокручиваемого предка у этой сетки нет, поэтому автопрокрутка возьмётся за саму страницу:
        подтащи карточку к нижней кромке окна.
      </p>
      <Deck count={200} autoScroll />

      <h4 class="mt-5 mb-2 text-sm text-base-content">Та же колода в контейнере с прокруткой</h4>
      <p class="mb-2.5 max-w-[90ch] text-[13px] text-base-content">
        Секция со своим <code>overflow-y: auto</code>. Проверяется главное: места сняты в координатах
        экрана, но в дело идут только их <b>разности</b> — «отсюда дотуда», — а разность от прокрутки
        не зависит. Поэтому пересчитывать снимок при скролле не нужно вовсе, и порядок не врёт, на
        сколько бы контейнер ни прокрутили. Автопрокрутка тут своя, из кита
        (<code>createAutoScroller</code>): уведи карточку к нижней кромке секции — и дальше за неё,
        за пределы, — список листается сам. Сними галочку и сравни: без неё дотащить до конца
        нечем, колесо во время нативного DnD странице не доставляется вовсе.
      </p>
      <Deck count={120} scroll autoScroll />

      <h4 class="mt-5 mb-2 text-sm text-base-content">Список — одна колонка, без прокрутки</h4>
      <p class="mb-2.5 max-w-[90ch] text-[13px] text-base-content">
        Тот же <code>Deck</code>, просто сетка шириной в один столбец: для движка ничего не меняется,
        места как были массивом координат, так и остались — соседи разъезжаются по вертикали, потому
        что так легли места. Прокручиваемого предка нет, поэтому автопрокрутка возьмётся за страницу.
      </p>
      <Deck count={40} list autoScroll />

      <h4 class="mt-5 mb-2 text-sm text-base-content">Список в контейнере с прокруткой</h4>
      <p class="mb-2.5 max-w-[90ch] text-[13px] text-base-content">
        Самый частый случай в жизни: длинный список в окне фиксированной высоты. Уведи строку к нижней
        кромке — листается сама; сними «автоскролл» и убедись, что без неё до конца не добраться.
      </p>
      <Deck count={120} scroll list autoScroll />

    </div>
  )
}
