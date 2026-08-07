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
import { For, Show, createSignal, type JSX } from 'solid-js'

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

/**
 * Сегментный переключатель: те же значения, что у `Pick`, но кнопками
 * `join` из daisyUI. Годится, когда вариантов два-три и все они должны быть
 * видны сразу — нативный `select` прячет их за раскрытием и на витрине
 * выглядит чужеродно.
 */
export function Seg<T extends string | number>(props: {
  label?: JSX.Element
  value: T
  options: Array<{ value: T; label?: string }>
  onChange: (v: string) => void
}) {
  const on = (v: T) => String(v) === String(props.value)
  return (
    <span class="inline-flex items-center gap-1.5">
      {props.label}
      <span class="join">
        <For each={props.options}>
          {(o) => (
            <button
              type="button"
              class={on(o.value) ? 'btn btn-sm join-item btn-primary' : 'btn btn-sm join-item'}
              aria-pressed={on(o.value)}
              onClick={() => props.onChange(String(o.value))}
            >
              {o.label ?? String(o.value)}
            </button>
          )}
        </For>
      </span>
    </span>
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

// ─── Дока: блок кода, таблица пропсов, разделы ───────────────────────────────
//
// Это тоже витрина, а не кит: потребителю кит отдаёт поведение, а не разметку
// документации. Живёт здесь, чтобы страницы примеров выглядели одинаково.

/**
 * Запасная подсветка — своя, тридцатью строками регулярок. Основная работает
 * ЗАРАНЕЕ: сниппеты лежат в `*.snippets.ts`, и плагин витрины прогоняет их
 * через Shiki в Node, отдавая готовый HTML (см. `playground/snippets.ts`), —
 * поэтому в браузер не уезжает ни движка, ни грамматик.
 *
 * Эта же функция остаётся для случаев, когда HTML взять неоткуда: строка
 * пришла в `<Code code="…">` прямо в разметке, или пример монтируется в тестах,
 * где плагина витрины нет.
 *
 * Цвета — токены темы, а не свои hex'ы: витрина переключает четыре темы, и
 * захардкоженный «синий для ключевых слов» в половине из них станет нечитаемым.
 */
const TOKENS =
  /(?<comment>\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(?<str>'[^'\n]*'|"[^"\n]*"|`[^`]*`)|(?<tag><\/?[A-Za-z][\w.]*)|(?<key>\b(?:import|export|from|const|let|function|return|await|async|new|type|interface|if|else|for|of|true|false|null|undefined)\b)|(?<num>\b\d+(?:\.\d+)?\b)/g

const TOKEN_CLASS: Record<string, string> = {
  // .9 и не ниже: правило контраста репы запрещает блёклые подписи, а
  // комментарий в примере читают наравне с кодом
  comment: 'text-base-content opacity-90 italic',
  str: 'text-success',
  tag: 'text-accent',
  key: 'text-primary font-semibold',
  num: 'text-warning',
}

function paint(code: string): Array<JSX.Element> {
  const out: Array<JSX.Element> = []
  let at = 0
  for (const m of code.matchAll(TOKENS)) {
    const i = m.index ?? 0
    if (i > at) out.push(code.slice(at, i))
    const kind = Object.keys(m.groups ?? {}).find((k) => m.groups?.[k] !== undefined)
    out.push(<span class={kind ? TOKEN_CLASS[kind] : undefined}>{m[0]}</span>)
    at = i + m[0].length
  }
  if (at < code.length) out.push(code.slice(at))
  return out
}

/**
 * Сниппет: текст для буфера и — если подсветку посчитали на сборке — готовая
 * разметка Shiki. `html` необязателен: в тестах и при строке в разметке его нет.
 */
export type Snippet = { code: string; html?: string }

/**
 * Блок кода с кнопкой «копировать». Кнопка стоит в шапке блока, а не поверх
 * кода: наложенная на текст, она закрывает первую строку — ровно ту, с которой
 * чтение и начинается.
 */
export function Code(props: { code: string | Snippet; title?: JSX.Element }) {
  const [copied, setCopied] = createSignal(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  /** строкой пришёл сниппет или парой «текст + готовая разметка» */
  const snip = (): Snippet => (typeof props.code === 'string' ? { code: props.code } : props.code)

  const copy = async () => {
    try {
      // копируем ТЕКСТ, а не разметку: в буфер должен лечь код, годный к вставке
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(snip().code)
      else {
        const ta = document.createElement('textarea')
        ta.value = snip().code
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.append(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
      }
      setCopied(true)
      clearTimeout(timer)
      timer = setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <figure class="my-3 overflow-hidden rounded-box border border-base-300 bg-base-200">
      <figcaption class="flex items-center gap-2 border-b border-base-300 px-3 py-1.5">
        <span class="flex-1 text-xs font-semibold">{props.title ?? 'Код'}</span>
        <button type="button" class="btn btn-xs" onClick={copy} aria-live="polite">
          <span
            class={copied() ? 'icon-[solar--check-circle-bold] size-4' : 'icon-[solar--copy-bold] size-4'}
            aria-hidden="true"
          />
          {copied() ? 'Скопировано' : 'Копировать'}
        </button>
      </figcaption>
      {/* Готовая разметка Shiki — как есть: она посчитана на сборке из наших же
          файлов, чужого текста тут не бывает. Нет её — красим запасным
          подсветчиком. */}
      <Show
        when={snip().html}
        fallback={
          <pre class="overflow-x-auto p-3 text-xs leading-relaxed"><code>{paint(snip().code)}</code></pre>
        }
      >
        <div class="dumb-shiki overflow-x-auto p-3 text-xs leading-relaxed" innerHTML={snip().html} />
      </Show>
    </figure>
  )
}

/** Раздел доки: заголовок и текст под ним. */
export function Doc(props: { title: JSX.Element; children: JSX.Element }) {
  return (
    <section class="mt-6 max-w-[92ch]">
      <h4 class="mb-1 text-base font-semibold">{props.title}</h4>
      <div class="text-sm">{props.children}</div>
    </section>
  )
}

export type PropRow = {
  name: string
  type: string
  /** значение по умолчанию; не задано — «—» */
  def?: string
  about: JSX.Element
}

/** Таблица пропсов: имя, тип, умолчание, зачем. */
export function Props(props: { title?: JSX.Element; rows: Array<PropRow> }) {
  return (
    <div class="my-3 max-w-[92ch] overflow-x-auto rounded-box border border-base-300">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>{props.title ?? 'Проп'}</th>
            <th>Тип</th>
            <th>По умолчанию</th>
            <th>Зачем</th>
          </tr>
        </thead>
        <tbody>
          <For each={props.rows}>
            {(r) => (
              <tr>
                <td class="font-mono text-xs font-semibold whitespace-nowrap">{r.name}</td>
                <td class="font-mono text-xs whitespace-nowrap">{r.type}</td>
                <td class="font-mono text-xs whitespace-nowrap">{r.def ?? '—'}</td>
                <td class="text-sm">{r.about}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  )
}
