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
      run: () => void
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
`

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
  const [active, setActive] = createSignal(-1)
  let box!: HTMLDivElement
  let returnTo: HTMLElement | null = null

  const open = () => at() !== null
  const items = () => (open() ? props.items() : [])
  /** по каким пунктам ходят стрелки: разделители и глухие пропускаем */
  const pickable = () =>
    items()
      .map((it, i) => ({ it, i }))
      .filter(({ it }) => it.kind !== 'separator' && !(it as { disabled?: boolean }).disabled)

  function close() {
    if (!open()) return
    // порядок важен: сперва убрать из top layer, потом стереть состояние —
    // иначе Solid снимет узел, а браузер останется с открытым popover
    if (box?.matches(':popover-open')) box.hidePopover()
    setAt(null)
    setActive(-1)
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
    setActive(-1)
    props.onToggle?.(true)
  }

  function onKey(ev: KeyboardEvent) {
    if (!open()) return
    const list = pickable()
    if (ev.key === 'Escape') return void (ev.preventDefault(), close())
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault()
      if (!list.length) return
      const cur = list.findIndex(({ i }) => i === active())
      const step = ev.key === 'ArrowDown' ? 1 : -1
      // по кругу: с последнего вниз — на первый, это привычно
      const next = (cur + step + list.length) % list.length
      setActive(list[next < 0 ? list.length - 1 : next].i)
      return
    }
    if (ev.key === 'Enter' || ev.key === ' ') {
      const it = items()[active()]
      if (it && it.kind !== 'separator') {
        ev.preventDefault()
        it.run()
        close()
      }
    }
  }

  // Слушатели вешаются один раз на окно: меню открывается по правому клику где
  // угодно внутри цели, а цель может появиться позже.
  createEffect(() => {
    window.addEventListener('contextmenu', onContext)
    window.addEventListener('keydown', onKey)
    // pointerdown, а не click: закрыть надо ДО того, как клик что-то нажмёт
    const away = (ev: PointerEvent) => {
      if (open() && !box?.contains(ev.target as Node)) close()
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
      if (hit && !hit.disabled) hit.click()      // клик вызовет и `run`, и закрытие
      else close()
    }
    window.addEventListener('pointerup', release, true)

    /** ведём с зажатой кнопкой — пункт под курсором подсвечивается */
    const track = (ev: PointerEvent) => {
      if (!open() || !ev.buttons) return
      const under = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
      const hit = under?.closest('.dumb-menu-item') as HTMLElement | null
      if (!hit) return void setActive(-1)
      const all = Array.from(box?.querySelectorAll('.dumb-menu-item') ?? [])
      // индекс среди ВСЕХ пунктов, включая разделители: с ним сверяется `active`
      const rows = Array.from(box?.querySelectorAll('li') ?? [])
      setActive(rows.findIndex((li) => li.contains(hit)))
      void all
    }
    window.addEventListener('pointermove', track, true)
    // прокрутка и уход со страницы — меню становится не к месту
    const bail = () => close()
    window.addEventListener('scroll', bail, true)
    window.addEventListener('blur', bail)

    onCleanup(() => {
      window.removeEventListener('contextmenu', onContext)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', away, true)
      window.removeEventListener('pointerup', release, true)
      window.removeEventListener('pointermove', track, true)
      window.removeEventListener('scroll', bail, true)
      window.removeEventListener('blur', bail)
    })
  })

  // Открываем ПОСЛЕ вставки узла: `showPopover` на элементе не в документе
  // бросает. Заодно уводим фокус — чтобы стрелки работали сразу.
  createEffect(() => {
    if (!open()) return
    queueMicrotask(() => {
      if (box && !box.matches(':popover-open')) box.showPopover?.()
      box?.focus()
    })
  })

  /**
   * Запасное позиционирование для браузеров без anchor positioning: если курсор
   * во второй половине окна, разворачиваем меню в обратную сторону. Читаем
   * только `innerWidth/innerHeight` — свойства окна, не раскладку элементов.
   */
  const place = (): JSX.CSSProperties => {
    const p = at()
    if (!p) return {}
    // есть anchor positioning — место выбирает браузер, наши координаты не нужны
    // `window.CSS`, а не голое `CSS`: имя занято константой со стилями
    if (window.CSS?.supports?.('anchor-name: --x')) return {}
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
    <Show when={open()}>
      {/* якорь стоит ровно там, где щёлкнули: меню цепляется за него */}
      <div class="dumb-menu-anchor" style={{ left: `${at()!.x}px`, top: `${at()!.y}px` }} />
      <div
        ref={box}
        class={`dumb-menu ${props.class ?? ''}`}
        popover="manual"
        style={place()}
        tabindex={-1}
        role="menu"
      >
        <ul>
          <For each={items()}>
            {(it, i) => (
              <Show
                when={it.kind !== 'separator'}
                fallback={<li class="dumb-menu-sep" role="separator" />}
              >
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    class="dumb-menu-item"
                    data-active={active() === i() ? '1' : undefined}
                    data-danger={(it as { danger?: boolean }).danger ? '1' : undefined}
                    disabled={(it as { disabled?: boolean }).disabled}
                    onMouseEnter={() => setActive(i())}
                    onClick={() => {
                      ;(it as { run: () => void }).run()
                      close()
                    }}
                  >
                    <Show when={(it as { icon?: string }).icon}>
                      <span class={`dumb-menu-icon ${(it as { icon: string }).icon}`} />
                    </Show>
                    <span class="dumb-menu-label">{(it as { label: string }).label}</span>
                    <Show when={(it as { hint?: string }).hint}>
                      <span class="dumb-menu-hint">{(it as { hint: string }).hint}</span>
                    </Show>
                  </button>
                </li>
              </Show>
            )}
          </For>
        </ul>
      </div>
    </Show>
  )
}
