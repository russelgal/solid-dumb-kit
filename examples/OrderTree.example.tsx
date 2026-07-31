// Дерево на CSS order + FLIP: перетаскивание внутри уровня и между уровнями.
//
// Разметка — настоящие вложенные списки: `<ul><li>…<ul>…</ul></li></ul>`. Каждый
// `<ul>` это grid в одну колонку, поэтому `order` внутри уровня работает как
// везде: порядок среди братьев меняется, DOM не трогается.
//
// Смена уровня — другое дело: у соседнего `<ul>` свой `order`, значит узел
// физически переходит в другой список. Ровно как переезд карточки между
// колонками канбана, только «колонок» здесь столько, сколько узлов.
//
// Куда положить — решает БРАУЗЕР, а не мы. И целями служат те элементы, что уже
// есть в разметке: ни одной пустой «щели» ради дропа не добавлено.
//
//   • строка ПАПКИ — «стать её ребёнком» (свёрнутая раскроется сама);
//   • строка ЛИСТА — «встать на его место», то есть рядом, на его уровне;
//   • пустое место `<ul>` — «в конец этого уровня».
//
// Отсюда нет ни расчёта уровня по горизонтали курсора, ни сравнения координат с
// серединой строки: `dragover` приходит ровно на ту цель, над которой указатель.
// Ноль вычислений — ноль расхождений с тем, что видно глазом.
//
// `draggable` стоит на `<li>`, а не на строке: ветка целиком лежит в своём
// `<li>`, поэтому браузер сам тащит узел с потомками и сам рисует правильную
// картинку переноса. Чинить её через `setDragImage` не нужно.
//
// Позиции для анимации всё же считаются — но только для неё: строка узла
// постоянной высоты, вложенность даёт лишь отступ слева, значит на экране ровная
// стопка, и место i-й видимой строки это `top + i * step`, а отступ —
// `level * indent`.
//
// Бросить ветку внутрь самой себя нельзя — её щели и строки исключаются из целей.
import { createSignal, onCleanup, onMount, For, Show } from 'solid-js'
import { createFlip, createAutoScroller, type Flip } from '@solid-dumb-kit/shared'

type Node = { id: string; label: string; kind: string }

/** ширина одной ступени вложенности; та же величина уходит в CSS */
const INDENT = 22

const NODES: Array<Node> = [
  { id: 'n1', label: 'Каталог', kind: 'папка' },
  { id: 'n2', label: 'Одежда', kind: 'папка' },
  { id: 'n3', label: 'Верхняя', kind: 'папка' },
  { id: 'n4', label: 'Куртки', kind: 'раздел' },
  { id: 'n5', label: 'Пальто', kind: 'раздел' },
  { id: 'n6', label: 'Обувь', kind: 'папка' },
  { id: 'n7', label: 'Ботинки', kind: 'раздел' },
  { id: 'n8', label: 'Кроссовки', kind: 'раздел' },
  { id: 'n9', label: 'Техника', kind: 'папка' },
  { id: 'n10', label: 'Ноутбуки', kind: 'раздел' },
  { id: 'n11', label: 'Телефоны', kind: 'раздел' },
  { id: 'n12', label: 'Аксессуары', kind: 'папка' },
  { id: 'n13', label: 'Чехлы', kind: 'раздел' },
  { id: 'n14', label: 'Кабели', kind: 'раздел' },
  { id: 'n15', label: 'Архив', kind: 'папка' },
]

const PARENT0: Record<string, string | null> = {
  n1: null, n2: 'n1', n3: 'n2', n4: 'n3', n5: 'n3', n6: 'n2', n7: 'n6', n8: 'n6',
  n9: null, n10: 'n9', n11: 'n9', n12: 'n9', n13: 'n12', n14: 'n12', n15: null,
}

type Geom = { top: number; left: number; step: number }

export default function OrderTreeExample() {
  const [parent, setParent] = createSignal<Record<string, string | null>>(PARENT0)
  const [place, setPlace] = createSignal<Record<string, number>>(
    (() => {
      const p: Record<string, number> = {}
      const seen: Record<string, number> = {}
      for (const n of NODES) {
        const key = String(PARENT0[n.id])
        seen[key] = (seen[key] ?? 0)
        p[n.id] = seen[key]++
      }
      return p
    })(),
  )
  const [closed, setClosed] = createSignal<Record<string, boolean>>({})
  const [held, setHeld] = createSignal<string | null>(null)
  const [log, setLog] = createSignal('тащи узел: вверх-вниз — место, влево-вправо — уровень')

  const els = new Map<string, HTMLElement>()      // строки — по ним геометрия
  const items = new Map<string, HTMLElement>()   // <li> — их и двигает FLIP
  let root!: HTMLElement
  let geom: Geom | null = null
  const flip: Flip = createFlip(true)
  const scroller = createAutoScroller()
  onCleanup(() => scroller.stop())

  const byId = (id: string) => NODES.find((n) => n.id === id)!
  const kids = (id: string | null) =>
    NODES.filter((n) => parent()[n.id] === id).map((n) => n.id).sort((a, b) => place()[a] - place()[b])

  /** плоский порядок отображения: то, что реально видно сверху вниз */
  const flat = (): Array<{ id: string; level: number }> => {
    const out: Array<{ id: string; level: number }> = []
    const walk = (pid: string | null, level: number) => {
      for (const id of kids(pid)) {
        out.push({ id, level })
        if (!closed()[id]) walk(id, level + 1)
      }
    }
    walk(null, 0)
    return out
  }

  /** все потомки узла — их нельзя брать целью, иначе ветка уедет сама в себя */
  const subtree = (id: string): Array<string> => {
    const out = [id]
    for (const k of kids(id)) out.push(...subtree(k))
    return out
  }

  /** экранная позиция i-й видимой строки уровня level — чистая арифметика */
  const at = (i: number, level: number) =>
    geom ? { left: geom.left + level * INDENT, top: geom.top + i * geom.step } : null

  /** снимок: монтирование, дроп, resize — но не посреди жеста */
  function measure() {
    const targets = [...els.values()]
    if (!targets.length || typeof IntersectionObserver !== 'function') return
    const rects = new Map<string, DOMRectReadOnly>()
    let batches = 0
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const id = (e.target as HTMLElement).dataset.node
        if (id) rects.set(id, e.boundingClientRect)
      }
      batches++
      if (rects.size < targets.length && batches < 4) return
      io.disconnect()
      const list = flat()
      const first = list[0] ? rects.get(list[0].id) : undefined
      const second = list[1] ? rects.get(list[1].id) : undefined
      if (!first) return
      geom = {
        top: first.top,
        left: first.left - list[0].level * INDENT,
        step: second ? second.top - first.top : first.height,
      }
    })
    for (const t of targets) io.observe(t)
  }

  onMount(() => {
    measure()
    if (typeof ResizeObserver !== 'function') return
    let first = true
    const ro = new ResizeObserver(() => { if (first) { first = false; return } measure() })
    ro.observe(root)
    onCleanup(() => ro.disconnect())
  })

  /**
   * Применить новое дерево и доиграть переезд.
   *
   * Смещения считаются по ИНДЕКСАМ, а не по элементам: где строка была и где
   * стала, известно из двух плоских списков. Это важно ещё и практически — при
   * смене родителя Solid пересоздаёт узел, поэтому анимировать надо тот элемент,
   * который лежит в `els` ПОСЛЕ применения, а не до.
   */
  function apply(nextParent: Record<string, string | null>, nextPlace: Record<string, number>, moving?: string) {
    const wasList = flat()
    const was = new Map(wasList.map((x, i) => [x.id, { i, level: x.level }]))
    // потомки переезжающей ветки внутри неё не двигались — их везёт родительский
    // <li>, и трогать их отдельно значило бы анимировать одно и то же дважды
    const inside = moving ? new Set(subtree(moving).filter((x) => x !== moving)) : new Set<string>()

    setParent(nextParent)
    setPlace(nextPlace)

    const nowList = flat()
    for (let i = 0; i < nowList.length; i++) {
      const { id, level } = nowList[i]
      if (inside.has(id)) continue
      const prev = was.get(id)
      const el = items.get(id)                 // ← уже новый, если узел пересоздан
      if (!prev || !el) continue
      if (prev.i === i && prev.level === level) continue
      const a = at(prev.i, prev.level)
      const b = at(i, level)
      if (!a || !b) continue
      flip.nudge(el, a.left - b.left, a.top - b.top)
    }
  }

  /** переложить узел: новый родитель и место среди его детей */
  function moveTo(id: string, newParent: string | null, index: number) {
    const nextParent = { ...parent(), [id]: newParent }
    const nextPlace = { ...place() }

    // сначала уплотняем старых братьев, потом вставляем к новым
    const oldSiblings = kids(parent()[id]).filter((x) => x !== id)
    oldSiblings.forEach((x, i) => { nextPlace[x] = i })

    const newSiblings = NODES
      .filter((n) => (n.id === id ? false : nextParent[n.id] === newParent))
      .map((n) => n.id)
      .sort((a, b) => nextPlace[a] - nextPlace[b])
    newSiblings.splice(Math.max(0, Math.min(newSiblings.length, index)), 0, id)
    newSiblings.forEach((x, i) => { nextPlace[x] = i })

    apply(nextParent, nextPlace, id)
  }

  const toggle = (id: string) => {
    const wasList = flat()
    const was = new Map(wasList.map((x, i) => [x.id, { i, level: x.level }]))
    setClosed({ ...closed(), [id]: !closed()[id] })
    // свернули ветку — всё, что ниже, поехало вверх: тот же FLIP, даром
    const nowList = flat()
    for (let i = 0; i < nowList.length; i++) {
      const { id: nid, level } = nowList[i]
      const prev = was.get(nid)
      const el = items.get(nid)
      if (!prev || !el || (prev.i === i && prev.level === level)) continue
      const a = at(prev.i, prev.level)
      const b = at(i, level)
      if (a && b) flip.nudge(el, a.left - b.left, a.top - b.top)
    }
  }

  /* ────────── жест ────────── */

  const closestOf = (ev: Event, sel: string) =>
    (ev.target as HTMLElement | null)?.closest?.(sel) as HTMLElement | null
  let lastX = -1
  let lastY = -1

  /**
   * Синхронный признак «жест идёт». Подсветку источника мы ставим отложенно —
   * иначе полупрозрачность попадёт в картинку переноса, — и если жест успевает
   * закончиться раньше этого тика, отложенный вызов включает её уже ПОСЛЕ
   * уборки. Элемент так и остаётся приглушённым. Флаг это отсекает.
   */
  let gesture: string | null = null

  const onDragStart = (ev: DragEvent) => {
    const el = closestOf(ev, '[data-node]')
    const id = el?.dataset.node
    if (!id) return
    ev.dataTransfer?.setData('text/plain', id)
    // картинку переноса не трогаем: `draggable` на <li>, значит браузер уже снял
    // ровно то, что нужно, — узел вместе с его веткой
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
    lastX = ev.clientX
    lastY = ev.clientY
    scroller.start(el as HTMLElement)
    gesture = id
    setTimeout(() => { if (gesture === id) setHeld(id) })
    setLog(`тащим «${byId(id).label}»`)
  }

  const onDragOver = (ev: DragEvent) => {
    ev.preventDefault()
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move'
    scroller.move(ev.clientX, ev.clientY)
    const id = held()
    if (!id) return
    if (ev.clientX === lastX && ev.clientY === lastY) return   // рука не двигалась
    lastX = ev.clientX
    lastY = ev.clientY

    const mine = new Set(subtree(id))

    // строка узла: папка принимает внутрь, лист уступает своё место
    const into = closestOf(ev, '[data-into]')?.dataset.into
    if (into) {
      if (mine.has(into)) return
      const isFolder = kids(into).length > 0 || closed()[into]
      if (isFolder) {
        if (closed()[into]) setClosed({ ...closed(), [into]: false })   // раскроется сама
        if (parent()[id] === into) return
        moveTo(id, into, kids(into).length)
        setLog(`«${byId(id).label}» → внутрь «${byId(into).label}»`)
        return
      }
      const pid = parent()[into]
      const index = place()[into]
      if (pid !== null && mine.has(pid)) return
      if (parent()[id] === pid && place()[id] === index) return
      moveTo(id, pid, index)
      setLog(`«${byId(id).label}» → на место «${byId(into).label}»`)
      return
    }

    // мимо строк, но внутри ветки — значит в конец этого уровня
    const branch = closestOf(ev, '[data-branch]')
    if (!branch) return
    const pid = branch.dataset.branch === '' ? null : branch.dataset.branch!
    if (pid !== null && mine.has(pid)) return
    const last = kids(pid).filter((x) => x !== id).length
    if (parent()[id] === pid && place()[id] === last) return
    moveTo(id, pid, last)
    setLog(`«${byId(id).label}» → в конец ${pid ? `«${byId(pid).label}»` : 'корня'}`)
  }

  const finish = () => {
    gesture = null
    if (!held()) return
    setHeld(null)
    scroller.stop()
    measure()
  }

  /**
   * Одна ветка. `<ul>` — grid в колонку, `<li>` носят `order` и `draggable`.
   * Целями дропа служат сами эти элементы: строка узла и сам `<ul>`.
   */
  const Branch = (props: { pid: string | null; level: number }) => (
    <ul class="branch" classList={{ root: props.pid === null }} data-branch={props.pid ?? ''}>
      <For each={kids(props.pid)}>
        {(id) => (
          <li
            class="item"
            classList={{ held: held() === id }}
            data-node={id}
            draggable="true"
            ref={(el) => items.set(id, el)}
            style={{ order: String(place()[id]) }}
          >
            <div
              class="node"
              data-into={id}
              ref={(el) => els.set(id, el)}
              style={{ 'padding-left': `${props.level * INDENT + 8}px` }}
            >
              <Show when={kids(id).length} fallback={<span class="bullet">•</span>}>
                <button
                  class="twist"
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => toggle(id)}
                >
                  {closed()[id] ? '▸' : '▾'}
                </button>
              </Show>
              <span class="label">{byId(id).label}</span>
              <span class="kind">{byId(id).kind}</span>
            </div>
            <Show when={!closed()[id]}>
              <Branch pid={id} level={props.level + 1} />
            </Show>
          </li>
        )}
      </For>
    </ul>
  )

  return (
    <div
      class="tr-example"
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={finish}
      onDrop={(ev) => { ev.preventDefault(); finish() }}
    >
      <h3>Дерево на CSS order + FLIP</h3>
      <p class="note">
        Разметка — настоящие вложенные <code>&lt;ul&gt;/&lt;li&gt;</code>. Внутри уровня работает{' '}
        <code>order</code>, и DOM не трогается. Смена уровня — единственный случай, когда узел
        физически переходит в другой список: у соседнего <code>&lt;ul&gt;</code> свой{' '}
        <code>order</code>. Вместе с узлом едет вся ветка — она и так лежит внутри его{' '}
        <code>&lt;li&gt;</code>.
      </p>
      <p class="note">
        Куда положить, решает браузер, и целями служат элементы, которые и так есть: строка{' '}
        <b>папки</b> принимает внутрь (свёрнутая раскроется сама), строка <b>листа</b> уступает своё
        место, пустое поле <code>&lt;ul&gt;</code> — «в конец этого уровня». Ни одной пустой обёртки
        ради дропа, ни одного расчёта по координатам курсора. Позиции считаются только для{' '}
        <b>анимации</b>: строка постоянной высоты, вложенность даёт отступ слева — значит на экране
        ровная стопка. Сворачивание анимируется тем же FLIP.
      </p>
      <div class="bar">{log()}</div>

      <div class="tree" ref={root}>
        <Branch pid={null} level={0} />
      </div>

      <style>{`
        .tr-example { padding: 16px 20px; color: #0f172a }
        .tr-example h3 { margin: 0 0 4px }
        .tr-example .note { margin: 0 0 8px; font-size: 13px; color: #64748b; max-width: 92ch }
        .tr-example .bar { margin: 8px 0 12px; font-size: 13px; color: #64748b; min-height: 18px }

        .tr-example .tree { max-width: 560px; overflow: hidden; border-radius: 12px;
                            background: #fff; box-shadow: inset 0 0 0 1px #e2e8f0 }
        /* каждый уровень — grid в одну колонку: сюда и смотрит order */
        /* Строки идут ВПЛОТНУЮ, без зазоров. Зазор — это дырка в хиттесте: курсор
           проваливается между строками на сам <ul>, а тот значит «в конец
           уровня», и узел неожиданно улетает вниз. Разделяем линией, не пустотой. */
        .tr-example .branch { display: grid; grid-template-columns: 1fr; gap: 0;
                              margin: 0; padding: 0; list-style: none }
        .tr-example .item { display: grid; grid-template-columns: 1fr; gap: 0 }
        .tr-example .node { display: flex; align-items: center; gap: 8px; height: 30px;
                            padding-right: 10px; cursor: grab; background: #fff;
                            border-bottom: 1px solid #eef2f7 }
        .tr-example .node:hover { background: #f8fafc }
        .tr-example .node:active { cursor: grabbing }
        /* приглушаем весь <li>: раз браузер тащит ветку целиком, пусть и
           видно будет, что уезжает именно ветка */
        .tr-example .item.held { opacity: .35 }
        .tr-example .twist { width: 18px; padding: 0; border: none; background: none; cursor: pointer;
                             color: #94a3b8; font-size: 11px; line-height: 1 }
        .tr-example .bullet { width: 18px; text-align: center; color: #cbd5e1; font-size: 12px }
        .tr-example .label { font-size: 13.5px; font-weight: 500 }
        .tr-example .kind { margin-left: auto; font-size: 11.5px; color: #94a3b8 }
      `}</style>
    </div>
  )
}
