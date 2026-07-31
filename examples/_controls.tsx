// Панель управления витрины — общая для примеров.
//
// Это НЕ часть кита: кит не навязывает потребителю ни разметку панели, ни её
// вид. Но у примеров панель одна и та же (переключатели, селекты, кнопки), и
// копировать её в каждый файл вместе со стилями — верный способ развести пять
// слегка разных панелей. Поэтому она живёт здесь, а примеры собирают свою из
// готовых кубиков.
//
// Стили инжектятся ОДИН раз на страницу, сколько бы панелей ни отрисовалось:
// вкладок в витрине много, и каждая, вешая свою копию, множила бы одинаковые
// правила.
import { createSignal, For, Show, type JSX } from 'solid-js'

let styled = false

/** Панель: горизонтальный ряд контролов. */
export function Bar(props: { children: JSX.Element }) {
  const [first] = createSignal(!styled)
  styled = true
  return (
    <div class="kit-bar">
      {props.children}
      <Show when={first()}>
        <style>{`
          .kit-bar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
                     margin: 0 0 12px; font-size: 13px; color: #334155 }
          .kit-bar label { display: inline-flex; gap: 6px; align-items: center }
          .kit-bar select, .kit-bar button {
            font: inherit; padding: 4px 8px; border: 1px solid #cbd5e1;
            border-radius: 8px; background: #fff; cursor: pointer }
          .kit-bar button:hover { background: #f1f5f9 }
          .kit-bar .kit-switch { padding: 4px 10px; border: 1px solid #cbd5e1;
                                 border-radius: 999px; background: #fff; white-space: nowrap }
          .kit-bar .kit-note { color: #94a3b8 }
        `}</style>
      </Show>
    </div>
  )
}

/** Выделенный переключатель — то, что включает режим целиком. */
export function Switch(props: {
  checked: boolean
  onChange: (v: boolean) => void
  children: JSX.Element
}) {
  return (
    <label class="kit-switch">
      <input
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
    <label>
      <input
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
    <label>
      {props.label}
      <select value={String(props.value)} onChange={(e) => props.onChange(e.currentTarget.value)}>
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
    <button type="button" onClick={props.onClick}>
      {props.children}
    </button>
  )
}

/** Приписка справа — обычно счётчик или подсказка. */
export function Note(props: { children: JSX.Element }) {
  return <span class="kit-note">{props.children}</span>
}
