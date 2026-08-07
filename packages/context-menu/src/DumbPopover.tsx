// Поповер: всплывающая карточка у точки или у элемента.
//
// То же, что контекстное меню, только содержимое произвольное. Отдельный
// компонент, потому что случай другой: меню — это список действий с клавишами и
// подсветкой, а тут просто окно рядом с тем, на что нажали.
//
// Почему не модалка. Карточка брони посреди экрана рвёт связь с шахматкой: она
// закрывает саму бронь, о которой рассказывает, и заставляет искать её заново
// после закрытия. Поповер стоит рядом, и связь видна.
//
// Механика та же, что у меню: TOP LAYER через Popover API (над всем, не режется
// `overflow` предков, не спорит за `z-index`) и ANCHOR POSITIONING — сторону
// выбирает браузер, ни одного замера с нашей стороны.

import { Show, onCleanup, type JSX } from 'solid-js'
import { effect, injectStyle, resolveCloseSide, type CloseSideOption } from '@solid-dumb-kit/shared'

export type DumbPopoverProps = {
  /** где показать; `null` — закрыт */
  at: () => { x: number; y: number } | null
  onClose: () => void

  children: JSX.Element
  /** заголовок; не задан — шапки нет */
  title?: JSX.Element
  /** низ карточки: кнопки */
  footer?: JSX.Element

  /** не закрывать по клику мимо */
  keepOnOutside?: boolean
  /** ширина, css; по умолчанию `min(320px, 92vw)` */
  width?: string
  /** сторона крестика; по умолчанию по платформе: macOS слева, иначе справа */
  closeSide?: CloseSideOption
  class?: string
}

const STYLES = `
  /* Только привязка к точке и top layer — вид даёт daisyUI (card) в разметке. */
  .dumb-pop-anchor { position: fixed; width: 1px; height: 1px; pointer-events: none;
                     anchor-name: --dumb-pop-at }
  .dumb-pop { position: fixed; margin: 0; padding: 0; overflow: visible; background: none;
              width: var(--dumb-pop-w, min(320px, 92vw));
              /* UA даёт [popover] inset: 0, и при flip-inline у правого края
                 наш anchor() уезжает в right, а в left приходит ноль от UA —
                 карточка прыгает к левому краю окна. Гасим явно */
              right: auto; bottom: auto;
              position-anchor: --dumb-pop-at;
              /* привязка через anchor(): position-area со span-* Chrome
                 отбрасывает как невалидное, и карточка уезжает в угол */
              top: anchor(--dumb-pop-at bottom);
              left: anchor(--dumb-pop-at right);
              position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline }
  .dumb-pop:popover-open { display: block }
`

export function DumbPopover(props: DumbPopoverProps) {
  injectStyle('popover', STYLES)

  let box!: HTMLDivElement

  const close = () => {
    if (box?.matches(':popover-open')) box.hidePopover()
    props.onClose()
  }

  /** сторона крестика: проп, общая настройка приложения или платформа */
  const side = () => resolveCloseSide(props.closeSide)
  // кнопка одна, а мест два — поэтому функция, а не копия разметки
  const closeButton = () => (
    <button type="button" class="dumb-pop-x btn btn-xs btn-circle btn-ghost" title="закрыть" onClick={close}>
      ✕
    </button>
  )

  effect(() => {
    const open = props.at() !== null
    if (!open) {
      if (box?.matches(':popover-open')) box.hidePopover()
      return
    }
    // открываем ПОСЛЕ вставки узла: `showPopover` на элементе вне документа бросает
    queueMicrotask(() => {
      if (box && !box.matches(':popover-open')) box.showPopover?.()
    })
  })

  effect(() => {
    if (props.at() === null) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    // pointerdown, а не click: закрыть надо ДО того, как клик что-то нажмёт
    const away = (e: PointerEvent) => {
      if (props.keepOnOutside) return
      if (!box?.contains(e.target as Node)) close()
    }
    // прокрутка уводит якорь — карточка становится не к месту
    const bail = () => close()
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', away, true)
    window.addEventListener('scroll', bail, true)
    onCleanup(() => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', away, true)
      window.removeEventListener('scroll', bail, true)
    })
  })

  return (
    <Show when={props.at()}>
      {(spot) => (
        <>
          <div
            class="dumb-pop-anchor"
            style={{ left: `${spot().x}px`, top: `${spot().y}px` }}
          />
          <div
            ref={box}
            popover="manual"
            class={`dumb-pop card rounded-box bg-base-100 border-base-300 border p-3 shadow-xl ${
              props.class ?? ''
            }`}
            style={props.width ? { '--dumb-pop-w': props.width } : undefined}
          >
            <Show when={props.title}>
              <div class="dumb-pop-head mb-2 flex items-center gap-2 font-semibold">
                <Show when={side() === 'left'}>{closeButton()}</Show>
                <div class="dumb-pop-title flex-1 truncate">{props.title}</div>
                <Show when={side() === 'right'}>{closeButton()}</Show>
              </div>
            </Show>
            <div class="dumb-pop-body">{props.children}</div>
            <Show when={props.footer}>
              <div class="dumb-pop-foot mt-3 flex justify-end gap-2">{props.footer}</div>
            </Show>
          </div>
        </>
      )}
    </Show>
  )
}
