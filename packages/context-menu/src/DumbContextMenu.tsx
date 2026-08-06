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
  .dumb-menu { position: fixed; margin: 0; min-width: 190px; padding: 4px;
               border-radius: 10px; font-size: 13px;
               color: var(--dumb-menu-fg, #0f172a);
               background: var(--dumb-menu-bg, #fff);
               border: 1px solid var(--dumb-menu-line, rgb(0 0 0 / .12));
               box-shadow: 0 10px 30px rgb(0 0 0 / .18);
               /* в top layer: ни z-index, ни overflow предков больше не важны */
               overflow: visible;
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
  .dumb-menu ul { list-style: none; margin: 0; padding: 0 }
  .dumb-menu-item { display: flex; align-items: center; gap: 8px; width: 100%;
                    padding: 5px 8px; border: 0; border-radius: 6px; background: none;
                    font: inherit; color: inherit; text-align: left; cursor: pointer }
  .dumb-menu-item:hover:not([disabled]),
  .dumb-menu-item[data-active="1"] { background: var(--dumb-menu-hover, rgb(0 0 0 / .07)) }
  .dumb-menu-item[disabled] { opacity: .45; cursor: default }
  .dumb-menu-item[data-danger="1"] { color: var(--dumb-menu-danger, #b91c1c) }
  .dumb-menu-icon { flex: none; width: 1.1em; height: 1.1em }
  .dumb-menu-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis;
                     white-space: nowrap }
  /* подсказка тусклее текста, но читаемо: серому по серому тут не место */
  .dumb-menu-hint { flex: none; font-size: .85em; color: var(--dumb-menu-dim, #475569) }
  .dumb-menu-sep { height: 1px; margin: 4px 6px;
                   background: var(--dumb-menu-line, rgb(0 0 0 / .12)) }
  /* стрелка ветки — полным цветом: это указатель, а не украшение */
  .dumb-menu-more { flex: none; font-size: .9em }

  /* Подменю. Тот же popover, тот же top layer — значит его так же не режет ни
     overflow, ни clip-path предков, и z-index ему не нужен.

     Якорь у него СВОЙ — пиксель в точке, где курсор вошёл в пункт-ветку. Не
     сама кнопка: она лежит внутри родительского popover, а на элемент в top
     layer anchor() не разрешается, и панель уезжает в статическую позицию.
     Сторону, как и у корневого меню, выбирает браузер; замеров по-прежнему
     ноль — координаты берутся из события, а не из раскладки. */
  .dumb-menu-sub { top: anchor(top); left: anchor(right);
                   /* немного вверх, чтобы первая строка подменю оказалась на
                      уровне пункта, а не под курсором */
                   margin-top: -6px; margin-left: 2px;
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
  /** имя якоря родительского пункта; у корня его нет — он цепляется за клик */
  anchor?: string
  /** координаты для браузеров без anchor positioning */
  at: { x: number; y: number }
  /** выполнили пункт — закрыть всё меню */
  onRun: () => void
  register: (api: PanelApi) => () => void
  class?: string
}) {
  const [active, setActive] = createSignal(-1)
  const [sub, setSub] = createSignal<{ i: number; x: number; y: number } | null>(null)
  let el!: HTMLDivElement

  /** Имя якоря для СВОЕГО подменю: у каждой глубины своё, открыт всегда один путь. */
  const subAnchor = `--dumb-sub-${props.depth + 1}`

  const isItem = (it: MenuItem) => it.kind !== 'separator'
  const asItem = (it: MenuItem) => it as Extract<MenuItem, { label: string }>
  const branch = (it: MenuItem) => (isItem(it) ? (asItem(it).items?.length ?? 0) > 0 : false)
  const pickable = () =>
    props.items
      .map((it, i) => ({ it, i }))
      .filter(({ it }) => isItem(it) && !asItem(it).disabled)

  /** Подсветили пункт: ветка раскрывается сразу, обычный пункт закрывает ветку. */
  const highlight = (i: number, x: number, y: number) => {
    setActive(i)
    const it = props.items[i]
    if (it && branch(it)) setSub({ i, x, y })
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
        highlight(i, props.at.x, props.at.y)
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
    // `window.CSS`, а не голое `CSS`: имя занято константой со стилями
    const anchored = window.CSS?.supports?.('anchor-name: --x')
    if (anchored) return props.anchor ? { 'position-anchor': props.anchor } : {}
    const p = props.at
    const flipX = p.x > window.innerWidth / 2
    const flipY = p.y > window.innerHeight / 2
    return {
      left: flipX ? 'auto' : `${p.x}px`,
      right: flipX ? `${window.innerWidth - p.x}px` : 'auto',
      top: flipY ? 'auto' : `${p.y}px`,
      bottom: flipY ? `${window.innerHeight - p.y}px` : 'auto',
    }
  }

  return (
    <>
      {/* Свой якорь — обычный div в документе, а НЕ кнопка-родитель.
          Кнопка лежит внутри родительского popover, то есть в top layer, и
          `anchor()` на неё не разрешается: inset становится auto, а панель
          уезжает в статическую позицию — левый нижний угол экрана. У корневого
          меню якорь ровно такой же, и там всё работает; повторяем механизм. */}
      <Show when={props.depth > 0}>
        <div
          class="dumb-menu-anchor"
          style={{
            left: `${props.at.x}px`,
            top: `${props.at.y}px`,
            'anchor-name': props.anchor,
          }}
        />
      </Show>
      <div
        ref={el}
        class={`dumb-menu ${props.depth > 0 ? 'dumb-menu-sub' : ''} ${props.class ?? ''}`}
        popover="manual"
        style={place()}
        tabindex={-1}
        role="menu"
        data-depth={props.depth}
      >
        <ul>
          <For each={props.items}>
            {(it, i) => (
              <Show when={isItem(it)} fallback={<li class="dumb-menu-sep" role="separator" />}>
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    class="dumb-menu-item"
                    data-active={active() === i() ? '1' : undefined}
                    data-danger={asItem(it).danger ? '1' : undefined}
                    data-sub={branch(it) ? '1' : undefined}
                    aria-haspopup={branch(it) ? 'menu' : undefined}
                    aria-expanded={branch(it) ? (sub()?.i === i() ? 'true' : 'false') : undefined}
                    disabled={asItem(it).disabled}
                    onMouseEnter={(ev) => highlight(i(), ev.clientX, ev.clientY)}
                    onClick={(ev) => {
                      // ветка не выполняется — по клику она просто раскрывается
                      if (branch(it)) return void highlight(i(), ev.clientX, ev.clientY)
                      asItem(it).run?.()
                      props.onRun()
                    }}
                  >
                    <Show when={asItem(it).icon}>
                      <span class={`dumb-menu-icon ${asItem(it).icon}`} />
                    </Show>
                    <span class="dumb-menu-label">{asItem(it).label}</span>
                    <Show when={asItem(it).hint}>
                      <span class="dumb-menu-hint">{asItem(it).hint}</span>
                    </Show>
                    <Show when={branch(it)}>
                      <span class="dumb-menu-more" aria-hidden="true">
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
            anchor={subAnchor}
            at={{ x: s().x, y: s().y }}
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
     */
    const track = (ev: PointerEvent) => {
      if (!open() || !ev.buttons) return
      const under = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
      const hit = under?.closest('.dumb-menu-item') as HTMLElement | null
      if (!hit) return
      // подсветку ставит ТА панель, которой пункт принадлежит: своё состояние
      // у каждой, и открытая ветка от чужого движения не должна схлопываться
      const panel = hit.closest('.dumb-menu')
      stack.find((p) => p.el === panel)?.focusItem(hit)
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
