// Сетка на нативном drag-and-drop: события берём у Pragmatic drag and drop
// (Atlassian), геометрию и движение — своё.
//
// Разделение ответственности, и оно тут принципиальное:
//
//   Pragmatic  — нормализует нативный HTML5 DnD: парные dragenter/dragleave со
//                счётчиками вложенности, различия браузеров, «honey pot» под
//                курсором, порядок событий, отписки. Ровно то болото, в котором
//                руками тонешь. Плюс он сам троттлит поток в кадр (raf-schd).
//
//   Наше       — где именно встанет блок и как это показать: место считается
//                арифметикой по снимку, снятому на старте жеста, а соседи
//                расступаются FLIP-ом, то есть `transform` + `transition`.
//
// Их hitbox (`attachClosestEdge`) сознательно НЕ берём: он зовёт
// getBoundingClientRect внутри getData, а тот вызывается многократно, пока
// тащат над целью. Нам это не нужно — размеры блоков целые, ширина колонки
// известна из ResizeObserver, позиция считается без единого замера.
//
// И наоборот, FLIP тут не украшение: раз соседи ездят трансформом, layout за
// весь жест остаётся чистым. Меняли бы grid-позиции — каждый следующий замер
// стал бы forced reflow, а перестановка под курсором завела бы тот самый
// дребезг, ради которого всё и переписывалось.
//
// Тач не поддерживается — HTML5 DnD там не существует; для пальца есть `DumbGrid`.

import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine'
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { createAutoScroller } from '@solid-dumb-kit/shared'
import {
  cellRect, colWidth, moveDeltas, packFlow, reorder, rowCount,
  type Metrics, type Placed,
} from '@solid-dumb-kit/grid'
import { shouldAnimate } from '@solid-dumb-kit/shared'
import { createFlip, type Flip } from '@solid-dumb-kit/shared'

export type DndDragging = { grid: string; id: string; w: number; h: number }
export type DndTransferSource = { grid: string; id: string; index: number }
export type DndTransferTarget = { grid: string; index: number }

export type DndGroupOptions = {
  /** анимировать расступание; по умолчанию да, но не при prefers-reduced-motion */
  animate?: boolean
  /** блок переехал в ДРУГУЮ сетку — обе раскладки правит потребитель */
  onTransfer?: (from: DndTransferSource, to: DndTransferTarget) => void
  /** что тащат сейчас */
  onActive?: (state: DndDragging | null) => void
  /** над какой сеткой указатель */
  onOver?: (grid: string | null) => void
  /**
   * Сколько строк займёт сетка, если бросить блок прямо сейчас.
   *
   * Без этого контейнер остаётся прежней высоты: соседи разъезжаются
   * трансформом, а трансформ высоту не меняет. Нижние блоки тогда вылезают за
   * край — и, что хуже, курсор над ними оказывается ВНЕ зоны приёма, так что
   * дроп туда просто не проходит.
   */
  onRows?: (grid: string, rows: number) => void
}

export type DndZoneOptions = {
  order: () => Array<string>
  spanOf: (id: string) => { w: number; h: number }
  cols: () => number
  rowHeight: () => number
  gapX: () => number
  gapY: () => number
  disabled?: () => boolean
  accepts?: (from: string) => boolean
  onReorder?: (from: number, to: number) => void
}

/**
 * Позиция вставки в порядке чтения.
 *
 * Отличие от общего `insertIndex` кита — блоки во всю ширину строки. Общее
 * правило («в той же полосе и левее центра — значит раньше») для них
 * бессмысленно: делить по горизонтали нечего, курсор всегда внутри. Решает
 * вертикаль: ниже середины такого блока — встаём за ним.
 *
 * Своя копия, а не правка общей функции: `insertIndex` работает в `DumbGrid`,
 * и трогать его ради соседней реализации — способ сломать то, что уже ездит.
 */
function insertIndexReading(args: {
  base: Array<Placed>
  dragId: string
  m: Metrics
  x: number
  y: number
}): number {
  const { base, dragId, m, x, y } = args
  let k = 0
  for (const p of base) {
    if (p.id === dragId) continue
    const r = cellRect(p, m)
    if (p.w >= m.cols) {
      if (y > r.y + r.height / 2) k++         // строка целиком его — делим по высоте
      continue
    }
    if (y > r.y + r.height) k++               // блок целиком выше указателя
    else if (y >= r.y && x > r.x + r.width / 2) k++   // та же полоса, правее центра
  }
  return k
}

/**
 * Куда встанет блок и как для этого разъезжаются соседи — вся решающая часть,
 * без DOM и событий. Вынесена наружу, чтобы проверяться тестами напрямую:
 * жест руками не воспроизвести, а вот арифметику — сколько угодно.
 */
export function planDrop(args: {
  /** порядок и размеры блоков сетки-приёмника */
  spans: Array<{ id: string; w: number; h: number }>
  /**
   * Раскладка, по которой считать пороги, — та, что сейчас видна. Не задана —
   * берём укладку самих spans (первый заход в сетку).
   */
  base?: Array<Placed>
  m: Metrics
  /** указатель в координатах контента сетки */
  x: number
  y: number
  /** блок гостя: id, размер и индекс, если он из ЭТОЙ же сетки */
  drag: { id: string; w: number; h: number; fromIndex: number | null }
}): { index: number; next: Array<Placed>; moves: Array<{ id: string; dx: number; dy: number }>; rect: { x: number; y: number; width: number; height: number } | null } {
  const { spans, m, x, y, drag } = args
  const home = drag.fromIndex !== null
  const layout = packFlow(spans, m.cols)        // «как лежит на самом деле»
  const base = args.base ?? layout             // «как выглядит сейчас»

  // сам перетаскиваемый в подсчёте не участвует, где бы он ни был
  const index = insertIndexReading({ base, dragId: drag.id, m, x, y })

  let next: Array<Placed>
  if (home) {
    next = packFlow(reorder(spans, drag.fromIndex as number, index), m.cols)
  } else {
    const merged = spans.slice()
    merged.splice(index, 0, { id: drag.id, w: Math.min(drag.w, m.cols), h: drag.h })
    next = packFlow(merged, m.cols)
  }

  const me = next.find((b) => b.id === drag.id)
  return {
    index,
    next,
    // сдвиги считаем от НАСТОЯЩЕЙ укладки: transform у блоков абсолютный,
    // а не накопительный — иначе они уезжали бы дважды
    moves: moveDeltas({ base: layout, next, m, skipId: drag.id }),
    rect: me ? cellRect(me, m) : null,
  }
}

export type DndZoneEngine = {
  attachContainer: (el: HTMLElement) => () => void
  attach: (el: HTMLElement, id: string) => () => void
}

export type DndEngine = {
  grid: (name: string, opts: DndZoneOptions) => DndZoneEngine
  active: () => DndDragging | null
  over: () => string | null
  destroy: () => void
}

const SLIDE = 'transform .18s cubic-bezier(.2,.8,.2,1)'
const PREVIEW_BG = 'rgba(59,130,246,.10)'
const PREVIEW_LINE = '2px dashed rgba(59,130,246,.85)'

type Zone = {
  name: string
  el: HTMLElement | null
  els: Map<string, HTMLElement>
  opts: DndZoneOptions
  ro: ResizeObserver | null
  contentW: number
  padLeft: number
  padTop: number
}

/** снимок сетки на время жеста: метрики, раскладка и где она была */
type Snap = {
  zone: Zone
  m: Metrics
  base: Array<Placed>
  left: number
  top: number
  winX: number
  winY: number
}

type Drag = {
  fromZone: string
  id: string
  fromIndex: number
  el: HTMLElement
  span: { w: number; h: number }
  toZone: string
  toIndex: number
  snaps: Map<string, Snap>
  /** раскладка, которая СЕЙЧАС отрисована в целевой сетке */
  view: Array<Placed>
  /** блоки, которым довелось поехать — только их стили и трогаем */
  touched: Set<HTMLElement>
  /** проигрыватель сдвигов: пишет только тем блокам, что реально едут */
  flip: Flip
  preview: HTMLElement | null
  previewZone: string | null
}

export function createGridDndEngine(opts: DndGroupOptions = {}): DndEngine {
  const zones = new Map<string, Zone>()
  let drag: Drag | null = null
  let over: string | null = null
  let stopMonitor: (() => void) | null = null
  /** прямоугольники контейнеров, снятые наблюдателем на старте жеста */
  const boxes = new Map<string, { left: number; top: number }>()
  const scroller = createAutoScroller()

  const setOver = (name: string | null) => {
    if (over === name) return
    over = name
    opts.onOver?.(name)
  }

  const metricsOf = (z: Zone): Metrics => {
    const cols = Math.max(1, Math.floor(z.opts.cols()))
    const gapX = z.opts.gapX()
    return { cols, colW: colWidth(z.contentW, cols, gapX), rowH: z.opts.rowHeight(), gapX, gapY: z.opts.gapY() }
  }

  /**
   * Прямоугольники контейнеров — одним IntersectionObserver, без единого
   * forced layout: `entry.boundingClientRect` считается off-main-thread.
   * Снимаем все зоны разом на старте жеста, поэтому вход в соседнюю сетку уже
   * ничего не меряет.
   */
  function snapshotZones(cb: () => void) {
    const targets: Array<HTMLElement> = []
    for (const z of zones.values()) if (z.el) targets.push(z.el)
    if (!targets.length || typeof IntersectionObserver !== 'function') { cb(); return }

    let batches = 0
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const name = (e.target as HTMLElement).dataset.dndZone
        if (name) boxes.set(name, { left: e.boundingClientRect.left, top: e.boundingClientRect.top })
      }
      batches++
      // наблюдатель не обязан прислать всё одним батчем — ждём каждую цель,
      // но не бесконечно: молчащая не должна вешать жест
      if (boxes.size < targets.length && batches < 4) return
      io.disconnect()
      cb()
    })
    for (const t of targets) io.observe(t)
  }

  /** Снимок сетки: раскладка своя, прямоугольник — из снятых наблюдателем. */
  function snapOf(zone: Zone): Snap | null {
    const box = zone.el ? boxes.get(zone.name) : null
    if (!zone.el || !box) return null
    const m = metricsOf(zone)
    const spans = zone.opts.order().map((id) => ({ id, ...zone.opts.spanOf(id) }))
    return {
      zone, m,
      base: packFlow(spans, m.cols),
      left: box.left + zone.padLeft,
      top: box.top + zone.padTop,
      winX: window.scrollX, winY: window.scrollY,
    }
  }

  /** Указатель в координатах контента сетки (прокрутку страницы компенсируем). */
  function pointIn(s: Snap, x: number, y: number) {
    return {
      x: x - (s.left - (window.scrollX - s.winX)),
      y: y - (s.top - (window.scrollY - s.winY)),
    }
  }

  const snapFor = (d: Drag, zone: Zone): Snap | null => {
    let s = d.snaps.get(zone.name)
    if (!s) {
      const fresh = snapOf(zone)
      if (!fresh) return null
      d.snaps.set(zone.name, (s = fresh))
    }
    return s
  }

  /* ────────── FLIP: соседи разъезжаются трансформом ────────── */

  function slide(d: Drag, zone: Zone, moves: Array<{ id: string; dx: number; dy: number }>) {
    for (const mv of moves) {
      const el = zone.els.get(mv.id)
      if (!el || el === d.el) continue
      d.touched.add(el)
      d.flip.to(el, mv.dx, mv.dy)
    }
  }

  /** Вернуть на места блоки сетки, из которой жест ушёл. */
  function calm(d: Drag) {
    for (const el of d.touched) d.flip.to(el, 0, 0)
    d.touched.clear()
  }

  /** Снять всё, что жест навесил на блоки. */
  function unarm(d: Drag) {
    d.flip.clear()
    d.touched.clear()
  }

  /** Контур будущего места — один absolute-элемент, двигается тоже трансформом. */
  function showPreview(d: Drag, zone: Zone, rect: { x: number; y: number; width: number; height: number }) {
    if (!zone.el) return
    if (d.preview && d.previewZone !== zone.name) {
      d.preview.remove()
      d.preview = null
    }
    if (!d.preview) {
      const box = document.createElement('div')
      box.dataset.dndGhost = ''
      box.setAttribute('aria-hidden', 'true')
      box.style.cssText = [
        'position:absolute', 'left:0', 'top:0', 'pointer-events:none',
        'box-sizing:border-box', 'border-radius:10px', 'z-index:5',
        `background:${PREVIEW_BG}`, `outline:${PREVIEW_LINE}`, 'outline-offset:-2px',
      ].join(';')
      if (shouldAnimate(opts.animate)) box.style.transition = SLIDE
      zone.el.appendChild(box)
      d.preview = box
      d.previewZone = zone.name
    }
    d.preview.style.width = `${rect.width}px`
    d.preview.style.height = `${rect.height}px`
    d.preview.style.transform = `translate(${rect.x}px,${rect.y}px)`
  }

  /* ────────── ход жеста ────────── */

  /** Пересчитать место и показать его. Вызывается из событий Pragmatic. */
  function update(d: Drag, zone: Zone, x: number, y: number) {
    if (!boxes.size) return          // снимок ещё не пришёл — двигать нечего
    const s = snapFor(d, zone)
    if (!s) return
    const home = zone.name === d.fromZone
    const p = pointIn(s, x, y)

    // Пороги берём с ВИДИМОЙ раскладки, а не со снятой на старте.
    //
    // Соседи уже разъехались: сравнивая курсор с их исходными центрами, место
    // переключается не там, где это видно глазом — блок под курсором давно
    // уехал, а решение принимается по его старым границам. Отсюда и ощущение,
    // что превью прыгает мимо.
    //
    // Заодно это даёт гистерезис даром: пройдя центр видимого соседа, мы его
    // сдвигаем, и чтобы вернуться обратно, курсору надо пересечь центр уже
    // другого блока. Мёртвая зона шириной с сам блок — дребезжать нечему.
    const plan = planDrop({
      spans: zone.opts.order().map((id) => ({ id, ...zone.opts.spanOf(id) })),
      base: d.toZone === zone.name ? d.view : undefined,
      m: s.m, x: p.x, y: p.y,
      drag: { id: d.id, ...d.span, fromIndex: home ? d.fromIndex : null },
    })
    const k = plan.index
    if (zone.name === d.toZone && k === d.toIndex) return

    if (zone.name !== d.toZone) calm(d)          // ушли в другую сетку — прошлая расслабляется
    d.toZone = zone.name
    d.toIndex = k

    d.view = plan.next
    slide(d, zone, plan.moves)
    if (plan.rect) showPreview(d, zone, plan.rect)
    opts.onRows?.(zone.name, rowCount(plan.next))
  }

  function endDrag() {
    if (!drag) return
    scroller.stop()
    const d = drag
    for (const name of d.snaps.keys()) opts.onRows?.(name, 0)   // высоту отдаём обратно раскладке
    unarm(d)
    d.preview?.remove()
    d.el.style.opacity = ''
    drag = null
    setOver(null)
    opts.onActive?.(null)
  }

  /* ────────── регистрация ────────── */

  /** Один монитор на группу: он и даёт координаты, и знает активные цели. */
  function ensureMonitor() {
    if (stopMonitor) return
    stopMonitor = monitorForElements({
      canMonitor: ({ source }) => Boolean(source.data?.dumbGridId),
      onDrag({ location }) {
        if (!drag) return
        scroller.move(location.current.input.clientX, location.current.input.clientY)
        // цели идут от внутренней к внешней — берём ближайшую нашу
        for (const target of location.current.dropTargets) {
          const name = target.data?.dumbGridZone
          const zone = typeof name === 'string' ? zones.get(name) : null
          if (!zone) continue
          setOver(zone.name)
          update(drag, zone, location.current.input.clientX, location.current.input.clientY)
          return
        }
        setOver(null)
      },
      onDrop({ location }) {
        const d = drag
        if (!d) return
        // порядок важен: сначала читаем состояние, потом прибираем
        const dropped = location.current.dropTargets.some(
          (t) => t.data?.dumbGridZone === d.toZone,
        )
        const { toZone, toIndex, fromZone, fromIndex, id } = d
        endDrag()
        if (!dropped || toIndex < 0) return

        if (toZone !== fromZone) {
          opts.onTransfer?.({ grid: fromZone, id, index: fromIndex }, { grid: toZone, index: toIndex })
          return
        }
        if (toIndex !== fromIndex) zones.get(fromZone)?.opts.onReorder?.(fromIndex, toIndex)
      },
    })
  }

  return {
    grid(name: string, zoneOpts: DndZoneOptions): DndZoneEngine {
      const zone: Zone = zones.get(name) ?? {
        name, el: null, els: new Map(), opts: zoneOpts, ro: null, contentW: 0, padLeft: 0, padTop: 0,
      }
      zone.opts = zoneOpts
      zones.set(name, zone)
      ensureMonitor()

      return {
        attachContainer(el: HTMLElement) {
          zone.el = el
          el.dataset.dndZone = zone.name
          const stop = dropTargetForElements({
            element: el,
            // данные статичны: считать что-то в getData значило бы считать это
            // на каждое движение — место мы вычисляем сами и по снимку
            getData: () => ({ dumbGridZone: zone.name }),
            canDrop: ({ source }) => {
              const from = source.data?.dumbGridZone
              if (typeof from !== 'string') return false
              if (from === zone.name) return true
              return !zone.opts.accepts || zone.opts.accepts(from)
            },
          })

          let ro: ResizeObserver | null = null
          if (typeof ResizeObserver === 'function') {
            // ширина контента приходит сама, без reflow; оттуда же отступы
            ro = new ResizeObserver((entries) => {
              const r = entries[entries.length - 1]?.contentRect
              if (!r) return
              zone.contentW = r.width
              zone.padLeft = r.left
              zone.padTop = r.top
            })
            ro.observe(el)
            zone.ro = ro
          }

          return () => {
            stop()
            ro?.disconnect()
            delete el.dataset.dndZone
            if (zone.ro === ro) zone.ro = null
            if (zone.el === el) zone.el = null
          }
        },

        attach(el: HTMLElement, id: string) {
          zone.els.set(id, el)
          el.dataset.dndBlock = id

          const stop = draggable({
            element: el,
            canDrag: () => {
              if (zone.opts.disabled?.()) return false
              return zone.opts.order().includes(id)
            },
            getInitialData: () => ({ dumbGridZone: zone.name, dumbGridId: id }),
            onDragStart() {
              const index = zone.opts.order().indexOf(id)
              if (index < 0) return
              const span = zone.opts.spanOf(id)

              boxes.clear()
              drag = {
                fromZone: zone.name, id, fromIndex: index, el, span,
                toZone: zone.name, toIndex: index,
                snaps: new Map(), view: [],
                touched: new Set(), flip: createFlip(shouldAnimate(opts.animate)),
                preview: null, previewZone: null,
              }
              setOver(zone.name)
              opts.onActive?.({ grid: zone.name, id, ...span })
              el.style.opacity = '0.4'
              scroller.start(zone.el ?? el)

              // снимок асинхронный: до него жест просто ничего не двигает
              snapshotZones(() => {
                if (!drag || drag.id !== id) return
                const snap = snapOf(zone)
                if (!snap) return
                drag.snaps.set(zone.name, snap)
                drag.view = snap.base
              })
            },
            // ЗДЕСЬ убирать за собой нельзя: этот обработчик срабатывает раньше
            // монитора, а тому ещё нужно прочитать, куда блок сел. Всё вместе —
            // и уборку, и коммит — делает монитор.

          })

          return () => {
            stop()
            delete el.dataset.dndBlock
            if (zone.els.get(id) === el) zone.els.delete(id)
          }
        },
      }
    },

    active: () => (drag ? { grid: drag.fromZone, id: drag.id, ...drag.span } : null),
    over: () => over,
    destroy() {
      endDrag()
      stopMonitor?.()
      stopMonitor = null
      for (const z of zones.values()) {
        z.ro?.disconnect()
        z.ro = null
        z.els.clear()
        z.el = null
      }
      zones.clear()
    },
  }
}

/** Есть ли нативный DnD вообще (на тач-устройствах его нет). */
export const dndSupported = () =>
  typeof DataTransfer === 'function' && typeof DragEvent === 'function'

/** формат данных переноса — Pragmatic кладёт свои, этот остаётся для совместимости */
export const DND_MIME = 'application/x-dumb-grid'
