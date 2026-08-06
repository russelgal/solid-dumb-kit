// Панель управления витрины — общая для примеров.
//
// Это НЕ часть кита: кит не навязывает потребителю ни разметку панели, ни её
// вид. Но у примеров панель одна и та же (переключатели, селекты, кнопки), и
// копировать её в каждый файл — верный способ развести пять слегка разных
// панелей.
//
// Оформление — Tailwind + daisyUI, потому что это витрина и потому что кит
// используется в проектах ровно с ними. В самих пакетах их нет: там потребитель
// волен верстать чем угодно, а кит даёт поведение.
import { For, type JSX } from 'solid-js'

/** Панель: горизонтальный ряд контролов. */
export function Bar(props: { children: JSX.Element }) {
  return (
    <div class="mb-3 flex flex-wrap items-center gap-3 text-sm">
      {props.children}
    </div>
  )
}

/**
 * Выделенный переключатель — то, что включает режим целиком.
 *
 * Без класса `label` из daisyUI: он красит подпись своим цветом с
 * прозрачностью .6, а это ровно тот блёклый серый, который в ките запрещён
 * (правило контраста). Раскладку даёт `inline-flex`, цвет — наследуется.
 */
export function Switch(props: {
  checked: boolean
  onChange: (v: boolean) => void
  children: JSX.Element
}) {
  return (
    <label class="inline-flex cursor-pointer items-center gap-2 rounded-full border border-base-300 px-3 py-1">
      <input
        class="toggle toggle-sm toggle-primary"
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.currentTarget.checked)}
      />
      <b>{props.children}</b>
    </label>
  )
}

/** Обычная галочка. */
export function Check(props: {
  checked: boolean
  onChange: (v: boolean) => void
  children: JSX.Element
}) {
  return (
    <label class="inline-flex cursor-pointer items-center gap-2">
      <input
        class="checkbox checkbox-sm"
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.currentTarget.checked)}
      />
      {props.children}
    </label>
  )
}

/** Выбор из нескольких значений; значения строковые, разбор — на стороне примера. */
export function Pick<T extends string | number>(props: {
  label: JSX.Element
  value: T
  options: Array<{ value: T; label?: string }>
  onChange: (v: string) => void
}) {
  return (
    <label class="inline-flex items-center gap-1.5">
      {props.label}
      <select
        class="select select-sm select-bordered w-auto"
        value={String(props.value)}
        onChange={(e) => props.onChange(e.currentTarget.value)}
      >
        <For each={props.options}>
          {(o) => <option value={String(o.value)}>{o.label ?? String(o.value)}</option>}
        </For>
      </select>
    </label>
  )
}

/** Кнопка действия. */
export function Btn(props: { onClick: () => void; children: JSX.Element }) {
  return (
    <button
      class="btn btn-sm"
      type="button"
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
}

/** Приписка справа — обычно счётчик или подсказка. */
export function Note(props: { children: JSX.Element }) {
  return <span class="text-base-content">{props.children}</span>
}
