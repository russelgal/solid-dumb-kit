// Модальное окно на нативном `<dialog>`.
//
// Всё, ради чего обычно пишут двести строк своей модалки, браузер отдаёт даром,
// если взять `showModal()`:
//
// - окно в TOP LAYER: над всем, включая чужие модалки, и его не режет
//   `overflow: hidden` у предков;
// - подложка — `::backdrop`, отдельного div не нужно;
// - фокус заперт внутри, Tab по кругу;
// - Esc закрывает;
// - страница под окном не прокручивается.
//
// Своими руками здесь остаётся ровно то, чего браузер не делает: возврат фокуса
// туда, откуда пришли, закрытие по клику на подложку (нативно оно не работает —
// клик по `::backdrop` приходит на сам `<dialog>`), и защита от закрытия, когда
// в форме есть несохранённое.

import { Show, createEffect, onCleanup, type JSX } from 'solid-js'
import { injectStyle, shouldAnimate } from '@solid-dumb-kit/shared'

export type DumbModalProps = {
  open: () => boolean
  onClose: () => void

  /** заголовок; не задан — шапки нет вовсе */
  title?: JSX.Element
  /** низ окна: кнопки */
  footer?: JSX.Element
  children: JSX.Element

  /**
   * Спросить перед закрытием. Вернул `false` — окно остаётся. Сюда вешают
   * «есть несохранённое»: браузер закрывает по Esc молча, и правка теряется.
   */
  onBeforeClose?: () => boolean | Promise<boolean>

  /** не закрывать по клику на подложку; по умолчанию закрывает */
  keepOnBackdrop?: boolean
  /** не закрывать по Esc; по умолчанию закрывает */
  keepOnEsc?: boolean

  /** ширина окна, css; по умолчанию `min(560px, 92vw)` */
  width?: string
  /** анимировать; по умолчанию да, но не при prefers-reduced-motion */
  animate?: boolean

  class?: string
  style?: JSX.CSSProperties
}

const STYLES = `
  /* Только структура и механика. Вид окна — daisyUI (modal-box), поэтому здесь
     ни цветов, ни скруглений, ни теней: их задаёт тема потребителя. */
  .dumb-modal { border: 0; padding: 0; max-width: 100vw; max-height: 100vh;
                width: var(--dumb-modal-w, min(560px, 92vw));
                background: none; overflow: visible }
  .dumb-modal[data-animate="1"] { animation: dumb-modal-in .14s ease-out }
  .dumb-modal[data-animate="1"]::backdrop { animation: dumb-modal-fade .14s ease-out }
  @keyframes dumb-modal-in { from { opacity: 0; transform: translateY(8px) scale(.985) } }
  @keyframes dumb-modal-fade { from { opacity: 0 } }
  @media (prefers-reduced-motion: reduce) {
    .dumb-modal[data-animate="1"], .dumb-modal[data-animate="1"]::backdrop { animation: none }
  }

  /* прокручивается ТЕЛО, а не окно целиком: шапка и кнопки должны остаться на
     виду, когда содержимого много */
  .dumb-modal-body { max-height: 70vh; overflow: auto; overscroll-behavior: contain }
`

export function DumbModal(props: DumbModalProps) {
  injectStyle('modal', STYLES)

  let dialog!: HTMLDialogElement
  let returnTo: HTMLElement | null = null

  /** закрыть, спросив у потребителя разрешения */
  async function tryClose() {
    if (props.onBeforeClose) {
      const ok = await props.onBeforeClose()
      if (!ok) return
    }
    props.onClose()
  }

  createEffect(() => {
    const want = props.open()
    if (want && !dialog.open) {
      // куда вернуть фокус, запоминаем ДО открытия: `showModal` его уже уводит
      returnTo = (document.activeElement as HTMLElement) ?? null
      dialog.showModal()
    }
    if (!want && dialog.open) {
      dialog.close()
      returnTo?.focus?.()
      returnTo = null
    }
  })

  onCleanup(() => {
    if (dialog?.open) dialog.close()
  })

  return (
    <dialog
      ref={dialog}
      class={`dumb-modal ${props.class ?? ''}`}
      data-animate={shouldAnimate(props.animate) ? '1' : undefined}
      style={{ ...(props.width ? { '--dumb-modal-w': props.width } : {}), ...props.style }}
      // Esc: браузер закрывает сам, и молча. Перехватываем, чтобы спросить
      // «есть несохранённое» и чтобы состояние снаружи не разъехалось с окном
      onCancel={(ev) => {
        ev.preventDefault()
        if (!props.keepOnEsc) void tryClose()
      }}
      // Клик по подложке приходит НА САМ dialog: у `::backdrop` своей цели нет.
      // Отсюда сравнение с currentTarget — клик внутри окна сюда не долетает
      onClick={(ev) => {
        if (props.keepOnBackdrop) return
        if (ev.target === ev.currentTarget) void tryClose()
      }}
    >
      {/* modal-box из daisyUI: фон, скругление, тень и отступы — из темы */}
      <div class="dumb-modal-box modal-box w-full max-w-none">
        <Show when={props.title}>
          <div class="dumb-modal-head mb-3 flex items-center gap-3">
            <div class="dumb-modal-title flex-1 text-lg font-semibold">{props.title}</div>
            <button
              type="button"
              class="dumb-modal-x btn btn-sm btn-circle btn-ghost"
              title="закрыть"
              onClick={() => void tryClose()}
            >
              ✕
            </button>
          </div>
        </Show>

        <div class="dumb-modal-body">{props.children}</div>

        <Show when={props.footer}>
          <div class="dumb-modal-foot modal-action">{props.footer}</div>
        </Show>
      </div>
    </dialog>
  )
}
