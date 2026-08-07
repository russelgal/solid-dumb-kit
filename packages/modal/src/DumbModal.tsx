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
import {
  injectStyle,
  resolveCloseSide,
  shouldAnimate,
  type CloseSideOption,
} from '@solid-dumb-kit/shared'

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
  /**
   * С какой стороны крестик. По умолчанию решает платформа: в macOS слева, в
   * Windows и Linux справа — там, где рука его и ищет.
   */
  closeSide?: CloseSideOption
  /** анимировать; по умолчанию да, но не при prefers-reduced-motion */
  animate?: boolean

  class?: string
  style?: JSX.CSSProperties
}

const STYLES = `
  /* Только структура и механика. Вид окна — daisyUI (классы modal и modal-box в
     разметке), поэтому здесь ни цветов, ни скруглений, ни теней.

     ВАЖНО: класс modal на самом dialog обязателен. У daisyUI 5 modal-box лежит
     ПРОЗРАЧНЫМ (opacity: 0; scale: .95), а видимым его делает правило вида
     .modal:is([open], .modal-open) > .modal-box. Без modal на родителе окно
     честно открывается — dialog.open === true, элемент в top layer, размеры
     есть, — и при этом его не видно ВООБЩЕ. Один класс, полчаса поисков. */
  .dumb-modal .dumb-modal-box { width: var(--dumb-modal-w, min(560px, 92vw));
                                max-width: min(100vw, var(--dumb-modal-w, 560px)) }
  /* появление рисует daisyUI (scale + opacity у modal-box); наше дело — уметь
     его выключить, когда потребитель попросил или когда просит система */
  .dumb-modal[data-animate="0"] .dumb-modal-box { transition: none }
  @media (prefers-reduced-motion: reduce) { .dumb-modal .dumb-modal-box { transition: none } }

  /* прокручивается ТЕЛО, а не окно целиком: шапка и кнопки должны остаться на
     виду, когда содержимого много */
  .dumb-modal-body { max-height: 70vh; overflow: auto; overscroll-behavior: contain }
`

export function DumbModal(props: DumbModalProps) {
  injectStyle('modal', STYLES)

  let dialog!: HTMLDialogElement
  let returnTo: HTMLElement | null = null

  /** сторона крестика: проп, общая настройка приложения или платформа */
  const side = () => resolveCloseSide(props.closeSide)
  const closeButton = () => (
    <button
      type="button"
      class="dumb-modal-x btn btn-sm btn-circle btn-ghost"
      title="закрыть"
      onClick={() => void tryClose()}
    >
      ✕
    </button>
  )

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
      class={`dumb-modal modal ${props.class ?? ''}`}
      data-animate={shouldAnimate(props.animate) ? '1' : '0'}
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
      <div class="dumb-modal-box modal-box">
        <Show when={props.title}>
          {/* Крестик стоит В РАЗМЕТКЕ той стороной, куда его ждёт платформа, а
              не переставляется CSS-свойством order: с order визуальный порядок
              разъезжается с порядком обхода по Tab. */}
          <div class="dumb-modal-head mb-3 flex items-center gap-3">
            <Show when={side() === 'left'}>{closeButton()}</Show>
            <div class="dumb-modal-title flex-1 text-lg font-semibold">{props.title}</div>
            <Show when={side() === 'right'}>{closeButton()}</Show>
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
