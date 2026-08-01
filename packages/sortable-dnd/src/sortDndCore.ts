// Сортировка списка на нативном drag-and-drop.
//
// Место вставки МЫ НЕ СЧИТАЕМ. Это единственное, что браузер во время
// drag-and-drop делает идеально и даром: зона приёма висит на каждой строке, и
// событие приходит ровно на ту, над которой указатель. Прошлая версия вместо
// этого снимала координаты всех строк и сравнивала с ними курсор — и
// разваливалась, стоило списку поехать: после автопрокрутки снимок описывал
// позиции, которых на экране давно нет.
//
// Данные при этом не трогаются до самого дропа. Меняется только порядок МЕСТ, и
// его доигрывает FLIP: едет и перетаскиваемая строка (на место, которое займёт),
// и те соседи, что оказались между старым местом и новым. Остальные не
// шевелятся, и в их `style` не попадает ни байта.
//
// Важное следствие того, что едет и сама строка: она всегда стоит там, где
// курсор, и накрывает собой цель. Значит место не дребезжит — над собой мы
// ничего не пересчитываем — и не «убегает» вниз.
//
// Место (`k`) живёт в координатах списка БЕЗ перетаскиваемой строки: «встать
// перед k-м из оставшихся». Через исходные индексы жест выходит несимметричным:
// сосед, который уже отъехал, в исходном порядке стоит там же, где стоял, и шаг
// назад съедается — назад приходится вести на две строки вместо одной. В
// координатах остатка правило то же, что у SortableJS: цель ниже нас — встаём
// после неё, выше — перед. Туда же без пересчёта ложится `onEnd`: это ровно
// индексы для `splice(from, 1)` + `splice(to, 0, …)`.
//
// Насколько двигать — арифметика по одному разовому замеру:
//
//   • соседи — на высоту перетаскиваемой строки с зазором (убрали элемент
//     высотой H, всё, что ниже, поднялось на H + gap);
//   • сама строка — на сумму высот тех, кого она перешагнула;
//   • сетка — на разницу мест, а места по ходу жеста не двигаются.
//
// Везде РАЗНИЦЫ, а не абсолютные координаты, поэтому прокрутка — колесом,
// автоскроллом, чем угодно — на расчёт не влияет.
//
// Библиотеки под этим нет вообще — только события браузера. Сначала здесь стоял
// `@atlaskit/pragmatic-drag-and-drop`, но выяснилось, что платим мы за него зря:
// хиттест всё равно делает браузер, а из его услуг оставалась нормализация
// `dragenter`/`dragleave` да «honey pot» под чужой баг с залипшим `:hover`. За
// это — 6.9 КБ gzip против 1.5 КБ нашей базы и CJS-хвост `bind-event-listener`,
// который дважды ронял дев у потребителя («does not provide an export named
// 'bind'»). Кому нужны его хитбоксы — подключит адаптером поверх.
//
// Слушателей ЧЕТЫРЕ на весь список, а не по четыре на строку: события
// drag-and-drop всплывают, и `ev.target.closest` скажет, кто под курсором. На
// трёхстах строках это разница между 4 записями в таблице слушателей и 1200.
//
// Тач не поддерживается: HTML5 DnD там не существует. Для пальца — `DumbSortable`.

import { createAutoScroller } from '@solid-dumb-kit/shared'
import { createFlip, type Flip } from '@solid-dumb-kit/shared'
import { shouldAnimate } from '@solid-dumb-kit/shared'

export type SortDndOptions = {
  /** текущий порядок id — совпадает с порядком данных */
  order: () => Array<string>
  /** `y` — вертикальный список (по умолчанию), `grid` — двумерная сетка плиток */
  axis?: () => 'y' | 'grid'
  /** перетаскивание запрещено */
  disabled?: () => boolean
  /** анимировать расступание; по умолчанию да, но не при prefers-reduced-motion */
  animate?: boolean
  /** на дропе: переставить из fromIndex в toIndex (индексы в order()) */
  onEnd?: (fromIndex: number, toIndex: number) => void
  /** id строки, которую тащат (null — жеста нет) */
  onActive?: (id: string | null) => void
}

export type SortDndEngine = {
  /** ref на контейнер списка */
  attachContainer: (el: HTMLElement) => () => void
  /** ref на строку; ручка — дочка с [data-drag-handle] */
  attach: (el: HTMLElement, id: string) => () => void
  active: () => string | null
  destroy: () => void
}

type Shift = { dx: number; dy: number }

type Drag = {
  id: string
  el: HTMLElement
  ids: Array<string>
  from: number
  /** куда встанет: индекс в ids */
  k: number
  /** высота каждой строки вместе с зазором под ней (список) */
  steps: Array<number>
  /** позиции мест (сетка); по ходу жеста не меняются */
  slots: Array<{ left: number; top: number }>
  /** кого мы уже сдвинули — чтобы вернуть тех, кто вышел из диапазона */
  moved: Set<string>
  grid: boolean
  ready: boolean
}

export function createSortDndEngine(opts: SortDndOptions): SortDndEngine {
  const els = new Map<string, HTMLElement>()
  let container: HTMLElement | null = null
  let drag: Drag | null = null
  /**
   * Цель последнего нажатия — по ней решаем, тянут ли за ручку. Слушатель ОДИН
   * на весь движок: на трёхстах строках триста `pointerdown` — это триста
   * лишних записей в таблице слушателей ради одной переменной. Pragmatic по той
   * же причине слушает жест на уровне документа, а не на каждом элементе.
   */
  let pressed: Element | null = null
  /** где курсор был на прошлом событии — чтобы отличить движение от «стоим» */
  let lastX = -1
  let lastY = -1
  /** курсор над списком — по этому и решаем, состоялся ли жест */
  let overList = false
  /** нажали Escape — жест отменён, что бы ни говорил браузер */
  let escaped = false
  const remember = (ev: PointerEvent) => { pressed = ev.target as Element | null }
  if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', remember, { capture: true, passive: true })
  }
  const scroller = createAutoScroller()
  let flip: Flip | null = null

  /**
   * Единственный замер за жест. IntersectionObserver, а не
   * `getBoundingClientRect`: bounds считаются off-main-thread, синхронного
   * reflow не случается даже на сотнях строк. Замер асинхронный, и это не
   * мешает — до его прихода жест уже работает, просто без движения соседей.
   */
  function measure(d: Drag) {
    const targets: Array<HTMLElement> = []
    for (const id of d.ids) {
      const el = els.get(id)
      if (el) targets.push(el)
    }
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
      // не бесконечно: молчащая (например, display:none) не должна вешать жест
      if (rects.size < targets.length && batches < 4) return
      io.disconnect()
      if (drag !== d) return

      const list = d.ids.map((id) => rects.get(id))
      d.slots = list.map((r) => (r ? { left: r.left, top: r.top } : { left: 0, top: 0 }))
      // зазор берём из первой пары соседей: в списке он один на всех
      let gap = 0
      for (let i = 1; i < list.length; i++) {
        const a = list[i - 1]
        const b = list[i]
        if (!a || !b || b.top <= a.top) continue
        gap = Math.max(0, b.top - (a.top + a.height))
        break
      }
      d.steps = list.map((r) => (r ? r.height + gap : 0))
      d.ready = true
      if (d.k !== d.from) place(d)          // место успели сменить до замера
    })
    for (const t of targets) io.observe(t)
  }

  /** id i-го из оставшихся: перетаскиваемая в этом счёте не участвует */
  const idAt = (d: Drag, i: number) => d.ids[i < d.from ? i : i + 1]

  /** какое место занимает i-й из оставшихся, если перетаскиваемая встанет в k */
  const slotAt = (i: number, k: number) => (i < k ? i : i + 1)

  /** Куда отъезжает i-й из оставшихся: он либо стоит, либо сдвинут на одно место. */
  function shiftOf(d: Drag, i: number): Shift {
    const was = slotAt(i, d.from)
    const now = slotAt(i, d.k)
    if (was === now) return { dx: 0, dy: 0 }
    if (d.grid) {
      const a = d.slots[was]
      const b = d.slots[now]
      return a && b ? { dx: b.left - a.left, dy: b.top - a.top } : { dx: 0, dy: 0 }
    }
    // сосед пропускает перетаскиваемую мимо себя — значит едет ровно на её высоту
    return { dx: 0, dy: (now - was) * (d.steps[d.from] ?? 0) }
  }

  /** Куда отъезжает сама перетаскиваемая: она перешагивает через остальных. */
  function shiftOfDrag(d: Drag): Shift {
    if (d.grid) {
      const a = d.slots[d.from]
      const b = d.slots[d.k]
      return a && b ? { dx: b.left - a.left, dy: b.top - a.top } : { dx: 0, dy: 0 }
    }
    let dy = 0
    if (d.k > d.from) for (let i = d.from; i < d.k; i++) dy += d.steps[i + 1] ?? 0
    else for (let i = d.k; i < d.from; i++) dy -= d.steps[i] ?? 0
    return { dx: 0, dy }
  }

  /** Развезти всех, кого касается текущее место. Прочих не трогаем вовсе. */
  function place(d: Drag) {
    if (!d.ready) return
    const lo = Math.min(d.from, d.k)
    const hi = Math.max(d.from, d.k)
    const next = new Set<string>()

    const self = shiftOfDrag(d)
    flip?.to(d.el, self.dx, self.dy)

    for (let i = lo; i < hi; i++) {
      const id = idAt(d, i)
      const el = els.get(id)
      if (!el) continue
      const { dx, dy } = shiftOf(d, i)
      if (!dx && !dy) continue
      flip?.to(el, dx, dy)
      next.add(id)
    }
    // кто вышел из диапазона — домой
    for (const id of d.moved) {
      if (next.has(id)) continue
      const el = els.get(id)
      if (el) flip?.to(el, 0, 0)
    }
    d.moved = next
  }

  /** Курсор над строкой — значит её место и нужно занять. */
  function hover(id: string | null) {
    const d = drag
    if (!d || !id) return
    {
      // над самим собой: место уже наше, пересчитывать нечего
      if (id === d.id) return
      const idx = d.ids.indexOf(id)
      if (idx < 0) return
      if (els.get(id)?.getAnimations().length) return   // цель сама едет — не цель
      // номер соседа среди оставшихся — и правило SortableJS: цель ниже нас,
      // значит встаём после неё; выше — перед ней
      const rest = idx < d.from ? idx : idx - 1
      const to = rest >= d.k ? rest + 1 : rest
      if (to === d.k) return
      d.k = to
      place(d)
      return
    }
  }

  function endDrag(commit?: () => void) {
    if (!drag) return
    const el = drag.el
    drag = null
    scroller.stop()
    opts.onActive?.(null)
    if (!commit) {
      flip?.clear()
      flip = null
      el.style.opacity = ''
      return
    }
    commit()
    // сдвиги снимаем СЛЕДУЮЩИМ кадром: к этому моменту потребитель уже
    // переставил данные, элементы физически стоят там, куда их привёз FLIP, и
    // снятие проходит незаметно. Наоборот — виден рывок через старые места.
    requestAnimationFrame(() => {
      flip?.clear()
      flip = null
      el.style.opacity = ''
    })
  }

  /** кто под событием: слушатели висят на контейнере, не на каждой строке */
  const idOf = (ev: Event) => {
    const el = (ev.target as HTMLElement | null)?.closest?.('[data-sort-dnd-id]') as HTMLElement | null
    return el?.dataset.sortDndId ?? null
  }

  const onDragStart = (ev: DragEvent) => {
    if (opts.disabled?.()) { ev.preventDefault(); return }
    const el = (ev.target as HTMLElement | null)?.closest?.('[data-sort-dnd-id]') as HTMLElement | null
    const id = el?.dataset.sortDndId
    if (!id) return

    // Ручка: `draggable` стоит на строке, поэтому целью события будет она сама,
    // а не ручка внутри — куда нажали, знает только запомненный `pointerdown`.
    const handle = el!.querySelector('[data-drag-handle]')
    if (handle && !(pressed && handle.contains(pressed))) { ev.preventDefault(); return }

    const ids = opts.order()
    const from = ids.indexOf(id)
    if (from < 0) { ev.preventDefault(); return }

    // без `setData` жест не начнётся в Firefox
    ev.dataTransfer?.setData('text/plain', id)
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'

    drag = {
      id, el: el!, ids, from, k: from,
      steps: [], slots: [], moved: new Set(),
      grid: opts.axis?.() === 'grid', ready: false,
    }
    lastX = ev.clientX
    lastY = ev.clientY
    overList = true
    escaped = false
    opts.onActive?.(id)
    // Прятать оригинал нельзя: `visibility: hidden` лишает его событий `drag`,
    // а на них держится автопрокрутка. Глушим прозрачностью.
    el!.style.opacity = '0.35'
    flip = createFlip(shouldAnimate(opts.animate))
    scroller.start(container ?? el!)
    measure(drag)
  }

  const onDragOver = (ev: DragEvent) => {
    ev.preventDefault()                       // без этого не будет `drop`
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move'
    if (!drag) return
    overList = true
    scroller.move(ev.clientX, ev.clientY)

    // Курсор обязан реально сдвинуться. Пока строки едут, браузер шлёт
    // `dragover` и при неподвижной мыши, а хиттест идёт по ВИДИМОЙ картинке —
    // под курсор попадает то одна строка, то другая, и место дёргается само,
    // без участия руки.
    if (ev.clientX === lastX && ev.clientY === lastY) return
    lastX = ev.clientX
    lastY = ev.clientY
    hover(idOf(ev))
  }

  /**
   * Ушли за пределы списка. Считаем уходом только когда браузер прямо называет,
   * КУДА ушли, и это не наш потомок: переход со строки на строку — тоже
   * `dragleave`, а `relatedTarget` там сплошь и рядом пустой. Снимать флаг на
   * пустом значило бы отменять жест на ровном месте.
   */
  const onDragLeave = (ev: DragEvent) => {
    const to = ev.relatedTarget as Node | null
    if (!to) return
    if (container?.contains(to)) return
    overList = false
  }

  const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') escaped = true }

  /**
   * Конец жеста.
   *
   * Коммит нельзя вешать на один `drop`: браузер доставляет его не всегда — при
   * быстром движении Chrome глотает `dragover`, и без свежего `dragover` дроп он
   * не считает состоявшимся. Пользователь видит, как строки всё время
   * расступались, отпускает — и порядок молча откатывается. Особенно заметно при
   * автопрокрутке: там курсор стоит, а событий почти нет.
   *
   * По `dropEffect` это тоже не определить: у несостоявшегося дропа он `none` —
   * ровно как у отменённого жеста. Поэтому решаем сами: жест состоялся, если
   * отпустили НАД списком и не нажимали Escape. `dragend` приходит всегда, он и
   * подводит итог; `drop` просто успевает раньше.
   */
  const onFinish = (ev: DragEvent) => {
    const d = drag
    if (!d) return
    if (ev.type === 'drop') ev.preventDefault()
    const committed = overList && !escaped && d.k !== d.from
    const { from, k } = d
    endDrag(committed ? () => opts.onEnd?.(from, k) : undefined)
  }

  return {
    attachContainer(el: HTMLElement) {
      // ВСЕ слушатели жеста — здесь, четыре штуки на любое число строк
      el.addEventListener('dragstart', onDragStart)
      el.addEventListener('dragover', onDragOver)
      el.addEventListener('dragleave', onDragLeave)
      el.addEventListener('drop', onFinish)
      el.addEventListener('dragend', onFinish)
      document.addEventListener('keydown', onKey)
      container = el
      return () => {
        el.removeEventListener('dragstart', onDragStart)
        el.removeEventListener('dragover', onDragOver)
        el.removeEventListener('dragleave', onDragLeave)
        el.removeEventListener('drop', onFinish)
        el.removeEventListener('dragend', onFinish)
        document.removeEventListener('keydown', onKey)
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

    active: () => drag?.id ?? null,
    destroy() {
      endDrag()
      if (typeof document !== 'undefined') {
        document.removeEventListener('pointerdown', remember, true)
      }
      els.clear()
    },
  }
}
