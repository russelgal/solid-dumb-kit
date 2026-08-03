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

import { Show, createEffect, onCleanup, type JSX } from 'solid-js'
import { injectStyle } from '@solid-dumb-kit/shared'

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
  class?: string
}

const STYLES = `
  .dumb-pop-anchor { position: fixed; width: 1px; height: 1px; pointer-events: none;
                     anchor-name: --dumb-pop-at }
  .dumb-pop { position: fixed; margin: 0; padding: 0; overflow: visible;
              width: var(--dumb-pop-w, min(320px, 92vw));
              border-radius: 12px; font-size: 13px;
              color: var(--dumb-pop-fg, #0f172a);
              background: var(--dumb-pop-bg, #fff);
              border: 1px solid var(--dumb-pop-line, rgb(0 0 0 / .12));
              box-shadow: 0 12px 34px rgb(0 0 0 / .2);
              position-anchor: --dumb-pop-at;
              /* привязка через anchor(): position-area со span-* Chrome
                 отбрасывает как невалидное, и карточка уезжает в угол */
              top: anchor(--dumb-pop-at bottom);
              left: anchor(--dumb-pop-at right);
              position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline }
  .dumb-pop:popover-open { display: block }
  .dumb-pop-head { display: flex; align-items: center; gap: 8px;
                   padding: 9px 12px 4px; font-weight: 600 }
  .dumb-pop-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis;
                    white-space: nowrap }
  .dumb-pop-x { flex: none; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 6px;
                cursor: pointer; font: inherit; background: none;
                color: var(--dumb-pop-dim, #475569) }
  .dumb-pop-x:hover { background: var(--dumb-pop-hover, rgb(0 0 0 / .07)) }
  .dumb-pop-body { padding: 4px 12px 12px }
  .dumb-pop-foot { display: flex; justify-content: flex-end; gap: 6px; padding: 8px 12px;
                   border-top: 1px solid var(--dumb-pop-line, rgb(0 0 0 / .12)) }
`

export function DumbPopover(props: DumbPopoverProps) {
  injectStyle('popover', STYLES)

  let box!: HTMLDivElement

  const close = () => {
    if (box?.matches(':popover-open')) box.hidePopover()
    props.onClose()
  }

  createEffect(() => {
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

  createEffect(() => {
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
            class={`dumb-pop ${props.class ?? ''}`}
            style={props.width ? { '--dumb-pop-w': props.width } : undefined}
          >
            <Show when={props.title}>
              <div class="dumb-pop-head">
                <div class="dumb-pop-title">{props.title}</div>
                <button type="button" class="dumb-pop-x" title="закрыть" onClick={close}>
                  ✕
                </button>
              </div>
            </Show>
            <div class="dumb-pop-body">{props.children}</div>
            <Show when={props.footer}>
              <div class="dumb-pop-foot">{props.footer}</div>
            </Show>
          </div>
        </>
      )}
    </Show>
  )
}
