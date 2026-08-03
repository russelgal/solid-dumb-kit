// Календарь: выбрать день или период, видя занятое.
//
// Период набирается двумя кликами (первый — начало, второй — конец), а до
// второго клика диапазон тянется за курсором. Это привычнее протяжки мышью:
// на тачскрине протяжка конфликтует с прокруткой страницы, а два тапа работают
// одинаково везде.
//
// Занятость показывается ДО клика: дни за ближайшим занятым отрезком гаснут,
// потому что дотянуть туда всё равно нельзя. Ругаться после выбора — худший из
// вариантов, человек уже успел решить.
//
// Дата здесь — строка `YYYY-MM-DD`, а не `Date`: см. `dateMath.ts`, там же
// объяснено, почему это не придирка.

import { For, Show, createMemo, createSignal, type JSX } from 'solid-js'
import { injectStyle } from '@solid-dumb-kit/shared'
import {
  addMonths, checkRange, diffDays, inRange, monthGrid, orderRange, reachTo, sameMonth,
  startOfMonth, today, weekIndex, type Day,
} from './dateMath'

export type BusySpan = {
  from: Day
  to: Day
  /** подпись при наведении: кто занял */
  title?: string
  /** свой класс — раскрасить по типу брони */
  class?: string
}

export type DumbDateRangeProps = {
  /** выбранный период; для одиночной даты `to === from` */
  value: () => { from: Day; to: Day } | null
  onChange: (next: { from: Day; to: Day } | null) => void

  /** одна дата вместо периода */
  single?: boolean
  /** занятые отрезки: показываются и не дают выбрать */
  busy?: () => Array<BusySpan>
  /** праздники и выходные — подсветить, но выбирать можно */
  marks?: () => Record<Day, { title?: string; class?: string }>

  /** сколько месяцев показывать разом; по умолчанию 1 */
  months?: number
  /** раньше этого дня нельзя; по умолчанию без предела */
  min?: Day
  max?: Day
  minNights?: number
  maxNights?: number

  /** цена или что угодно в углу дня */
  dayExtra?: (day: Day) => JSX.Element
  /** выбрать не вышло: сюда приходит причина */
  onReject?: (why: string) => void

  class?: string
}

const WEEK = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']
const MONTHS = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
]

const STYLES = `
  .dumb-cal { display: flex; gap: 18px; flex-wrap: wrap;
              color: var(--dumb-cal-fg, #0f172a); user-select: none }
  .dumb-cal-month { min-width: 15.5rem }
  .dumb-cal-head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px }
  .dumb-cal-title { flex: 1; text-align: center; font-weight: 600; font-size: 14px;
                    text-transform: capitalize }
  .dumb-cal-nav { width: 26px; height: 26px; padding: 0; border: 0; border-radius: 7px;
                  cursor: pointer; font: inherit; background: none; color: inherit }
  .dumb-cal-nav:hover { background: var(--dumb-cal-hover, rgb(0 0 0 / .07)) }
  .dumb-cal-nav[disabled] { opacity: .35; cursor: default }

  .dumb-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr) }
  .dumb-cal-week { font-size: 11px; text-align: center; padding-bottom: 4px;
                   color: var(--dumb-cal-dim, #475569) }
  .dumb-cal-day { position: relative; aspect-ratio: 1; display: grid; place-items: center;
                  font-size: 13px; border: 0; background: none; font: inherit; color: inherit;
                  cursor: pointer; line-height: 1 }
  /* соседний месяц виден, но приглушён: без него сетка прыгает, а с ним — нет */
  .dumb-cal-day[data-out="1"] { opacity: .35 }
  .dumb-cal-day[data-today="1"] { font-weight: 700; text-decoration: underline }
  .dumb-cal-day:hover:not([disabled]) { background: var(--dumb-cal-hover, rgb(0 0 0 / .07)) }
  /* середина периода — сплошная полоса, края — скруглены: так видно направление */
  .dumb-cal-day[data-in="1"] { background: var(--dumb-cal-range, rgb(37 99 235 / .14)) }
  .dumb-cal-day[data-edge="from"] { border-radius: 8px 0 0 8px }
  .dumb-cal-day[data-edge="to"] { border-radius: 0 8px 8px 0 }
  .dumb-cal-day[data-edge="both"] { border-radius: 8px }
  .dumb-cal-day[data-edge] { background: var(--dumb-cal-accent, #2563eb); color: #fff;
                             font-weight: 600 }
  .dumb-cal-day[data-busy="1"] { color: var(--dumb-cal-busy, #b91c1c) }
  /* занятый день перечёркнут по диагонали — видно и без цвета */
  .dumb-cal-day[data-busy="1"]::after {
    content: ''; position: absolute; inset: 18%;
    background: linear-gradient(to top right, transparent 45%,
      var(--dumb-cal-busy, #b91c1c) 45%, var(--dumb-cal-busy, #b91c1c) 55%, transparent 55%) }
  .dumb-cal-day[disabled] { cursor: default; opacity: .3 }
  .dumb-cal-extra { position: absolute; left: 0; right: 0; bottom: 1px; font-size: 9px;
                    text-align: center; color: var(--dumb-cal-dim, #475569) }
  .dumb-cal-day[data-edge] .dumb-cal-extra { color: inherit }
`

export function DumbDateRange(props: DumbDateRangeProps) {
  injectStyle('date-range', STYLES)

  const [shownMonth, setShownMonth] = createSignal<Day>(
    startOfMonth(props.value()?.from ?? today()),
  )
  /** первый клик сделан, ждём второй */
  const [pending, setPending] = createSignal<Day | null>(null)
  /** день под курсором — по нему тянется предварительный диапазон */
  const [hover, setHover] = createSignal<Day | null>(null)

  const busy = () => props.busy?.() ?? []
  const marks = () => props.marks?.() ?? {}

  /** что показывать закрашенным: выбранное или то, что тянется за курсором */
  const shownRange = createMemo(() => {
    const start = pending()
    if (start) {
      const end = hover() ?? start
      const [from, to] = orderRange(start, end)
      return { from, to }
    }
    return props.value()
  })

  /** докуда можно дотянуть от начатого выбора: за ближайшее занятое нельзя */
  const limit = createMemo(() => {
    const start = pending()
    if (!start) return null
    return reachTo(start, busy(), props.max ?? '9999-12-31')
  })

  const isBusy = (day: Day) =>
    busy().some((b) => diffDays(b.from, day) >= 0 && diffDays(day, b.to) <= 0)

  function pick(day: Day) {
    if (props.single) {
      props.onChange({ from: day, to: day })
      return
    }
    const start = pending()
    if (!start) {
      setPending(day)
      return
    }
    const [from, to] = orderRange(start, day)
    const check = checkRange({
      from, to,
      busy: busy(),
      minNights: props.minNights,
      maxNights: props.maxNights,
      min: props.min,
      max: props.max,
    })
    if (!check.ok) {
      // не выбралось — начинаем заново С ЭТОГО дня, а не с пустого места:
      // почти всегда человек промахнулся, а не передумал
      props.onReject?.(check.why)
      setPending(day)
      return
    }
    setPending(null)
    props.onChange({ from, to })
  }

  const months = () =>
    Array.from({ length: props.months ?? 1 }, (_, i) => addMonths(shownMonth(), i))

  const canBack = () => !props.min || diffDays(props.min, shownMonth()) > 0
  const canFwd = () => !props.max || diffDays(addMonths(shownMonth(), props.months ?? 1), props.max) < 0

  return (
    <div class={`dumb-cal ${props.class ?? ''}`} onMouseLeave={() => setHover(null)}>
      <For each={months()}>
        {(month, mi) => (
          <div class="dumb-cal-month">
            <div class="dumb-cal-head">
              <Show when={mi() === 0} fallback={<span class="dumb-cal-nav" />}>
                <button
                  type="button"
                  class="dumb-cal-nav"
                  disabled={!canBack()}
                  onClick={() => setShownMonth(addMonths(shownMonth(), -1))}
                >
                  ‹
                </button>
              </Show>
              <div class="dumb-cal-title">
                {MONTHS[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)}
              </div>
              <Show when={mi() === (props.months ?? 1) - 1} fallback={<span class="dumb-cal-nav" />}>
                <button
                  type="button"
                  class="dumb-cal-nav"
                  disabled={!canFwd()}
                  onClick={() => setShownMonth(addMonths(shownMonth(), 1))}
                >
                  ›
                </button>
              </Show>
            </div>

            <div class="dumb-cal-grid">
              <For each={WEEK}>{(w) => <div class="dumb-cal-week">{w}</div>}</For>
              <For each={monthGrid(month)}>
                {(day) => {
                  const range = () => shownRange()
                  const edge = () => {
                    const r = range()
                    if (!r) return undefined
                    if (r.from === day && r.to === day) return 'both'
                    if (r.from === day) return 'from'
                    if (r.to === day) return 'to'
                    return undefined
                  }
                  const mark = () => marks()[day]
                  const beyond = () => {
                    const l = limit()
                    return !!l && diffDays(l, day) < 0 && diffDays(pending()!, day) > 0
                  }
                  const blocked = () =>
                    isBusy(day) ||
                    beyond() ||
                    (!!props.min && diffDays(props.min, day) < 0) ||
                    (!!props.max && diffDays(day, props.max) < 0)

                  return (
                    <button
                      type="button"
                      class={`dumb-cal-day ${mark()?.class ?? ''}`}
                      data-out={sameMonth(day, month) ? undefined : '1'}
                      data-today={day === today() ? '1' : undefined}
                      data-busy={isBusy(day) ? '1' : undefined}
                      data-in={inRange(day, range()?.from ?? null, range()?.to ?? null) ? '1' : undefined}
                      data-edge={edge()}
                      disabled={blocked()}
                      title={
                        busy().find((b) => diffDays(b.from, day) >= 0 && diffDays(day, b.to) <= 0)
                          ?.title ?? mark()?.title
                      }
                      onMouseEnter={() => setHover(day)}
                      onClick={() => pick(day)}
                    >
                      {Number(day.slice(8, 10))}
                      <Show when={props.dayExtra}>
                        <span class="dumb-cal-extra">{props.dayExtra!(day)}</span>
                      </Show>
                    </button>
                  )
                }}
              </For>
            </div>
          </div>
        )}
      </For>
    </div>
  )
}
