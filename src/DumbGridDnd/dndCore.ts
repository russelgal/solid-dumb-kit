// Сетка на нативном drag-and-drop. Написана ОТ БРАУЗЕРА, а не портирована с
// указательной версии: там весь код про то, чтобы вычислить, что под курсором, —
// здесь это говорит сам браузер, и почти всё вычисление исчезает.
//
// Отсюда весь дизайн:
//   • над какой СЕТКОЙ курсор — знает `dragover` на её контейнере;
//   • над каким БЛОКОМ — знает `dragover` на самом блоке;
//   • куда встать относительно блока — половина его ширины, для чего нужен один
//     прямоугольник, снятый при входе в этот блок (`dragenter`), а не поток
//     координат.
//
// Ни снимков всех зон, ни компенсации прокрутки, ни хиттеста по кэшу — нечего
// компенсировать, когда цель приносит событие сама.
//
// Чего здесь нет: работы на тач-устройствах (HTML5 DnD там не существует —
// для пальца есть `DumbGrid`), свободного режима и ресайза. Это сетка-поток:
// блоки идут по порядку, перенос меняет порядок.

/** блок глазами движка: важен только id, размеры — дело раскладки */
export type DndTransferSource = { grid: string; id: string; index: number }
export type DndTransferTarget = { grid: string; index: number }

export type DndGroupOptions = {
  /** блок переехал в ДРУГУЮ сетку — обе раскладки правит потребитель */
  onTransfer?: (from: DndTransferSource, to: DndTransferTarget) => void
  /** что тащат сейчас */
  onActive?: (state: { grid: string; id: string } | null) => void
  /** над какой сеткой указатель */
  onOver?: (grid: string | null) => void
}

export type DndZoneOptions = {
  /** текущий порядок блоков */
  order: () => Array<string>
  /** жесты запрещены */
  disabled?: () => boolean
  /** пускать ли к себе блок из сетки `from` (по умолчанию да) */
  accepts?: (from: string) => boolean
  /** перестановка внутри этой сетки */
  onReorder?: (from: number, to: number) => void
}

export type DndZoneEngine = {
  attachContainer: (el: HTMLElement) => () => void
  attach: (el: HTMLElement, id: string) => () => void
}

export type DndEngine = {
  grid: (name: string, opts: DndZoneOptions) => DndZoneEngine
  /** что тащат: сетка и блок */
  active: () => { grid: string; id: string } | null
  /** сетка под указателем */
  over: () => string | null
  /** куда встанет блок: сетка и индекс вставки (для подсветки) */
  drop: () => { grid: string; index: number } | null
  destroy: () => void
}

/** формат данных переноса: по нему блок узнаёт и чужой приёмник */
export const DND_MIME = 'application/x-dumb-grid'

export const dndSupported = () =>
  typeof DataTransfer === 'function' && typeof DragEvent === 'function'

type Zone = {
  name: string
  el: HTMLElement | null
  els: Map<string, HTMLElement>
  opts: DndZoneOptions
}

type Drag = {
  fromZone: string
  id: string
  fromIndex: number
  el: HTMLElement
  /** сетка и место вставки, куда блок сядет при дропе прямо сейчас */
  toZone: string
  /** −1 = места ещё не выбрали (ни одного dragover не было) */
  toIndex: number
}

export function createGridDndEngine(opts: DndGroupOptions = {}): DndEngine {
  const zones = new Map<string, Zone>()
  let drag: Drag | null = null
  let over: string | null = null

  const setOver = (name: string | null) => {
    if (over === name) return
    over = name
    opts.onOver?.(name)
  }

  /** Куда сядет блок: помечаем соседа, чтобы потребитель нарисовал место вставки. */
  function markDrop(zoneName: string, index: number) {
    if (!drag) return
    if (drag.toZone === zoneName && drag.toIndex === index) return
    drag.toZone = zoneName
    drag.toIndex = index
    clearMarks()

    const zone = zones.get(zoneName)
    if (!zone) return
    const order = zone.opts.order().filter(id => !(zoneName === drag!.fromZone && id === drag!.id))
    // метку вешаем на соседа: «встану перед этим» либо «после последнего»
    const beforeId = order[index]
    const afterId = order[order.length - 1]
    if (beforeId) zone.els.get(beforeId)?.setAttribute('data-drop-before', '')
    else if (afterId) zone.els.get(afterId)?.setAttribute('data-drop-after', '')
  }

  function clearMarks() {
    for (const zone of zones.values()) {
      for (const el of zone.els.values()) {
        el.removeAttribute('data-drop-before')
        el.removeAttribute('data-drop-after')
      }
    }
  }

  function clearDrag() {
    if (!drag) return
    clearMarks()
    drag.el.style.opacity = ''
    drag = null
    setOver(null)
    opts.onActive?.(null)
  }

  function accepted(zone: Zone): boolean {
    if (!drag) return false
    if (zone.name === drag.fromZone) return true
    return !zone.opts.accepts || zone.opts.accepts(drag.fromZone)
  }

  /* ────────── события блока ────────── */

  function onDragStart(zone: Zone, id: string, el: HTMLElement, ev: DragEvent) {
    if (!ev.dataTransfer || zone.opts.disabled?.()) { ev.preventDefault(); return }
    if (ev.target instanceof Element) {
      // ручка ресайза, вложенная сетка или сортировщик — их жест, не наш
      if (ev.target.closest('[data-grid-resize]')) { ev.preventDefault(); return }
      if (ev.target.closest('[data-flip-id]')) { ev.preventDefault(); return }
      const nested = ev.target.closest('[data-dnd-block]')
      if (nested && nested !== el) { ev.preventDefault(); return }
      const handle = el.querySelector('[data-drag-handle]') as HTMLElement | null
      if (handle && !handle.contains(ev.target)) { ev.preventDefault(); return }
    }

    const index = zone.opts.order().indexOf(id)
    if (index < 0) { ev.preventDefault(); return }

    ev.dataTransfer.effectAllowed = 'move'
    // Firefox без данных перенос не начнёт; заодно блок понятен внешнему миру
    try { ev.dataTransfer.setData(DND_MIME, JSON.stringify({ grid: zone.name, id })) } catch { /* noop */ }
    try { ev.dataTransfer.setData('text/plain', id) } catch { /* noop */ }

    // toIndex начинается с −1, а не с fromIndex: иначе первое же вычисленное
    // место совпало бы с «текущим», и метка соседа не нарисовалась бы
    drag = { fromZone: zone.name, id, fromIndex: index, el, toZone: zone.name, toIndex: -1 }
    setOver(zone.name)
    opts.onActive?.({ grid: zone.name, id })
    // приглушаем ПОСЛЕ кадра: иначе таким же уедет и снимок для картинки переноса
    requestAnimationFrame(() => { if (drag) el.style.opacity = '0.4' })
  }

  /**
   * Указатель над блоком. Единственный замер во всём движке: прямоугольник
   * этого блока — и тот снимается на входе в него, а не на каждое событие.
   */
  function onBlockOver(zone: Zone, id: string, el: HTMLElement, ev: DragEvent, rect: DOMRect | null) {
    if (!drag || !accepted(zone) || !rect) return
    ev.preventDefault()
    ev.stopPropagation()
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move'

    const order = zone.opts.order().filter(x => !(zone.name === drag!.fromZone && x === drag!.id))
    const at = order.indexOf(id)
    if (at < 0) return
    // правее середины блока — встаём за ним, левее — перед
    const after = ev.clientX > rect.left + rect.width / 2
    markDrop(zone.name, after ? at + 1 : at)
    setOver(zone.name)
  }

  /* ────────── события контейнера ────────── */

  function onZoneOver(zone: Zone, ev: DragEvent) {
    if (!drag || !accepted(zone)) return
    ev.preventDefault()
    ev.stopPropagation()
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move'
    setOver(zone.name)
    // сюда событие доходит, только если под курсором нет блока: пустое место
    // сетки — это «в конец»
    const order = zone.opts.order().filter(id => !(zone.name === drag!.fromZone && id === drag!.id))
    markDrop(zone.name, order.length)
  }

  function onZoneDrop(zone: Zone, ev: DragEvent) {
    if (!drag || !accepted(zone)) return
    ev.preventDefault()
    ev.stopPropagation()

    const d = drag
    const to = { zone: d.toZone, index: d.toIndex }
    clearDrag()

    if (to.index < 0) return                    // места не выбрали — дроп пустой
    if (to.zone !== d.fromZone) {
      opts.onTransfer?.({ grid: d.fromZone, id: d.id, index: d.fromIndex }, { grid: to.zone, index: to.index })
      return
    }
    if (to.index !== d.fromIndex) zones.get(d.fromZone)?.opts.onReorder?.(d.fromIndex, to.index)
  }

  return {
    grid(name: string, zoneOpts: DndZoneOptions): DndZoneEngine {
      const zone: Zone = zones.get(name) ?? { name, el: null, els: new Map(), opts: zoneOpts }
      zone.opts = zoneOpts
      zones.set(name, zone)

      return {
        attachContainer(el: HTMLElement) {
          zone.el = el
          const onEnter = (ev: DragEvent) => { if (drag && accepted(zone)) { ev.preventDefault(); ev.stopPropagation() } }
          const onOver = (ev: DragEvent) => onZoneOver(zone, ev)
          const onLeave = (ev: DragEvent) => {
            // dragleave прилетает и при переходе на потомка — это не выход
            if (!drag || (ev.relatedTarget instanceof Node && el.contains(ev.relatedTarget))) return
            if (over === zone.name) setOver(null)
          }
          const onDrop = (ev: DragEvent) => onZoneDrop(zone, ev)
          el.addEventListener('dragenter', onEnter)
          el.addEventListener('dragover', onOver)
          el.addEventListener('dragleave', onLeave)
          el.addEventListener('drop', onDrop)
          return () => {
            el.removeEventListener('dragenter', onEnter)
            el.removeEventListener('dragover', onOver)
            el.removeEventListener('dragleave', onLeave)
            el.removeEventListener('drop', onDrop)
            if (zone.el === el) zone.el = null
          }
        },

        attach(el: HTMLElement, id: string) {
          zone.els.set(id, el)
          el.dataset.dndBlock = id
          el.setAttribute('draggable', 'true')

          let rect: DOMRect | null = null
          const onStart = (ev: DragEvent) => onDragStart(zone, id, el, ev)
          const onEnd = () => clearDrag()
          // прямоугольник снимаем на входе в блок и держим, пока курсор в нём
          const onEnter = () => { rect = el.getBoundingClientRect() }
          const onOver = (ev: DragEvent) => {
            if (!rect) rect = el.getBoundingClientRect()
            onBlockOver(zone, id, el, ev, rect)
          }
          const onLeave = () => { rect = null }
          const onDrop = (ev: DragEvent) => onZoneDrop(zone, ev)

          el.addEventListener('dragstart', onStart)
          el.addEventListener('dragend', onEnd)
          el.addEventListener('dragenter', onEnter)
          el.addEventListener('dragover', onOver)
          el.addEventListener('dragleave', onLeave)
          el.addEventListener('drop', onDrop)
          return () => {
            el.removeEventListener('dragstart', onStart)
            el.removeEventListener('dragend', onEnd)
            el.removeEventListener('dragenter', onEnter)
            el.removeEventListener('dragover', onOver)
            el.removeEventListener('dragleave', onLeave)
            el.removeEventListener('drop', onDrop)
            el.removeAttribute('draggable')
            delete el.dataset.dndBlock
            if (zone.els.get(id) === el) zone.els.delete(id)
          }
        },
      }
    },

    active: () => (drag ? { grid: drag.fromZone, id: drag.id } : null),
    over: () => over,
    drop: () => (drag && drag.toIndex >= 0 ? { grid: drag.toZone, index: drag.toIndex } : null),
    destroy() {
      clearDrag()
      zones.clear()
    },
  }
}
