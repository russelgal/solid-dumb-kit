// Вид уведомления — один на всплывающую плашку и на строку истории.
//
// Взят из системных уведомлений macOS: стеклянная карточка со скруглением,
// квадратный значок слева, жирная первая строка и подробности под ней,
// крестик кружком в углу — чуть снаружи карточки.
//
// Почему вид вынесен сюда: `DumbToaster` и `DumbToastCenter` рисуют ОДНО И ТО
// ЖЕ уведомление в двух местах, и разъехавшийся между ними вид сразу читается
// как небрежность — «в углу было одно, в списке стало другое».
//
// Всё оформление — daisyUI и токены темы: `bg-base-100/80`, `border-base-300`,
// `bg-error`. Своих цветов тут нет, поэтому в чужой теме карточка выглядит
// частью приложения. Стекло — `backdrop-blur`: это утилита Tailwind, а не наш
// CSS, и в тёмной теме оно работает так же.

import { Show, type JSX } from 'solid-js'
import type { Toast, ToastKind } from './toast'

/** цвет значка по виду сообщения: токен темы, а не свой hex */
export const kindTone = (kind: ToastKind) =>
  kind === 'error' ? 'bg-error text-error-content'
  : kind === 'success' ? 'bg-success text-success-content'
  : 'bg-info text-info-content'

/**
 * Знак в значке, когда потребитель не дал свой класс иконки. Кит своих иконок
 * не несёт — рисуем символом, он есть в любом шрифте.
 */
export const kindGlyph = (kind: ToastKind) => (kind === 'error' ? '!' : kind === 'success' ? '✓' : 'i')

/** Значок уведомления: иконка потребителя или знак по виду сообщения. */
export function ToastIcon(props: { t: Toast; size?: 'sm' | 'md' }): JSX.Element {
  const box = () => (props.size === 'sm' ? 'size-7 rounded-lg text-sm' : 'size-9 rounded-xl text-base')
  return (
    <span
      class={`dumb-toast-icon grid shrink-0 place-items-center font-bold ${box()} ${kindTone(props.t.kind)}`}
      aria-hidden="true"
    >
      <Show when={props.t.icon} fallback={kindGlyph(props.t.kind)}>
        <span class={`${props.t.icon} size-[1.2em]`} />
      </Show>
    </span>
  )
}

/**
 * Текст уведомления: жирная первая строка и подробности. Заголовка нет —
 * остаётся одна строка, как было до macOS-вида.
 */
export function ToastBody(props: { t: Toast }): JSX.Element {
  return (
    <span class="dumb-toast-body flex min-w-0 flex-1 flex-col">
      <Show when={props.t.title}>
        <span class="dumb-toast-title text-sm font-semibold">{props.t.title}</span>
      </Show>
      <span class="dumb-toast-text text-sm">{props.t.text}</span>
    </span>
  )
}
