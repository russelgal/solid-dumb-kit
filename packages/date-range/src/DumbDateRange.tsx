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

import { For, Show, createMemo, createSignal, onCleanup, type JSX } from 'solid-js'
import { injectStyle, restoreTextSelection, suppressTextSelection } from '@solid-dumb-kit/shared'
import {
  addDays, addMonths, checkRange, diffDays, inRange, monthGrid, orderRange, reachTo, sameMonth,
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
  /* Оформление — daisyUI-классами в разметке (btn, join, bg-base-*, text-error).
     Здесь остаётся то, чего классом не выразить: сетка недели, диагональная
     перечёркивающая полоса занятого дня и края выбранного периода. */
  .dumb-cal { user-select: none }
  .dumb-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr) }
  .dumb-cal-day { position: relative; aspect-ratio: 1; display: grid; place-items: center }
  /* занятый день перечёркнут по диагонали — видно и без цвета */
  .dumb-cal-day[data-busy="1"]::after {
    content: ''; position: absolute; inset: 18%;
    background: linear-gradient(to top right, transparent 45%,
      currentColor 45%, currentColor 55%, transparent 55%) }
  .dumb-cal-day[data-edge="from"] { border-radius: 8px 0 0 8px }
  .dumb-cal-day[data-edge="to"] { border-radius: 0 8px 8px 0 }
  .dumb-cal-day[data-edge="both"] { border-radius: 8px }
  .dumb-cal-extra { position: absolute; left: 0; right: 0; bottom: 1px; font-size: 9px;
                    text-align: center }
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

  /* ── протяжка по дням ───────────────────────────────────────────────────
   *
   * Период набирается и ЖЕСТОМ: нажал на день, повёл, отпустил. Два клика при
   * этом никуда не делись — короткое нажатие без ведения по-прежнему ставит
   * начало и ждёт второго клика. Различаем по тому, сменился ли день под
   * курсором за время нажатия: это тот же признак, по которому система
   * отличает клик от протаскивания.
   *
   * Что под курсором, спрашиваем у браузера РАЗ В КАДР (`elementFromPoint` —
   * хиттест, ему нужна свежая раскладка, а подсветка предыдущего дня её
   * портит). Замеров ячеек ноль: ни одного `getBoundingClientRect`.
   */
  let hitRaf = 0
  let hitX = 0
  let hitY = 0

  const dayAt = (x: number, y: number): { day: Day; blocked: boolean } | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    const btn = el?.closest<HTMLElement>('[data-day]')
    const day = btn?.dataset.day
    return day ? { day, blocked: (btn as HTMLButtonElement).disabled } : null
  }

  function onDayDown(day: Day, ev: PointerEvent) {
    if (ev.button !== 0 || props.single) return
    suppressTextSelection()
    // начало ставим сразу: предпросмотр периода тянется за курсором как обычно
    setPending(day)
    setHover(day)
    let moved = false

    const hit = () => {
      hitRaf = 0
      const under = dayAt(hitX, hitY)
      if (!under) return
      if (under.day !== day) moved = true
      // Через занятое протяжка не проходит, а ПРИЛИПАЕТ к его границе: тянуть
      // сквозь чужую бронь бессмысленно, а бросать жест на полпути — обидно.
      // Тот же приём, что у полос в шахматке.
      if (!under.blocked) setHover(under.day)
      else {
        const stopAt = limit()
        if (stopAt && diffDays(day, stopAt) > 0) setHover(addDays(stopAt, -1))
      }
    }
    const move = (e: PointerEvent) => {
      hitX = e.clientX
      hitY = e.clientY
      if (!hitRaf) hitRaf = requestAnimationFrame(hit)
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', stop)
      if (hitRaf) cancelAnimationFrame(hitRaf)
      hitRaf = 0
      restoreTextSelection()
    }
    const up = () => {
      const end = hover()
      stop()
      // Отпустили там же, где нажали, — это КЛИК: оставляем начало висеть и
      // ждём второго клика, как было всегда. Иначе это протяжка, и период
      // закрывается сразу.
      if (!moved || !end || end === day) return
      pick(end)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', stop)
    onCleanup(stop)
  }

  const months = () =>
    Array.from({ length: props.months ?? 1 }, (_, i) => addMonths(shownMonth(), i))

  const canBack = () => !props.min || diffDays(props.min, shownMonth()) > 0
  const canFwd = () => !props.max || diffDays(addMonths(shownMonth(), props.months ?? 1), props.max) < 0

  return (
    <div
      class={`dumb-cal flex flex-wrap gap-5 ${props.class ?? ''}`}
      onMouseLeave={() => setHover(null)}
    >
      <For each={months()}>
        {(month, mi) => (
          <div class="dumb-cal-month min-w-62">
            <div class="dumb-cal-head mb-1.5 flex items-center gap-1">
              <Show when={mi() === 0} fallback={<span class="dumb-cal-nav size-8" />}>
                <button
                  type="button"
                  class="dumb-cal-nav btn btn-sm btn-ghost btn-circle"
                  disabled={!canBack()}
                  onClick={() => setShownMonth(addMonths(shownMonth(), -1))}
                >
                  ‹
                </button>
              </Show>
              <div class="dumb-cal-title flex-1 text-center font-semibold capitalize">
                {MONTHS[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)}
              </div>
              <Show when={mi() === (props.months ?? 1) - 1} fallback={<span class="dumb-cal-nav size-8" />}>
                <button
                  type="button"
                  class="dumb-cal-nav btn btn-sm btn-ghost btn-circle"
                  disabled={!canFwd()}
                  onClick={() => setShownMonth(addMonths(shownMonth(), 1))}
                >
                  ›
                </button>
              </Show>
            </div>

            <div class="dumb-cal-grid">
              <For each={WEEK}>
                {(w) => <div class="dumb-cal-week pb-1 text-center text-xs font-medium">{w}</div>}
              </For>
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
                  /**
                   * День ЗА пределом достижимости: от начатого выбора до него
                   * не дотянуться, потому что раньше стоит чужая бронь.
                   *
                   * Сравнение именно `diffDays(l, day) > 0` — «day позже
                   * предела». Обратный знак означал бы «day РАНЬШЕ предела», то
                   * есть гасил бы ровно достижимые дни: после первого клика
                   * весь остаток календаря становился серым, и период было не
                   * закрыть вовсе.
                   */
                  const beyond = () => {
                    const l = limit()
                    return !!l && diffDays(l, day) > 0
                  }
                  const blocked = () =>
                    isBusy(day) ||
                    beyond() ||
                    (!!props.min && diffDays(props.min, day) < 0) ||
                    (!!props.max && diffDays(day, props.max) < 0)

                  return (
                    <button
                      type="button"
                      class={`dumb-cal-day btn btn-ghost btn-sm h-auto min-h-0 p-0 font-normal ${
                        edge() ? 'btn-active btn-neutral font-semibold' : ''
                      } ${inRange(day, range()?.from ?? null, range()?.to ?? null) && !edge() ? 'bg-base-300' : ''} ${
                        isBusy(day) ? 'text-error' : ''
                      } ${sameMonth(day, month) ? '' : 'italic'} ${
                        day === today() ? 'font-bold underline' : ''
                      } ${mark()?.class ?? ''}`}
                      data-day={day}
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
                      onPointerDown={(ev) => onDayDown(day, ev)}
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
