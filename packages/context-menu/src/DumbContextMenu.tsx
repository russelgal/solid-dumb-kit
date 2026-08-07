// Контекстное меню по правому клику.
//
// ГЛАВНАЯ СЛОЖНОСТЬ — не разметка, а место. Меню, открытое у нижнего края,
// должно раскрыться вверх, у правого — влево. Обычный способ это узнать —
// измерить меню после вставки (`getBoundingClientRect`) и подвинуть; это
// forced layout ровно в тот момент, когда браузер и так занят.
//
// Здесь двумя платформенными механизмами и ни одного замера:
//
// 1. POPOVER API. Меню — `popover="manual"`, а значит живёт в TOP LAYER: оно
//    поверх всего, включая чужие модалки, его не режет `overflow: hidden` у
//    предков, и ему не нужен `z-index`-аукцион. Закрытие по Esc и «световой
//    отбой» браузер берёт на себя.
// 2. ANCHOR POSITIONING. В точке клика ставится невидимый якорь размером в
//    пиксель, меню привязывается к нему (`position-anchor`), а сторону выбирает
//    сам браузер через `position-try-fallbacks` — где есть место, туда и
//    раскроется.
//
// Обоих может не быть (Firefox на момент написания умеет popover, но не anchor)
// — тогда работает запасной путь: меню ставится по курсору с зеркалом
// относительно середины окна. `innerWidth/innerHeight` — свойства окна, а не
// раскладка элементов, forced reflow они не вызывают.
//
// ЖЕСТ — КАК В macOS: press-drag-release. Нажал правую кнопку, не отпуская
// повёл на пункт, отпустил — пункт сработал и меню закрылось. Отпустил мимо
// пунктов — просто закрылось.
//
// При этом привычка «щёлкнул — меню висит» не ломается: короткое нажатие без
// ведения оставляет меню открытым, дальше по нему ходят как обычно. Различаем
// по времени удержания и пройденному расстоянию — ровно так это и различает
// система.
//
// Остальное — обычные ожидания от меню: Esc и клик мимо закрывают, стрелки
// водят по пунктам, Enter выбирает, разделители и заблокированные пункты
// пропускаются, при открытии фокус уходит в меню и возвращается назад при
// закрытии.

import { For, Show, createEffect, createSignal, onCleanup, type JSX } from 'solid-js'
import { injectStyle } from '@solid-dumb-kit/shared'

export type MenuItem =
  | { kind: 'separator' }
  | {
      kind?: 'item'
      /** что написано */
      label: string
      /** класс значка — свой набор даёт потребитель */
      icon?: string
      /** подсказка справа: сочетание клавиш */
      hint?: string
      disabled?: boolean
      /** опасный пункт красится и стоит внизу: удаление, сброс */
      danger?: boolean
      /**
       * Вложенное меню. Пункт с `items` раскрывает подменю вбок и сам ничего не
       * делает — `run` у него не нужен и не вызывается. Вложенность любая:
       * панель рекурсивна.
       */
      items?: Array<MenuItem>
      run?: () => void
    }

/**
 * Что панель умеет показать наружу. Клавиатуру обрабатывает корень — ему нужен
 * доступ к САМОЙ ГЛУБОКОЙ открытой панели, а не к своим пунктам.
 */
type PanelApi = {
  depth: number
  el: HTMLElement
  /** сдвинуть подсветку на шаг, пропуская разделители и глухие пункты */
  move: (step: number) => void
  /** подсветить конкретную кнопку (её нашли под курсором) */
  focusItem: (btn: HTMLElement) => void
  /** раскрыть подменю активного пункта; false — подменю у него нет */
  openSub: () => boolean
  closeSub: () => void
  /** выполнить активный пункт; false — он не выполняется (это ветка) */
  runActive: () => boolean
}

export type DumbContextMenuProps = {
  /** пункты; пересчитываются на каждое открытие — можно зависеть от выделения */
  items: () => Array<MenuItem>
  /** внутри чего ловим правый клик; не задан — весь документ */
  target?: () => HTMLElement | null
  /** не открывать: правый клик по полю ввода лучше отдать браузеру */
  disabled?: () => boolean
  /** меню открылось/закрылось */
  onToggle?: (open: boolean) => void
  class?: string
}

const STYLES = `
  /* якорь: пиксель в точке клика, к нему привязывается меню */
  .dumb-menu-anchor { position: fixed; width: 1px; height: 1px; pointer-events: none;
                      anchor-name: --dumb-menu-at }
  /* Вид панели — daisyUI (menu, bg-base-100, rounded-box, shadow) в разметке.
     Здесь остаётся ровно то, чего daisyUI не умеет: привязка к точке клика
     через anchor positioning и жизнь в top layer. */
  .dumb-menu { position: fixed; margin: 0; min-width: 190px;
               /* в top layer: ни z-index, ни overflow предков больше не важны */
               overflow: visible;
               /* СБРОС UA-СТИЛЯ POPOVER. Браузер даёт [popover] inset: 0, и
                  right/bottom остаются нулями, даже когда мы задали top/left.
                  Пока меню раскрывается вправо-вниз, это незаметно (в споре
                  left побеждает right). А вот flip-inline у правого края меняет
                  местами ЛЕВОЕ и ПРАВОЕ значения: наше anchor() уезжает в
                  right, а в left приходит ноль от UA — и меню прыгает к левому
                  краю экрана. Явные auto убирают этот ноль. */
               right: auto; bottom: auto;
               /* место выбирает браузер: где не влезает — раскрывается в другую
                  сторону. Ни одного замера с нашей стороны */
               position-anchor: --dumb-menu-at;
               /* привязка через anchor(), а не position-area: значение вида
                  bottom span-inline-end Chrome отбрасывает как невалидное, и
                  меню молча уезжает в левый верхний угол */
               top: anchor(--dumb-menu-at bottom);
               left: anchor(--dumb-menu-at right);
               /* у края окна браузер сам переворачивает: вверх и/или влево */
               position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline }
  .dumb-menu:popover-open { display: block }
  /* подсветку с клавиатуры даём тем же классом, что даёт daisyUI наведению */
  .dumb-menu-item[data-active="1"] { background: var(--dumb-menu-active, rgb(0 0 0 / .07)) }
  .dumb-menu-item[disabled] { cursor: default }

  /* Подменю. Тот же popover, тот же top layer — значит его так же не режет ни
     overflow, ни clip-path предков, и z-index ему не нужен.

     Якорей у него ДВА, и оба заданы разметкой (см. place()): по вертикали —
     сам пункт-ветка (первая строка подменю встаёт на его уровень), по
     горизонтали — ПАНЕЛЬ целиком (подменю прилегает к её краю и не наползает
     на текст пунктов). Раньше якорем была точка курсора — оттого подменю и
     раскрывалось посреди родителя, накрывая половину надписи.

     Оба якоря лежат внутри родительского popover, и это законно: он показан
     раньше подменю, а значит для anchor() виден.

     Сторону выбирает браузер: flip-inline у правого края отражает и inset, и
     margin — подменю уходит влево от панели тем же зазором. Замеров ноль. */
  .dumb-menu-sub { /* -5px = padding панели (p-1) + её рамка: без них первая
                      строка подменю встала бы на 5px ниже своего пункта */
                   margin-top: -5px; margin-left: 2px;
                   position-try-fallbacks: flip-inline, flip-block, flip-inline flip-block }
`

/**
 * Одна панель меню. Рекурсивна: пункт с `items` рендерит такую же панель
 * уровнем ниже. Своё состояние у каждой — подсвеченный пункт и раскрытая
 * ветка; наружу отдаёт `PanelApi`, чтобы корень мог водить по ней с клавиатуры.
 */
function Panel(props: {
  items: Array<MenuItem>
  depth: number
  /** координаты для браузеров без anchor positioning */
  at: { x: number; y: number }
  /** куда раскрылся родитель: подменю продолжает путь в ту же сторону */
  side?: 'right' | 'left'
  /** снимок родительской панели — по нему видно, в какую сторону ушли мы сами */
  parentBox?: () => { left: number; right: number } | null
  /** выполнили пункт — закрыть всё меню */
  onRun: () => void
  register: (api: PanelApi) => () => void
  class?: string
}) {
  const [active, setActive] = createSignal(-1)
  const [sub, setSub] = createSignal<{ i: number; x: number; y: number } | null>(null)
  /** где панель оказалась — снимается ОДИН раз, IntersectionObserver'ом */
  const [box, setBox] = createSignal<{ left: number; right: number } | null>(null)
  let el!: HTMLDivElement

  /**
   * Имена якорей этой панели: сама панель и её раскрытая ветка. Открыт всегда
   * один путь, поэтому хватает имени на глубину — подменю берёт имена родителя
   * арифметикой (`depth - 1`), передавать их пропом незачем.
   */
  const panelAnchor = `--dumb-menu-p${props.depth}`
  const itemAnchor = `--dumb-menu-i${props.depth}`

  const isItem = (it: MenuItem) => it.kind !== 'separator'
  const asItem = (it: MenuItem) => it as Extract<MenuItem, { label: string }>
  const branch = (it: MenuItem) => (isItem(it) ? (asItem(it).items?.length ?? 0) > 0 : false)
  const pickable = () =>
    props.items
      .map((it, i) => ({ it, i }))
      .filter(({ it }) => isItem(it) && !asItem(it).disabled)

  /**
   * Подсветили пункт. Мышью — ветка раскрывается сразу (наведение и есть
   * намерение), обычный пункт закрывает чужую ветку. С клавиатуры (`spread:
   * false`) ветка НЕ раскрывается: иначе стрелка «вниз» проваливалась бы в
   * подменю, едва пройдя мимо ветки. Открытие с клавиатуры — только → и Enter,
   * как в системных меню.
   */
  const highlight = (i: number, x: number, y: number, spread = true) => {
    setActive(i)
    const it = props.items[i]
    if (it && branch(it) && spread) setSub({ i, x, y })
    else setSub(null)
  }

  // Показываем ПОСЛЕ вставки узла: `showPopover` на элементе вне документа
  // бросает. Фокус забирает только корневая панель — стрелки корень и слушает.
  createEffect(() => {
    queueMicrotask(() => {
      if (el && !el.matches(':popover-open')) el.showPopover?.()
      if (props.depth === 0) el?.focus()
    })
  })
  onCleanup(() => {
    if (el?.matches(':popover-open')) el.hidePopover()
  })

  /**
   * КУДА ПАНЕЛЬ РАСКРЫЛАСЬ. Сторону выбрал браузер, а знать её надо нам: у
   * правого края родитель уходит влево, и подменю обязано идти туда же —
   * иначе оно вернётся вправо и накроет собой родителя.
   *
   * Спрашиваем не `getBoundingClientRect`, а IntersectionObserver: его
   * `boundingClientRect` браузер считает сам, вне главного потока, forced
   * layout не возникает (тот же приём, что и в снимке сортировщика). Снимок
   * ОДИН, на открытие панели: дальше она не двигается.
   */
  createEffect(() => {
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      const r = entries[entries.length - 1].boundingClientRect
      // пока popover не показан, размеров нет — ждём следующей порции
      if (!r.width) return
      setBox({ left: r.left, right: r.right })
      io.disconnect()
    })
    io.observe(el)
    onCleanup(() => io.disconnect())
  })

  /**
   * Сторона этой панели: сравниваем её левый край с тем, от чего она
   * отталкивалась, — у корня это точка клика, у подменю левый край родителя.
   * Снимка ещё нет — идём тем же путём, что и родитель.
   */
  const side = (): 'right' | 'left' => {
    const b = box()
    if (!b) return props.side ?? 'right'
    const from = props.depth === 0 ? props.at.x : (props.parentBox?.()?.left ?? props.at.x)
    return b.left < from ? 'left' : 'right'
  }

  createEffect(() => {
    const api: PanelApi = {
      depth: props.depth,
      get el() {
        return el
      },
      move: (step) => {
        const list = pickable()
        if (!list.length) return
        const cur = list.findIndex(({ i }) => i === active())
        // по кругу: с последнего вниз — на первый, это привычно
        const next = (cur + step + list.length) % list.length
        const i = list[cur < 0 && step < 0 ? list.length - 1 : next].i
        // с клавиатуры координат нет — для фолбэка берём точку открытия панели
        highlight(i, props.at.x, props.at.y, false)
      },
      focusItem: (btn) => {
        const rows = Array.from(el?.querySelectorAll(':scope > ul > li') ?? [])
        const i = rows.findIndex((li) => li.contains(btn))
        if (i >= 0 && i !== active()) highlight(i, props.at.x, props.at.y)
      },
      openSub: () => {
        const it = props.items[active()]
        if (!it || !branch(it)) return false
        setSub({ i: active(), x: props.at.x, y: props.at.y })
        return true
      },
      closeSub: () => setSub(null),
      runActive: () => {
        const it = props.items[active()]
        if (!it || !isItem(it) || branch(it) || asItem(it).disabled) return false
        asItem(it).run?.()
        return true
      },
    }
    onCleanup(props.register(api))
  })

  /**
   * Место панели. У корня — точка клика, у подменю — родительский пункт. И то,
   * и другое отдаётся браузеру: `anchor()` считает он сам, а мы не меряем.
   * Запасной путь (браузер без anchor positioning) — координаты курсора,
   * зеркалом относительно середины окна. `innerWidth/innerHeight` — свойства
   * окна, не раскладка элементов, forced reflow они не вызывают.
   */
  const place = (): JSX.CSSProperties => {
    // панель сама себе якорь: за неё цепляется подменю уровнем ниже
    const own: JSX.CSSProperties = { 'anchor-name': panelAnchor }
    // `window.CSS`, а не голое `CSS`: имя занято константой со стилями
    const anchored = window.CSS?.supports?.('anchor-name: --x')
    if (anchored) {
      if (props.depth === 0) return own
      // подменю: верх — по своему пункту, бок — по краю всей панели, в ту же
      // сторону, куда ушёл родитель. Не влезет — браузер вернёт обратно сам
      // (position-try-fallbacks), поэтому это предпочтение, а не приказ
      const up = props.depth - 1
      const at = `--dumb-menu-p${up}`
      return {
        ...own,
        'position-anchor': at,
        top: `anchor(--dumb-menu-i${up} top)`,
        ...(props.side === 'left'
          ? { left: 'auto', right: `anchor(${at} left)`, 'margin-left': '0', 'margin-right': '2px' }
          : { left: `anchor(${at} right)` }),
      }
    }
    const p = props.at
    const flipX = props.side === 'left' || p.x > window.innerWidth / 2
    const flipY = p.y > window.innerHeight / 2
    return {
      ...own,
      left: flipX ? 'auto' : `${p.x}px`,
      right: flipX ? `${window.innerWidth - p.x}px` : 'auto',
      top: flipY ? 'auto' : `${p.y}px`,
      bottom: flipY ? `${window.innerHeight - p.y}px` : 'auto',
    }
  }

  return (
    <>
      <div
        ref={el}
        class={`dumb-menu menu menu-sm rounded-box bg-base-100 border border-base-300 p-1 shadow-lg ${
          props.depth > 0 ? 'dumb-menu-sub' : ''
        } ${props.class ?? ''}`}
        popover="manual"
        style={place()}
        tabindex={-1}
        role="menu"
        data-depth={props.depth}
      >
        <ul>
          <For each={props.items}>
            {(it, i) => (
              <Show
                when={isItem(it)}
                fallback={<li class="dumb-menu-sep divider my-1" role="separator" />}
              >
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    class={`dumb-menu-item flex w-full items-center gap-2 text-left ${
                      asItem(it).danger ? 'text-error' : ''
                    }`}
                    data-active={active() === i() ? '1' : undefined}
                    data-danger={asItem(it).danger ? '1' : undefined}
                    data-sub={branch(it) ? '1' : undefined}
                    aria-haspopup={branch(it) ? 'menu' : undefined}
                    aria-expanded={branch(it) ? (sub()?.i === i() ? 'true' : 'false') : undefined}
                    disabled={asItem(it).disabled}
                    // якорем становится только раскрытая ветка: по ней подменю
                    // выравнивается по вертикали
                    style={sub()?.i === i() ? { 'anchor-name': itemAnchor } : undefined}
                    onMouseEnter={(ev) => highlight(i(), ev.clientX, ev.clientY)}
                    onClick={(ev) => {
                      // ветка не выполняется — по клику она просто раскрывается
                      if (branch(it)) return void highlight(i(), ev.clientX, ev.clientY)
                      asItem(it).run?.()
                      props.onRun()
                    }}
                  >
                    <Show when={asItem(it).icon}>
                      <span class={`dumb-menu-icon size-[1.1em] shrink-0 ${asItem(it).icon}`} />
                    </Show>
                    <span class="dumb-menu-label flex-1 truncate">{asItem(it).label}</span>
                    <Show when={asItem(it).hint}>
                      {/* подсказка тусклее текста, но читаемо: base-content/60
                          и прочая блёклость правилом репы запрещены */}
                      <span class="dumb-menu-hint text-xs opacity-90">{asItem(it).hint}</span>
                    </Show>
                    <Show when={branch(it)}>
                      <span class="dumb-menu-more text-sm" aria-hidden="true">
                        ▸
                      </span>
                    </Show>
                  </button>
                </li>
              </Show>
            )}
          </For>
        </ul>
      </div>

      {/* Подменю — соседний popover, а не потомок панели: в top layer каждый
          сам по себе, и порядок показа решает, кто выше. */}
      <Show when={sub()}>
        {(s) => (
          <Panel
            items={asItem(props.items[s().i]).items!}
            depth={props.depth + 1}
            at={{ x: s().x, y: s().y }}
            side={side()}
            parentBox={box}
            onRun={props.onRun}
            register={props.register}
            class={props.class}
          />
        )}
      </Show>
    </>
  )
}

export function DumbContextMenu(props: DumbContextMenuProps) {
  injectStyle('menu', STYLES)

  /**
   * Сколько держать кнопку, чтобы жест считался «нажал и повёл», и насколько
   * можно при этом дрогнуть рукой. Пороги те же, что у долгого нажатия в
   * остальном ките: 250 мс и 6 px.
   */
  const HOLD = 250
  const TOL = 6

  const [at, setAt] = createSignal<{ x: number; y: number } | null>(null)
  /** когда и где нажали — по ним отличаем «щёлкнул» от «нажал и повёл» */
  let pressedAt = 0
  let pressedPoint = { x: 0, y: 0 }
  let returnTo: HTMLElement | null = null

  /**
   * Открытые панели, от корня вглубь. Обычный массив, не сигнал: он нужен
   * обработчикам событий, а не разметке, — реактивность тут ничего не даёт.
   */
  const stack: Array<PanelApi> = []
  const register = (api: PanelApi) => {
    stack.push(api)
    stack.sort((a, b) => a.depth - b.depth)
    return () => {
      const i = stack.indexOf(api)
      if (i >= 0) stack.splice(i, 1)
    }
  }
  /** самая глубокая открытая панель — с ней и работает клавиатура */
  const deepest = () => stack[stack.length - 1]
  const inside = (node: Node | null) => stack.some((p) => p.el?.contains(node as Node))

  const open = () => at() !== null

  function close() {
    if (!open()) return
    // Панели убирают себя из top layer сами (`hidePopover` в их `onCleanup`) —
    // здесь достаточно снять состояние, разметка исчезнет следом.
    setAt(null)
    props.onToggle?.(false)
    // фокус возвращаем туда, откуда пришли: иначе он падает на body и
    // клавиатурная навигация по странице начинается заново
    returnTo?.focus?.()
    returnTo = null
  }

  function onContext(ev: MouseEvent) {
    if (props.disabled?.()) return
    const host = props.target?.()
    if (host && !host.contains(ev.target as Node)) return
    // поле ввода отдаём браузеру: там своё меню с «вставить»
    const t = ev.target as HTMLElement | null
    if (t?.closest('input, textarea, [contenteditable="true"]')) return

    ev.preventDefault()
    returnTo = (document.activeElement as HTMLElement) ?? null
    pressedAt = performance.now()
    pressedPoint = { x: ev.clientX, y: ev.clientY }
    setAt({ x: ev.clientX, y: ev.clientY })
    props.onToggle?.(true)
  }

  function onKey(ev: KeyboardEvent) {
    if (!open()) return
    const top = deepest()
    if (!top) return

    // Esc: сначала сворачивается подменю, и только с корневого уровня —
    // закрывается всё. Иначе одна клавиша схлопывала бы три открытых уровня.
    if (ev.key === 'Escape') {
      ev.preventDefault()
      if (top.depth > 0) stack[stack.length - 2]?.closeSub()
      else close()
      return
    }
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault()
      top.move(ev.key === 'ArrowDown' ? 1 : -1)
      return
    }
    // вбок: вправо — в ветку, влево — назад к родителю
    if (ev.key === 'ArrowRight') {
      ev.preventDefault()
      if (top.openSub()) queueMicrotask(() => deepest()?.move(1))
      return
    }
    if (ev.key === 'ArrowLeft') {
      ev.preventDefault()
      if (top.depth > 0) stack[stack.length - 2]?.closeSub()
      return
    }
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault()
      // на ветке Enter раскрывает её, на обычном пункте — выполняет и закрывает
      if (top.runActive()) close()
      else if (top.openSub()) queueMicrotask(() => deepest()?.move(1))
    }
  }

  // Слушатели вешаются один раз на окно: меню открывается по правому клику где
  // угодно внутри цели, а цель может появиться позже.
  createEffect(() => {
    window.addEventListener('contextmenu', onContext)
    window.addEventListener('keydown', onKey)
    // pointerdown, а не click: закрыть надо ДО того, как клик что-то нажмёт
    const away = (ev: PointerEvent) => {
      // «мимо» — мимо ВСЕХ открытых панелей, не только корневой
      if (open() && !inside(ev.target as Node)) close()
    }
    window.addEventListener('pointerdown', away, true)

    /**
     * Отпустили кнопку. Если её держали и вели — это выбор пункта под курсором
     * (или отказ, если курсор мимо). Если щёлкнули и сразу отпустили — меню
     * остаётся висеть, как привыкли на Windows и Linux.
     */
    const release = (ev: PointerEvent) => {
      if (!open()) return
      const held = performance.now() - pressedAt
      const moved = Math.hypot(ev.clientX - pressedPoint.x, ev.clientY - pressedPoint.y)
      if (held < HOLD && moved < TOL) return

      // Что под курсором, спрашиваем У БРАУЗЕРА: меню лежит в top layer, и
      // `ev.target` при отпускании указывает куда угодно, только не на пункт.
      const under = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
      const hit = under?.closest('.dumb-menu-item') as HTMLButtonElement | null
      // Отпустили на ветке — меню остаётся: подменю уже раскрыто, и жест
      // продолжается в нём. Схлопнуть его здесь значило бы, что до вложенного
      // пункта одним движением не добраться вовсе.
      if (hit?.dataset.sub === '1') return
      if (hit && !hit.disabled) hit.click()      // клик вызовет и `run`, и закрытие
      else close()
    }
    window.addEventListener('pointerup', release, true)

    /**
     * Ведём с зажатой кнопкой — пункт под курсором подсвечивается. Что под
     * курсором, спрашиваем у браузера: при зажатой кнопке события идут туда,
     * где нажали, а панели вдобавок лежат в top layer.
     *
     * Спрашиваем РАЗ В КАДР, а не на каждое событие. `elementFromPoint` — это
     * хиттест, ему нужен свежий layout, а подсветка предыдущего пункта его
     * только что испортила: получилась бы пара «пересчитай раскладку — покрась»
     * на каждое из полутора сотен событий в секунду у мыши с высоким опросом.
     * Кадр их схлопывает в один, и подсветка от этого не отстаёт: чаще кадра
     * её всё равно не видно.
     */
    let hitRaf = 0
    let hitX = 0, hitY = 0
    const hitTest = () => {
      hitRaf = 0
      if (!open()) return
      const under = document.elementFromPoint(hitX, hitY) as HTMLElement | null
      const hit = under?.closest('.dumb-menu-item') as HTMLElement | null
      if (!hit) return
      // подсветку ставит ТА панель, которой пункт принадлежит: своё состояние
      // у каждой, и открытая ветка от чужого движения не должна схлопываться
      const panel = hit.closest('.dumb-menu')
      stack.find((p) => p.el === panel)?.focusItem(hit)
    }
    const track = (ev: PointerEvent) => {
      if (!open() || !ev.buttons) return
      hitX = ev.clientX
      hitY = ev.clientY
      if (!hitRaf) hitRaf = requestAnimationFrame(hitTest)
    }
    window.addEventListener('pointermove', track, true)
    // Прокрутка, смена размера окна и уход со страницы — меню становится не к
    // месту. Ресайз тут не косметика: точка клика привязана к прежней раскладке,
    // и запасной путь (браузеры без anchor positioning) считает место по
    // размерам окна, которые только что поменялись.
    const bail = () => close()
    window.addEventListener('scroll', bail, true)
    window.addEventListener('resize', bail)
    window.addEventListener('blur', bail)

    onCleanup(() => {
      window.removeEventListener('contextmenu', onContext)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', away, true)
      window.removeEventListener('pointerup', release, true)
      window.removeEventListener('pointermove', track, true)
      if (hitRaf) cancelAnimationFrame(hitRaf)
      window.removeEventListener('scroll', bail, true)
      window.removeEventListener('resize', bail)
      window.removeEventListener('blur', bail)
    })
  })

  return (
    <Show when={at()}>
      {(p) => (
        <>
          {/* якорь стоит ровно там, где щёлкнули: корневая панель цепляется за
              него, а каждое подменю — уже за свой пункт */}
          <div class="dumb-menu-anchor" style={{ left: `${p().x}px`, top: `${p().y}px` }} />
          <Panel
            items={props.items()}
            depth={0}
            at={p()}
            onRun={close}
            register={register}
            class={props.class}
          />
        </>
      )}
    </Show>
  )
}
