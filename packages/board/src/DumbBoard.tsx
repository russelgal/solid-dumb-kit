// Доска: секции с блоками. Блоки переставляются внутри секции и переносятся
// между секциями, сами секции переставляются и меняют размер.
//
// Внутри секции блоки живут на СЕТКЕ ЯЧЕЕК: размер блока целый (w колонок зоны
// × h строк), шаг строки фиксирован (`rowHeight`). Отсюда всё остальное:
//
// 1. ВНУТРИ секции DOM не трогается — место задаётся явными
//    `grid-column-start`/`grid-row-start`, посчитанными `packFlow`. Явными, а не
//    авто-потоком, по той же причине, что и в DumbGrid: иначе браузер домысливает
//    раскладку и она расходится с арифметикой FLIP.
// 2. Перенос в соседнюю секцию без перестановки DOM невозможен — блок живёт
//    внутри своего контейнера. Это единственное место, где DOM меняется.
// 3. Оба случая доигрывает FLIP, и ему всё равно, что именно произошло, — он
//    знает только «стартуй отсюда, приезжай в ноль».
//
// Целые размеры дают две вещи даром: позиции блоков — арифметика (снимок
// блоков через IntersectionObserver не нужен вовсе, наблюдаем только зоны и
// секции), а разметка сетки рисуется теми же линиями, что в DumbGrid.
//
// Блок, не влезающий в остаток строки, не обязан уезжать вниз: `minW` из
// `blockLimits` говорит, до какой ширины он согласен ужаться. Ужатая ширина
// НИГДЕ не хранится — она заново выводится из раскладки, поэтому на просторном
// месте блок сам разворачивается обратно.
//
// Жест блоков и секций — нативный drag-and-drop: зону под курсором определяет
// браузер. Ресайз — НАПРОТИВ, указательные события: перенос отвечает на вопрос
// «куда положить», а ресайз тянут покадрово, чего `dragover` не даёт.
//
// Тач для переноса не поддерживается (HTML5 DnD там не существует); ресайз на
// указателе работает и пальцем.

// onMounted вместо onMount: в Solid 2 onMount не экспортируется (shared/solidCompat)
import { For, Show, createEffect, createMemo, createSignal, onCleanup, type JSX } from 'solid-js'
import { createAutoScroller, createFlip, createStableOrder, injectStyle, onMounted, shouldAnimate, type Flip } from '@solid-dumb-kit/shared'
// математика сетки общая с DumbGrid — своей у доски только поток секций
import {
  cellRect, colWidth, gridLinesBackground, packFlow, resolveSpan, rowCount, snapSpan, spanSize,
  type Metrics, type Placed, type SpanLimits, type SpanValue,
} from '@solid-dumb-kit/grid'
import { moveAt, panelFlow, type PanelBox, type Slot } from './boardMath'

/**
 * Пределы размера блока в ячейках. Ширины принимают долю (`'half'`, `'2/5'`) —
 * она разрешается по числу колонок ЗОНЫ, высоты только числами: строк у зоны
 * столько, сколько потребуется.
 */
export type BlockLimits = {
  minW?: SpanValue
  maxW?: SpanValue
  minH?: number
  maxH?: number
}

export type BoardSection<T = unknown> = {
  id: string
  /** блоки этой секции; порядок в массиве = порядок на экране */
  items: Array<T>
  /** заголовок; он же ручка переноса секции. Не задан — шапки нет вовсе */
  title?: JSX.Element
  /** приписка мельче под заголовком */
  subtitle?: JSX.Element
  /** колонок ВНУТРИ секции (сетка блоков); по умолчанию 3 */
  cols?: number
  /** ширина секции в колонках доски; по умолчанию половина */
  span?: number
  /** высота в строках сетки блоков; не задана — по содержимому */
  rows?: number
  /** пускать ли сюда блоки из секции `from`; по умолчанию пускать всех */
  accepts?: (from: string) => boolean
}

export type DumbBoardProps<T> = {
  /** секции вместе с их блоками — ОДИН массив, он же всё состояние доски */
  sections: Array<BoardSection<T>>
  /**
   * Позвать с новой раскладкой. Зовётся ПО ХОДУ жеста, на каждом шаге: данные
   * всё время совпадают с тем, что на экране, и ничего не теряется, если
   * браузер не доставит `drop`. Секции доска не мутирует — отдаёт новый массив.
   */
  setSections: (next: Array<BoardSection<T>>) => void
  /** стабильный id блока */
  id: (item: T) => string

  /** блок переехал: в секцию `toSection`, на место `toIndex` среди её блоков */
  onMove?: (item: T, toSection: string, toIndex: number) => void
  /** секцию перетащили за заголовок */
  onSectionMove?: (fromIndex: number, toIndex: number) => void
  /** секции сменили размер: колонок доски и строк сетки блоков */
  onSectionResize?: (id: string, size: { span: number; rows: number }) => void

  /**
   * Сколько колонок зоны занимает блок; по умолчанию одну. Кроме числа
   * принимается доля (`'half'`, `'1/3'`) — она разрешается по числу колонок зоны.
   */
  blockSpan?: (item: T) => SpanValue
  /**
   * Пределы размера блока в ячейках. `minW` работает дважды: до неё блок
   * согласен ужаться, чтобы влезть в остаток строки вместо переезда вниз, и
   * ниже неё его не пустит ресайз. Ужатая ширина не хранится нигде — на
   * свободном месте блок сам вернётся к `blockSpan`.
   */
  blockLimits?: (item: T) => BlockLimits
  /** высота блока в строках сетки зоны; по умолчанию одна */
  blockRows?: (item: T) => number
  /**
   * Блок сменил размер — сохрани его у себя. Пока проп не задан, у блоков нет
   * ни ручки, ни жеста: размер живёт в твоих данных, и менять его без спроса
   * доска не станет.
   */
  onBlockResize?: (item: T, size: { w: number; h: number }) => void

  /** колонок у самой доски; по умолчанию 12 */
  cols?: number
  /** зазор сетки доски, px; по умолчанию 14 */
  gap?: number
  /** шаг строки внутри секции, px — он же высота ячейки зоны; по умолчанию 76 */
  rowHeight?: number
  /** зазор сетки ВНУТРИ секции, px; по умолчанию 8 */
  zoneGap?: number
  /** минимальная ширина секции в колонках; по умолчанию 3 */
  minSpan?: number
  /**
   * Показывать разметку сетки внутри секций: `true` — всегда, `'drag'` — только
   * пока тащат блок (по умолчанию), `false` — никогда.
   */
  showGrid?: boolean | 'drag'

  /** правка: без неё нет ни жестов, ни ручек, ни единого слушателя на блоках */
  editable?: boolean
  /** анимировать; по умолчанию да, но не при prefers-reduced-motion */
  animate?: boolean
  /** разрешить ресайз секций; по умолчанию да */
  resizable?: boolean

  /** подписи для доступности — заголовки ручек */
  labels?: { resizeBlock?: string }
  /** свои кнопки в правой части шапки секции */
  sectionActions?: (section: BoardSection<T>) => JSX.Element
  class?: string
  style?: JSX.CSSProperties
  /** ВЕРНИ один корневой элемент — компонент привяжется прямо к нему */
  children: (item: T, section: BoardSection<T>) => JSX.Element
}

/**
 * Структурные стили — сетка, позиции ручек, приглушение источника. Кладутся в
 * `<head>` один раз на документ: внутри дерева они исчезли бы вместе с первым
 * размонтированным экземпляром. Всё остальное оформление твоё.
 */
const STYLES = `
          .dumb-board { display: grid; align-items: start; gap: var(--dumb-board-gap);
                        grid-template-columns: repeat(var(--dumb-board-cols), 1fr) }
          .dumb-board-panel { position: relative; min-width: 0 }
          .dumb-board-panel.held { opacity: .35 }
          .dumb-board-head { display: flex; align-items: center; gap: 6px; margin: 0 0 8px;
                             font: inherit; font-size: 13px; cursor: grab; user-select: none }
          .dumb-board-head:active { cursor: grabbing }
          /* всё, что читают или хватают, — контрастное: блёклая ручка и серый по
             серому не читаются ни на проекторе, ни при ярком свете */
          .dumb-board-grip { color: var(--dumb-board-grip, #64748b) }
          .dumb-board-title { display: flex; align-items: baseline; gap: 6px; min-width: 0 }
          .dumb-board-sub { font-size: 11.5px; font-weight: 400; opacity: .85 }
          .dumb-board-count { padding: 1px 7px; border-radius: 999px; font-size: 11px;
                              background: rgb(0 0 0 / .1) }
          .dumb-board-actions { margin-left: auto; display: flex; gap: 4px }
          /* сетка блоков: ячейки фиксированного шага, места задаются явно */
          /* overflow-x именно clip, а не visible: рядом с overflow-y: auto
             visible вычисляется в auto, и FLIP, вынося блок за правый край,
             зажигает горизонтальную полосу на время анимации. clip такого не
             делает и не мешает вертикальной оси прокручиваться */
          .dumb-board-zone { position: relative; display: grid; gap: var(--dumb-board-zone-gap);
                             align-content: start; overflow-x: clip; overflow-y: auto;
                             scrollbar-gutter: stable;
                             grid-template-columns: repeat(var(--dumb-board-inner), minmax(0, 1fr));
                             grid-auto-rows: var(--dumb-board-row) }
          /* Подложка с линиями: не участвует в сетке (absolute), поэтому не
             занимает ячеек и не расталкивает блоки.

             padding: inherit и background-*: content-box обязательны — сетка
             начинается ПОСЛЕ padding зоны, а absolute-слой отсчитывается от
             padding-box. Без этого линии съезжают ровно на padding. */
          .dumb-board-lines { position: absolute; inset: 0; pointer-events: none; z-index: 0;
                              padding: inherit; box-sizing: border-box;
                              background-origin: content-box; background-clip: content-box;
                              background-repeat: no-repeat, repeat;
                              transition: opacity .15s ease;
                              /* СВОЙ СЛОЙ обязателен: подложка размером во всю
                                 зону и с двумя градиентами, а гасится через
                                 opacity. Без слоя браузер перерисовывает эти
                                 градиенты каждый кадр анимации — на замере это
                                 две трети всех перекрасок за жест. */
                              will-change: opacity }
          /* рамка будущего размера: САМА grid item, поэтому встаёт в ячейки без
             пиксельной арифметики — и не мешает блокам, у которых места явные */
          .dumb-board-frame { pointer-events: none; z-index: 3; border-radius: 10px;
                              border: 2px dashed rgba(59,130,246,.9);
                              background: rgba(59,130,246,.08) }
          /* ручка ресайза блока — тот же уголок, что у секции: две линии со
             скруглением. Рисуем сами, а не Tailwind'ом: кит самодостаточен */
          .dumb-board-block-grip { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px;
                                   cursor: nwse-resize; touch-action: none; z-index: 2 }
          /* цвет КОНТРАСТНЫЙ: ручка — орган управления, её надо видеть, а не
             угадывать. Перекрывается переменной, но блёклый дефолт недопустим */
          .dumb-board-block-grip::after { content: ''; position: absolute; right: 4px; bottom: 4px;
                                          width: 9px; height: 9px;
                                          border-right: 2px solid var(--dumb-board-grip, #475569);
                                          border-bottom: 2px solid var(--dumb-board-grip, #475569);
                                          border-bottom-right-radius: 3px }
          .dumb-board-block-grip:hover::after { border-color: var(--dumb-board-grip-hover, #1e293b) }
          /* блок занимает СВОИ ячейки целиком — высота приходит из сетки, а не
             из содержимого, поэтому мерить её не нужно вовсе */
          .dumb-board-block { min-width: 0; min-height: 0; position: relative; z-index: 1 }
          .dumb-board-block.held { opacity: .35 }
          .dumb-board-grip-x { position: absolute; top: 26px; right: -9px; bottom: 12px; width: 12px;
                               cursor: col-resize; touch-action: none }
          .dumb-board-grip-y { position: absolute; left: 12px; right: 12px; bottom: -9px; height: 12px;
                               cursor: row-resize; touch-action: none }
          .dumb-board-grip-xy { position: absolute; right: -9px; bottom: -9px; width: 16px; height: 16px;
                                cursor: nwse-resize; touch-action: none }
        `

export function DumbBoard<T>(props: DumbBoardProps<T>) {
  injectStyle('board', STYLES)

  const cols = () => props.cols ?? 12
  const gap = () => props.gap ?? 14
  const rowH = () => props.rowHeight ?? 76
  const zoneGap = () => props.zoneGap ?? 8
  const minSpan = () => props.minSpan ?? 3
  const editable = () => props.editable !== false
  const resizable = () => props.resizable !== false
  const showGrid = () => props.showGrid ?? 'drag'
  const gridVisible = () => showGrid() === true || (showGrid() === 'drag' && !!held())

  const spanOf = (s: BoardSection<T>) => Math.max(1, Math.min(cols(), s.span ?? Math.floor(cols() / 2)))
  const colsIn = (s: BoardSection<T>) => Math.max(1, s.cols ?? 3)
  const sectionById = (id: string) => props.sections.find((s) => s.id === id)!
  /** блоки секции в их ПОКАЗНОМ порядке — он же порядок в её массиве */
  const itemsOf = (id: string) => sectionById(id)?.items ?? []
  /** в какой секции лежит блок */
  const sectionOf = (blockId: string) =>
    props.sections.find((s) => s.items.some((it) => props.id(it) === blockId))
  /** сколько колонок ЗОНЫ занимает блок — доли разрешаются по её ширине */
  const spanOfBlock = (item: T, s?: BoardSection<T>) => {
    const sec = s ?? sectionOf(props.id(item))
    const n = sec ? colsIn(sec) : 1
    return resolveSpan(props.blockSpan?.(item), n)
  }
  /**
   * Пределы в ЧИСЛАХ: доли разрешаются по колонкам зоны здесь, на границе, —
   * дальше внутрь идут только числа, как и в математике сетки.
   */
  const limitsOf = (item: T, s?: BoardSection<T>): SpanLimits => {
    const lim = props.blockLimits?.(item)
    if (!lim) return {}
    const n = colsIn(s ?? sectionOf(props.id(item)) ?? ({ cols: 1 } as BoardSection<T>))
    return {
      minW: lim.minW === undefined ? undefined : resolveSpan(lim.minW, n),
      maxW: lim.maxW === undefined ? undefined : resolveSpan(lim.maxW, n),
      minH: lim.minH,
      maxH: lim.maxH,
    }
  }
  /** высота блока в строках зоны */
  const rowsOfBlock = (item: T) => Math.max(1, Math.round(props.blockRows?.(item) ?? 1))
  /**
   * Порядок РЕНДЕРА, а не показа. `<For>` по нему не пересоздаёт узлы при
   * перестановке — сортировка по id не зависит от того, как секции показаны, —
   * а порядок на экране задаёт CSS `order`. Тот же приём, что у блоков внутри
   * секции: DOM не трогается вовсе, двигает браузер.
   *
   * Итерируем СТРОКИ, а не объекты: `<For>` сравнивает по значению, и пересоздание
   * не случится, даже если потребитель отдаст новые объекты секций (а он отдаст —
   * на каждом ресайзе).
   */
  // порядок разметки — по появлению; см. `createStableOrder`
  const stableSections = createStableOrder((s: BoardSection<T>) => s.id)
  const stableItems = createStableOrder(props.id)
  const renderOrder = () => stableSections.sort(props.sections).map((s) => s.id)
  const showOrder = (id: string) => props.sections.findIndex((s) => s.id === id)

  /**
   * Блоки секции в порядке РЕНДЕРА — по id, а не по показу.
   *
   * Это половина всего смысла компонента. Если рендерить в показном порядке,
   * `<For>` при каждой перестановке двигает узлы, и обещание «внутри секции DOM
   * не трогается» превращается в неправду: браузер перекладывает дерево, FLIP
   * анимирует пустоту, а соседи стоят на месте. Сортировка по id от показа не
   * зависит, поэтому `<For>` не делает ничего, а порядок задаёт CSS `order`.
   */
  // Номера раздаём по ВСЕМ блокам доски разом, а секции потом фильтруют: если
  // кормить помощник посекционно, его уборка выбросит блоки соседних секций.
  const ranked = createMemo(() => stableItems.sort(props.sections.flatMap((s) => s.items)))
  const renderItemsOf = (id: string) => {
    const own = new Set(itemsOf(id).map(props.id))
    return ranked().filter((it) => own.has(props.id(it)))
  }
  /**
   * Место каждого блока среди блоков своей секции — одной картой на всю доску.
   * Считать его поиском по массиву на каждый блок значит получить квадрат:
   * двести блоков — сорок тысяч сравнений на перерисовку.
   */
  const places = createMemo(() => {
    const out = new Map<string, number>()
    for (const s of props.sections) s.items.forEach((it, k) => out.set(props.id(it), k))
    return out
  })
  const placeOf = (item: T) => places().get(props.id(item)) ?? 0

  const [held, setHeld] = createSignal<string | null>(null)
  const [heldSection, setHeldSection] = createSignal<string | null>(null)
  const [sizing, setSizing] = createSignal<string | null>(null)

  const blockEls = new Map<string, HTMLElement>()
  const zoneEls = new Map<string, HTMLElement>()
  const panelEls = new Map<string, HTMLElement>()
  let wrapEl!: HTMLElement

  /**
   * Где начинается контент зоны — снимается разом, НЕ во время жеста. Размеры
   * блоков отсюда пропали: они целые, и позиция считается арифметикой.
   */
  let zoneAt: Record<string, Slot> = {}
  let panelH: Record<string, number> = {}
  let wrapAt: Slot = { left: 0, top: 0 }
  /** ширина колонки доски: приходит из ResizeObserver, а не из замера */
  let colW = 0
  /** ширина КОНТЕНТА каждой зоны — тоже из ResizeObserver */
  const zoneW: Record<string, number> = {}
  /**
   * Отступ контента зоны от её угла: `IntersectionObserver` отдаёт border-box, а
   * сетка начинается после padding. Берётся из `contentRect` того же
   * ResizeObserver — своих замеров опять не нужно.
   */
  const zonePad: Record<string, Slot> = {}

  let flip: Flip = createFlip(true)
  createEffect(() => { flip = createFlip(shouldAnimate(props.animate)) })
  const scroller = createAutoScroller()
  onCleanup(() => scroller.stop())

  /**
   * Снять геометрию: на монтировании, после дропа, на resize — но НИКОГДА
   * посреди жеста. `IntersectionObserver`, а не `getBoundingClientRect`: bounds
   * считаются off-main-thread, forced layout не случается даже на сотне блоков.
   */
  function measure() {
    const targets = [...zoneEls.values(), ...panelEls.values(), wrapEl].filter(Boolean)
    if (!targets.length || typeof IntersectionObserver !== 'function') return

    const rects = new Map<Element, DOMRectReadOnly>()
    let batches = 0
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) rects.set(e.target, e.boundingClientRect)
      batches++
      // наблюдатель не обязан прислать всё одним батчем — ждём каждую цель, но
      // не бесконечно: молчащая (display:none) не должна вешать доску
      if (rects.size < targets.length && batches < 4) return
      io.disconnect()

      // От зоны нужен только её угол: где внутри неё лежит блок, считает
      // `packFlow`, а ширину колонки даёт ResizeObserver.
      const next: Record<string, Slot> = {}
      for (const s of props.sections) {
        const r = rects.get(zoneEls.get(s.id)!)
        if (r) next[s.id] = { left: r.left, top: r.top }
      }
      zoneAt = next

      // у секций запоминаем только ВЫСОТЫ: позиции считает `panelFlow`, потому
      // что секции разной ширины и перестановка перекладывает всю сетку
      for (const s of props.sections) {
        const r = rects.get(panelEls.get(s.id)!)
        if (r) panelH[s.id] = r.height
      }
      const wr = rects.get(wrapEl)
      if (wr) wrapAt = { left: wr.left, top: wr.top }
    })
    for (const t of targets) io.observe(t)
  }

  /**
   * Замерить, когда всё встанет.
   *
   * `boundingClientRect` у `IntersectionObserver` считается С УЧЁТОМ transform, а
   * FLIP на дропе как раз доигрывает переезд. Замер в этот момент снимает
   * промежуточные позиции: начало координат зоны уезжает на десяток пикселей, и
   * следующий жест стартует блоки не оттуда, где они на самом деле.
   */
  function measureWhenStill() {
    const anims = [...blockEls.values(), ...panelEls.values()]
      .filter(Boolean)
      .flatMap((el) => el.getAnimations())
    if (!anims.length) { measure(); return }
    Promise.allSettled(anims.map((a) => a.finished)).then(() => measure())
  }

  /**
   * Ширины — из ResizeObserver, а не из замеров: доски (шаг колонки при ресайзе
   * секций) и каждой зоны (шаг ячейки внутри неё).
   *
   * Зоны наблюдаем по ref'у, а не списком в `onMount`: секции появляются и
   * исчезают, а ref срабатывает ровно тогда, когда элемент есть.
   */
  const sizes = typeof ResizeObserver === 'function'
    ? new ResizeObserver((entries) => {
        for (const e of entries) {
          if (e.target === wrapEl) {
            colW = colWidth(e.contentRect.width, cols(), gap())
            continue
          }
          const id = (e.target as HTMLElement).dataset.boardZone
          if (!id) continue
          zoneW[id] = e.contentRect.width
          zonePad[id] = { left: e.contentRect.left, top: e.contentRect.top }
        }
      })
    : null
  onCleanup(() => sizes?.disconnect())

  onMounted(() => {
    measure()
    if (!sizes) return
    sizes.observe(wrapEl)
    // положение зон меняется от собственной ширины доски — пересняться нужно
    // после того, как браузер разложил новую ширину
    let firstCall = true
    const ro = new ResizeObserver(() => {
      if (firstCall) { firstCall = false; return }
      measure()
    })
    ro.observe(wrapEl)
    onCleanup(() => ro.disconnect())
  })

  /* ────────── перенос блоков ────────── */

  /**
   * Раскладка блоков секции в ЯЧЕЙКАХ. Считается, а не снимается: размеры целые,
   * поэтому место каждого блока — чистая арифметика от порядка массива.
   *
   * Это же место потом попадает в разметку явными `grid-column`/`grid-row`, так
   * что нарисованное браузером и посчитанное здесь совпадают по определению.
   */
  const cellsOf = createMemo(() => {
    const out = new Map<string, Array<Placed>>()
    for (const s of props.sections) {
      out.set(s.id, packFlow(
        s.items.map((it) => ({
          id: props.id(it),
          w: spanOfBlock(it, s),
          h: rowsOfBlock(it),
          minW: limitsOf(it, s).minW,
        })),
        colsIn(s),
      ))
    }
    return out
  })
  const placedIn = (sectionId: string) => cellsOf().get(sectionId) ?? []
  /** сколько строк заняла секция — под неё же считается высота зоны */
  const rowsUsed = (sectionId: string) => rowCount(placedIn(sectionId))
  /** ячейка конкретного блока: колонка, строка и ФАКТИЧЕСКАЯ ширина (с ужиманием) */
  const cellOf = (sectionId: string, blockId: string): Placed | undefined =>
    placedIn(sectionId).find((p) => p.id === blockId)

  /**
   * Линии разметки. Ширину колонки здесь НЕ подставляем из JS — она внутри
   * `calc`, поэтому линии верны с первого кадра и на любом ресайзе.
   */
  const linesOf = (s: BoardSection<T>) => {
    const bg = gridLinesBackground({
      cols: colsIn(s), gapX: zoneGap(), rowH: rowH(), gapY: zoneGap(), line: 1,
    })
    return { 'background-image': bg.image, 'background-size': bg.size }
  }

  /** метрики зоны в px: шаг ячейки известен, ширина колонки — из ResizeObserver */
  const metricsOf = (s: BoardSection<T>): Metrics => ({
    cols: colsIn(s),
    colW: colWidth(zoneW[s.id] ?? 0, colsIn(s), zoneGap()),
    rowH: rowH(),
    gapX: zoneGap(),
    gapY: zoneGap(),
  })

  /**
   * Где блоки лежат на экране. Нужно только FLIP'у, поэтому считается из тех же
   * ячеек: угол зоны плюс прямоугольник ячейки. `scrollTop` читать можно — это
   * не forced layout, в отличие от размеров.
   */
  const blockPlaces = (sectionId: string): Record<string, Slot> => {
    const s = sectionById(sectionId)
    const origin = zoneAt[sectionId]
    if (!s || !origin) return {}
    const m = metricsOf(s)
    const el = zoneEls.get(sectionId)
    const pad = zonePad[sectionId] ?? { left: 0, top: 0 }
    const left = origin.left + pad.left - (el?.scrollLeft ?? 0)
    const top = origin.top + pad.top - (el?.scrollTop ?? 0)

    const out: Record<string, Slot> = {}
    for (const p of placedIn(sectionId)) {
      const r = cellRect(p, m)
      out[p.id] = { left: left + r.x, top: top + r.y }
    }
    return out
  }

  /** прямоугольник блока на экране — та же арифметика ячеек, что у `blockPlaces` */
  const rectOf = (sectionId: string, blockId: string) => {
    const s = sectionById(sectionId)
    const origin = zoneAt[sectionId]
    const p = cellOf(sectionId, blockId)
    if (!s || !origin || !p) return null
    const el = zoneEls.get(sectionId)
    const pad = zonePad[sectionId] ?? { left: 0, top: 0 }
    const r = cellRect(p, metricsOf(s))
    return {
      x: origin.left + pad.left - (el?.scrollLeft ?? 0) + r.x,
      y: origin.top + pad.top - (el?.scrollTop ?? 0) + r.y,
      width: r.width,
      height: r.height,
    }
  }

  /**
   * Перешёл ли курсор СЕРЕДИНУ цели в ту сторону, куда едет. Ось берём ту, по
   * которой он сдвинулся сильнее: перестановка бывает и вертикальной.
   */
  const crossedMid = (sectionId: string, overId: string, ev: DragEvent, dx: number, dy: number) => {
    const r = rectOf(sectionId, overId)
    if (!r) return true                        // геометрии нет — не мешаем жесту
    if (Math.abs(dx) >= Math.abs(dy)) {
      const mid = r.x + r.width / 2
      return dx > 0 ? ev.clientX > mid : ev.clientX < mid
    }
    const mid = r.y + r.height / 2
    return dy > 0 ? ev.clientY > mid : ev.clientY < mid
  }

  /** снимок «кто где лежал» до изменения — по нему считаются смещения FLIP */
  const snapshotPlaces = () => {
    const out = new Map<string, Slot>()
    for (const s of props.sections) {
      const pos = blockPlaces(s.id)
      for (const id of Object.keys(pos)) out.set(id, pos[id])
    }
    return out
  }

  /** доиграть переезды: элементы берём ПОСЛЕ смены — при переносе Solid их пересоздаёт */
  const playBlocks = (was: Map<string, Slot>) => {
    for (const s of props.sections) {
      const now = blockPlaces(s.id)
      for (const id of Object.keys(now)) {
        const from = was.get(id)
        const to = now[id]
        if (!from || (from.left === to.left && from.top === to.top)) continue
        const el = blockEls.get(id)
        if (el) flip.nudge(el, from.left - to.left, from.top - to.top)
      }
    }
  }

  /**
   * Переложить блок и доиграть переезд.
   *
   * Новый массив секций собирает доска: вынимает блок из его секции и вставляет
   * в целевую на место `toIndex`. Объект блока при этом ТОТ ЖЕ — не копия: иначе
   * `<For>` счёл бы его другим элементом, пересоздал узел, и анимировать было бы
   * нечего (FLIP держится за живой элемент).
   */
  function moveBlock(item: T, toSection: string, toIndex: number) {
    const bid = props.id(item)
    const was = snapshotPlaces()

    const next = props.sections.map((s) => {
      const has = s.items.some((it) => props.id(it) === bid)
      if (!has && s.id !== toSection) return s
      const rest = s.items.filter((it) => props.id(it) !== bid)
      if (s.id !== toSection) return { ...s, items: rest }
      const k = Math.max(0, Math.min(rest.length, toIndex))
      return { ...s, items: [...rest.slice(0, k), item, ...rest.slice(k)] }
    })

    props.setSections(next)
    props.onMove?.(item, toSection, toIndex)
    playBlocks(was)
  }

  /* ────────── перестановка секций ────────── */

  const panelBoxes = (order: Array<BoardSection<T>>): Array<PanelBox> =>
    order.map((s) => ({ id: s.id, span: spanOf(s), height: panelH[s.id] ?? 0 }))

  const flowOpts = () => ({ cols: cols(), colW, gap: gap(), origin: wrapAt })

  /** переложить секции и доиграть: раскладка считается потоком до и после */
  const playSections = (order: Array<BoardSection<T>>, apply: () => void) => {
    const was = panelFlow(panelBoxes(props.sections), flowOpts())
    apply()
    const now = panelFlow(panelBoxes(order), flowOpts())
    for (const s of order) {
      const a = was[s.id]
      const b = now[s.id]
      const el = panelEls.get(s.id)
      if (!a || !b || !el || (a.left === b.left && a.top === b.top)) continue
      flip.nudge(el, a.left - b.left, a.top - b.top)
    }
  }

  function moveSection(id: string, toIndex: number) {
    const from = props.sections.findIndex((s) => s.id === id)
    if (from < 0 || from === toIndex) return
    const order = moveAt(props.sections, from, toIndex)
    playSections(order, () => {
      props.setSections(order)
      props.onSectionMove?.(from, toIndex)
    })
  }

  /** ширина, с которой секцию развернули, — чтобы вернуть ту же */
  const wasSpan: Record<string, number> = {}

  /** двойной клик по шапке: во всю ширину и обратно */
  function toggleWide(s: BoardSection<T>) {
    const full = spanOf(s) >= cols()
    if (!full) wasSpan[s.id] = spanOf(s)
    const span = full ? (wasSpan[s.id] ?? Math.floor(cols() / 2)) : cols()
    const order = props.sections.map((x) => (x.id === s.id ? { ...x, span } : x))
    playSections(order, () => {
      props.setSections(order)
      props.onSectionResize?.(s.id, { span, rows: s.rows ?? 0 })
    })
    measureWhenStill()
  }

  /* ────────── ресайз секций: указательные события, шаг в единицу сетки ────────── */

  type Sizing = { id: string; axis: string; x: number; y: number; span: number; rows: number }
  let sizingFrom: Sizing | null = null

  const onGripDown = (ev: PointerEvent) => {
    // только основная кнопка: правой зовут контекстное меню, средней — автоскролл,
    // и жест, начатый ими, некому закончить (`pointerup` придёт от другой кнопки)
    if (ev.button !== 0) return
    const grip = (ev.target as HTMLElement | null)?.closest?.('[data-board-resize]') as HTMLElement | null
    if (!grip || !editable() || !resizable()) return
    const s = sectionById(grip.dataset.boardResize!)
    if (!s) return
    ev.preventDefault()
    grip.setPointerCapture(ev.pointerId)
    sizingFrom = {
      id: s.id, axis: grip.dataset.axis ?? 'x',
      x: ev.clientX, y: ev.clientY,
      span: spanOf(s),
      // высота «по содержимому» — берём фактическую, чтобы тянуть с того же места
      rows: s.rows || rowsUsed(s.id),
    }
    setSizing(s.id)
  }

  const onGripMove = (ev: PointerEvent) => {
    const d = sizingFrom
    if (!d || !colW) return
    if (!(ev.buttons & 1)) { onGripUp(); return }   // кнопку отпустили мимо нас
    const s = sectionById(d.id)
    if (!s) return
    // считаем в колонках и строках, а не в пикселях: пока снап не сменился,
    // ничего не трогаем — значит и перекладки сетки на каждый кадр не будет
    let span = spanOf(s)
    let rows = s.rows ?? d.rows
    if (d.axis !== 'y') span = Math.max(minSpan(), Math.min(cols(), d.span + Math.round((ev.clientX - d.x) / colW)))
    // шаг по вертикали — ячейка ВМЕСТЕ с зазором, иначе тянешь на строку, а
    // прибавляется полторы
    if (d.axis !== 'x') rows = Math.max(1, d.rows + Math.round((ev.clientY - d.y) / (rowH() + zoneGap())))
    if (span === spanOf(s) && rows === (s.rows ?? d.rows)) return
    props.setSections(props.sections.map((x) => (x.id === d.id ? { ...x, span, rows } : x)))
    props.onSectionResize?.(d.id, { span, rows })
  }

  const onGripUp = () => {
    if (!sizingFrom) return
    sizingFrom = null
    setSizing(null)
    measureWhenStill()   // размер изменился — места блоков внутри другие
  }

  /* ────────── ресайз блоков: рамка-превью, а не живой размер ────────── */

  /**
   * Пока тянут, меняется только РАМКА. Менять размер самого блока покадрово
   * нельзя: каждая смена снапа перекладывает всю зону и запускает пачку FLIP —
   * та же причина, по которой так сделано в DumbGrid.
   *
   * Размер живёт в данных потребителя, поэтому доска не применяет его сама:
   * на отпускании зовётся `onBlockResize`, а дальше решает он.
   */
  type BlockSizing = { id: string; sectionId: string; x: number; y: number; w: number; h: number }
  let blockSizingFrom: BlockSizing | null = null
  const [blockFrame, setBlockFrame] = createSignal<{ sectionId: string; id: string; w: number; h: number } | null>(null)

  const onBlockGripDown = (ev: PointerEvent) => {
    if (ev.button !== 0) return    // только основная кнопка, как и у секций
    const grip = (ev.target as HTMLElement | null)?.closest?.('[data-board-block-resize]') as HTMLElement | null
    if (!grip || !editable() || !props.onBlockResize) return
    const id = grip.dataset.boardBlockResize!
    const section = sectionOf(id)
    const at = section && cellOf(section.id, id)
    if (!section || !at) return
    ev.preventDefault()
    ev.stopPropagation()
    grip.setPointerCapture(ev.pointerId)
    // стартуем от ЖЕЛАЕМОЙ ширины, а не от ужатой: иначе блок, втиснутый в
    // остаток строки, при первом же движении «прыгал» бы от неё
    const item = section.items.find((it) => props.id(it) === id)!
    blockSizingFrom = {
      id, sectionId: section.id, x: ev.clientX, y: ev.clientY,
      w: spanOfBlock(item, section), h: at.h,
    }
    setBlockFrame({ sectionId: section.id, id, w: blockSizingFrom.w, h: blockSizingFrom.h })
  }

  const onBlockGripMove = (ev: PointerEvent) => {
    const d = blockSizingFrom
    if (!d) return
    // кнопку отпустили мимо нас (за окном, поверх чужого слоя) — заканчиваем
    // сами, иначе рамка осталась бы висеть до следующего клика
    if (!(ev.buttons & 1)) { onBlockGripUp(); return }
    const s = sectionById(d.sectionId)
    const item = s?.items.find((it) => props.id(it) === d.id)
    if (!s || !item) return
    const next = snapSpan({
      start: { w: d.w, h: d.h },
      dx: ev.clientX - d.x,
      dy: ev.clientY - d.y,
      m: metricsOf(s),
      limits: limitsOf(item, s),
    })
    const now = blockFrame()
    if (now && now.w === next.w && now.h === next.h) return   // снап не сменился
    setBlockFrame({ sectionId: d.sectionId, id: d.id, w: next.w, h: next.h })
  }

  const onBlockGripUp = () => {
    const d = blockSizingFrom
    const frame = blockFrame()
    blockSizingFrom = null
    setBlockFrame(null)
    if (!d || !frame) return
    const s = sectionById(d.sectionId)
    const item = s?.items.find((it) => props.id(it) === d.id)
    if (!item) return
    if (frame.w === d.w && frame.h === d.h) return   // ничего не изменилось
    const was = snapshotPlaces()
    props.onBlockResize?.(item, { w: frame.w, h: frame.h })
    playBlocks(was)      // соседи разъезжаются под новый размер
    measureWhenStill()
  }

  /* ────────── жест: делегированные слушатели на всей доске ────────── */

  const closestOf = (ev: Event, sel: string) =>
    (ev.target as HTMLElement | null)?.closest?.(sel) as HTMLElement | null

  /** цель нажатия — по ней отличаем «тащат секцию» от «тащат блок» */
  let pressed: Element | null = null
  /**
   * Сосед, с которым обмен уже сделан. Пока курсор с него не ушёл, второго
   * обмена не будет.
   *
   * Без этого блоки качаются: после перестановки сосед переезжает ровно под
   * курсор, порог по его середине оказывается пройден уже с другой стороны — и
   * следующее событие меняет их обратно. Считать место по раскладке БЕЗ
   * перетаскиваемого блока тоже не годится: он остаётся в потоке (только
   * приглушённый), такая раскладка расходится с картинкой, и блок прыгает на
   * чужое место прямо на старте жеста.
   *
   * Приём из SortableJS: один обмен на один заход на соседа.
   */
  let lastOver: string | null = null

  /**
   * Место, откуда блок только что уехал. Вернуть его туда следующим же шагом
   * нельзя.
   *
   * Памяти о последнем соседе мало: качель бывает и на ДВУХ целях по очереди.
   * Тащишь широкий блок вниз-влево, над одним соседом место выходит третьим,
   * над другим — первым, и они меняются местами каждый кадр.
   *
   * Держится запрет ровно пока курсор едет В ТУ ЖЕ СТОРОНУ, что и в момент
   * обмена. Стоит развернуться — снимается: передумать посреди жеста и вернуть
   * блок откуда взял должно быть можно, а качель как раз тем и отличается, что
   * рука всё это время едет в одну сторону.
   */
  let undoGuard: { zone: string; k: number; x: number; y: number; dx: number; dy: number } | null = null

  /** синхронный признак жеста: отложенная подсветка иначе включится после уборки */
  let gesture: string | null = null
  let lastX = -1
  let lastY = -1

  const onDragStart = (ev: DragEvent) => {
    if (!editable()) { ev.preventDefault(); return }
    // с ручки ресайза драг не начинается: `draggable={false}` на ней сам по себе
    // жест не отменяет — блок-предок всё равно перетаскиваемый
    if (pressed?.closest?.('[data-board-block-resize]')) { ev.preventDefault(); return }
    // то же для всего, что помечено `[data-no-drag]`: кнопки удаления, меню,
    // поля ввода внутри блока. Признак общий с `DumbGrid`, чтобы потребителю не
    // приходилось помнить два разных.
    if (pressed?.closest?.('[data-no-drag]')) { ev.preventDefault(); return }
    setHeld(null)
    setHeldSection(null)

    const panel = closestOf(ev, '[data-board-section]')
    const block = closestOf(ev, '[data-board-block]')

    // секцию тащат только за заголовок, иначе за неё цеплялось бы пустое поле
    if (panel && !block && pressed?.closest?.('[data-board-handle]')) {
      const id = panel.dataset.boardSection!
      ev.dataTransfer?.setData('text/plain', id)
      if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
      lastX = ev.clientX
      lastY = ev.clientY
      gesture = id
      scroller.start(panel)
      setTimeout(() => { if (gesture === id) setHeldSection(id) })
      return
    }

    const id = block?.dataset.boardBlock
    if (!id) { ev.preventDefault(); return }
    ev.dataTransfer?.setData('text/plain', id)   // без него жест не начнётся в Firefox
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
    lastX = ev.clientX
    lastY = ev.clientY
    gesture = id
    lastOver = null
    undoGuard = null
    scroller.start(block!)
    setTimeout(() => { if (gesture === id) setHeld(id) })
  }

  const onDragOver = (ev: DragEvent) => {
    ev.preventDefault()                          // без этого не будет `drop`
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move'
    scroller.move(ev.clientX, ev.clientY)

    // Курсор обязан реально сдвинуться. Пока блоки едут, браузер шлёт `dragover`
    // и при неподвижной мыши, а хиттест идёт по ВИДИМОЙ картинке — под курсор
    // подъезжает то одно, то другое, и порядок дёргается сам.
    if (ev.clientX === lastX && ev.clientY === lastY) return
    const dx = ev.clientX - lastX
    const dy = ev.clientY - lastY
    lastX = ev.clientX
    lastY = ev.clientY

    // разворот руки снимает запрет на возврат
    if (undoGuard) {
      const back = (ev.clientX - undoGuard.x) * undoGuard.dx + (ev.clientY - undoGuard.y) * undoGuard.dy
      if (back < -8) undoGuard = null
    }

    const movingSection = heldSection()
    if (movingSection) {
      const overId = closestOf(ev, '[data-board-section]')?.dataset.boardSection
      if (!overId || overId === movingSection) return
      if (panelEls.get(overId)?.getAnimations().length) return   // цель сама едет
      moveSection(movingSection, props.sections.findIndex((s) => s.id === overId))
      return
    }

    const id = held()
    if (!id) return
    const home = sectionOf(id)
    const item = home?.items.find((x) => props.id(x) === id)
    if (!item || !home) return
    const zoneId = closestOf(ev, '[data-board-zone]')?.dataset.boardZone
    const zone = zoneId ? sectionById(zoneId) : null
    if (!zone) return
    const from = home.id
    if (zone.accepts && from !== zone.id && !zone.accepts(from)) return

    const over = closestOf(ev, '[data-board-block]')?.dataset.boardBlock
    if (over) {
      if (over === id) { lastOver = null; return }   // над собой — память ни к чему
      if (over === lastOver) return                  // с этим уже менялись, ждём ухода
      lastOver = null
      const target = zone.items.find((x) => props.id(x) === over)
      if (!target) return
      const k = placeOf(target)
      if (from === zone.id && placeOf(item) === k) return
      if (undoGuard && undoGuard.zone === zone.id && undoGuard.k === k) return
      if (!crossedMid(zone.id, over, ev, dx, dy)) return
      lastOver = over
      undoGuard = {
        zone: zone.id,
        k: placeOf(item),
        x: ev.clientX,
        y: ev.clientY,
        dx: Math.sign(dx),
        dy: Math.sign(dy),
      }
      moveBlock(item, zone.id, k)
      return
    }
    lastOver = null
    // Мимо блоков. Внутри СВОЕЙ секции это почти всегда зазор сетки — дырка в
    // хиттесте, а не пустое место: тащишь блок вперёд, он на миг попадает в
    // промежуток между соседями, и «в конец» выбрасывает его в хвост списка.
    // Внутри своей секции хвост и не нужен: чтобы встать последним, наводишь на
    // последний блок — правило «цель ниже нас, значит встаём после» доведёт.
    //
    // А вот когда блок приехал из ЧУЖОЙ секции, пустое место — единственное, на
    // что можно навести в пустой секции, и там это осмысленно.
    if (from === zone.id) return
    moveBlock(item, zone.id, zone.items.length)
  }

  const finish = () => {
    gesture = null
    lastOver = null
    undoGuard = null
    if (!held() && !heldSection()) return
    setHeld(null)
    setHeldSection(null)
    scroller.stop()
    measureWhenStill()   // состав секций изменился — геометрия другая
  }

  return (
    <div
      class={props.class}
      style={props.style}
      onPointerDown={(ev) => { pressed = ev.target as Element | null; onGripDown(ev); onBlockGripDown(ev) }}
      onPointerMove={(ev) => { onGripMove(ev); onBlockGripMove(ev) }}
      onPointerUp={(ev) => { onGripUp(); onBlockGripUp() }}
      onPointerCancel={() => { onGripUp(); onBlockGripUp() }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={finish}
      onDrop={(ev) => { ev.preventDefault(); finish() }}
    >
      <div
        class="dumb-board"
        ref={(el) => { wrapEl = el }}
        style={{ '--dumb-board-cols': String(cols()), '--dumb-board-gap': `${gap()}px` }}
      >
        <For each={renderOrder()}>
          {(sid) => {
            const s = () => sectionById(sid)
            return (
            <section
              class="dumb-board-panel"
              classList={{ held: heldSection() === sid, sizing: sizing() === sid }}
              data-board-section={sid}
              draggable={editable()}
              ref={(el) => panelEls.set(sid, el)}
              style={{ 'grid-column': `span ${spanOf(s())}`, order: String(showOrder(sid)) }}
            >
              <Show when={s().title}>
                <h4
                  class="dumb-board-head"
                  data-board-handle
                  onDblClick={() => editable() && toggleWide(s())}
                >
                  <Show when={editable()}><span class="dumb-board-grip">⠿</span></Show>
                  <span class="dumb-board-title">
                    {s().title}
                    <Show when={s().subtitle}><span class="dumb-board-sub">{s().subtitle}</span></Show>
                  </span>
                  <span class="dumb-board-count">{itemsOf(sid).length}</span>
                  <Show when={props.sectionActions}>
                    <span class="dumb-board-actions">{props.sectionActions!(s())}</span>
                  </Show>
                </h4>
              </Show>

              <div
                class="dumb-board-zone"
                data-board-zone={sid}
                ref={(el) => { zoneEls.set(sid, el); sizes?.observe(el) }}
                style={{
                  '--dumb-board-inner': String(colsIn(s())),
                  '--dumb-board-row': `${rowH()}px`,
                  '--dumb-board-zone-gap': `${zoneGap()}px`,
                  // высота: заданная секцией либо по числу занятых строк. Строка
                  // про запас — чтобы блоку было куда переезжать вниз
                  height: `${spanSize(s().rows || rowsUsed(sid) + 1, rowH(), zoneGap())}px`,
                }}
              >
                <Show when={editable() && showGrid() !== false}>
                  <div
                    class="dumb-board-lines"
                    aria-hidden="true"
                    style={{
                      ...linesOf(s()),
                      opacity: gridVisible() ? '1' : '0',
                    }}
                  />
                </Show>

                {/* Итерируем сами элементы, а не их id: иначе содержимое пришлось
                    бы искать в массиве прямо в разметке, и оно зависело бы от
                    всего массива — любая правка пересоздавала бы ВСЕ блоки. */}
                <For each={renderItemsOf(sid)}>
                  {(item) => {
                    const at = () => cellOf(sid, props.id(item))
                    return (
                      <div
                        class="dumb-board-block"
                        classList={{ held: held() === props.id(item) }}
                        data-board-block={props.id(item)}
                        draggable={editable()}
                        ref={(el) => blockEls.set(props.id(item), el)}
                        style={{
                          // место ЯВНОЕ: браузер ничего не домысливает, поэтому
                          // нарисованное совпадает с посчитанным для FLIP
                          'grid-column': `${(at()?.col ?? 0) + 1} / span ${at()?.w ?? 1}`,
                          'grid-row': `${(at()?.row ?? 0) + 1} / span ${at()?.h ?? 1}`,
                        }}
                      >
                        {props.children(item, s())}

                        <Show when={editable() && props.onBlockResize}>
                          <span
                            class="dumb-board-block-grip"
                            data-board-block-resize={props.id(item)}
                            // нативный драг не должен стартовать с ручки:
                            // жест ресайза указательный и живёт сам по себе
                            draggable={false}
                            title={props.labels?.resizeBlock ?? 'Потяни, чтобы изменить размер'}
                          />
                        </Show>
                      </div>
                    )
                  }}
                </For>

                {/* Рамка будущего размера — тоже grid item: браузер сам ставит
                    её в нужные ячейки, а перекрытие блока сетке не мешает. */}
                <Show when={blockFrame()?.sectionId === sid ? blockFrame() : null}>
                  {(f) => {
                    const at = () => cellOf(sid, f().id)
                    return (
                      <div
                        class="dumb-board-frame"
                        aria-hidden="true"
                        style={{
                          'grid-column': `${(at()?.col ?? 0) + 1} / span ${f().w}`,
                          'grid-row': `${(at()?.row ?? 0) + 1} / span ${f().h}`,
                        }}
                      />
                    )
                  }}
                </Show>
              </div>

              <Show when={editable() && resizable()}>
                <div class="dumb-board-grip-x" data-board-resize={sid} data-axis="x" />
                <div class="dumb-board-grip-y" data-board-resize={sid} data-axis="y" />
                <div class="dumb-board-grip-xy" data-board-resize={sid} data-axis="xy" />
              </Show>
            </section>
          )}}
        </For>
      </div>

    </div>
  )
}
