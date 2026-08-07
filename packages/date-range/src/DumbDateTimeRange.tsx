// Период с временем: заезд 12 августа 14:00 — выезд 15 августа 12:00.
//
// Устроен как две половины, а не как один хитрый виджет:
//
// 1. СУТКИ выбирает готовый `DumbDateRange` — тот же календарь, та же
//    занятость, те же два клика. Ничего нового учить не надо.
// 2. ВРЕМЯ выбирается СЛОТАМИ шагом `step`: занятый слот видно до клика, а не
//    после отказа. Списком часы/минуты тут хуже: «свободно ли в 11:30» из
//    двух выпадающих списков не прочитать вовсе.
//
// Занятость проверяется НА СТЫКАХ, а не только внутри суток: касание концами
// пересечением не считается, поэтому выезд в 12:00 и заезд другого гостя в
// 12:00 в один день уживаются — ровно как в жизни.
//
// Reflow: ни одного замера. Календарь свой, слоты — обычные кнопки, ничего не
// позиционируем.

// watch — из shared/solidCompat: в Solid 2 `on` не экспортируется
import { For, Show, createMemo, createSignal, onCleanup, type JSX } from 'solid-js'
import { injectStyle, restoreTextSelection, suppressTextSelection, watch } from '@solid-dumb-kit/shared'
import { DumbDateRange } from './DumbDateRange'
import { DumbTimeSelect } from './DumbTimeSelect'
import { addDays, diffDays, today, type Day } from './dateMath'
import {
  absMin, checkMomentRange, fmtLength, fmtMoment, minutesBetween, reachToMoment, slotBusy,
  slotsOfDay, toMin, toTime,
  type BusyMoment, type Moment, type Time,
} from './timeMath'

export type DumbDateTimeRangeProps = {
  /** выбранный период; `null` — ничего не выбрано */
  value: () => { from: Moment; to: Moment } | null
  onChange: (next: { from: Moment; to: Moment } | null) => void

  /** занятые отрезки: показываются и не дают выбрать */
  busy?: () => Array<BusyMoment>

  /**
   * Чем выбирать время внутри суток:
   *
   * - `slots` (по умолчанию) — лента слотов шагом `step`. Период тянется
   *   НАЖАТИЕМ И ПРОТЯЖКОЙ по ней, как в календаре: занятое видно сразу, а
   *   свободное окно окидываешь глазами;
   * - `select` — часы и минуты списками (`DumbTimeSelect`). Для мелкого шага,
   *   тесной формы и телефона, где `<select>` даёт родное колесо.
   */
  mode?: 'slots' | 'select'
  /** шаг слотов в минутах; по умолчанию 30 */
  step?: number
  /**
   * Рабочее окно, минуты от полуночи. Ночь вырезается: у мастера в 03:00
   * записи нет, и показывать этот слот — только мешать.
   */
  openMin?: number
  closeMin?: number

  /** предлагать это время, когда день выбран, а слот ещё нет */
  defaultFromTime?: Time
  defaultToTime?: Time

  /** минимальная и максимальная длительность, минуты */
  minMinutes?: number
  maxMinutes?: number

  /** сколько месяцев показывать разом; по умолчанию 1 */
  months?: number
  /** раньше этого дня нельзя; по умолчанию с сегодняшнего */
  min?: Day
  max?: Day

  /**
   * Своё в углу дня — цена, остаток, что угодно. На КРАЯХ выбранного периода
   * компонент рисует там время заезда и выезда: оно важнее цены ровно в этих
   * двух ячейках, а в остальных остаётся ваше.
   */
  dayExtra?: (day: Day) => JSX.Element
  /** подписи над слотами; по умолчанию «Заезд» и «Выезд» */
  fromLabel?: string
  toLabel?: string
  /** выбрать не вышло: сюда приходит причина */
  onReject?: (why: string) => void

  class?: string
  style?: JSX.CSSProperties
}

const STYLES = `
  /* Оформление — daisyUI (btn, join, badge). Здесь только штриховка занятого
     слота: её надо видеть и в чёрно-белой печати, и дальтонику, а класса под
     такое у daisyUI нет. */
  .dumb-dt-slot[data-busy="1"] {
    background-image: repeating-linear-gradient(45deg,
      transparent 0 4px, currentColor 4px 5px) }
  .dumb-dt-slots { display: flex; flex-wrap: wrap; gap: 4px }
  /* во время протяжки курсор не должен «прилипать» к тексту слотов */
  .dumb-dt-slots[data-dragging="1"] { cursor: ew-resize }

  /* Оверлей с часами заезда и выезда. Лежит ПОВЕРХ низа календаря, а не под
     ним: так время видно, не отводя глаз от выбранного периода, и раскладка
     не прыгает, когда период появился. Позиционирование тут, вид — daisyUI. */
  .dumb-dt-wrap { position: relative }
  /* место под оверлей отводится заранее: иначе он накрывает последнюю неделю,
     и в неё нельзя ткнуть */
  .dumb-dt-wrap[data-overlay="1"] { padding-bottom: 3.5rem }
  .dumb-dt-overlay { position: absolute; left: 0; right: 0; bottom: 0; z-index: 2 }
  /* подпись времени в крайнем дне периода: мелким, поверх числа */
  .dumb-dt-edge { font-variant-numeric: tabular-nums; font-weight: 600 }
`

/**
 * Сутки занятого отрезка — календарю нужны дни, а не минуты.
 *
 * Занятыми помечаются только те сутки, которые бронь съедает ЦЕЛИКОМ или
 * начинает: день, где она кончается ровно в полночь, свободен полностью, а в
 * остальные дни-концы ещё можно заехать позже её выезда — поэтому день выезда
 * календарю не отдаём, его разбирают уже слоты.
 */
function busyDays(busy: Array<BusyMoment>): Array<{ from: Day; to: Day; title?: string }> {
  return busy
    .map((b) => ({
      from: b.from.day,
      to: addDays(b.to.day, -1),
      title: b.title,
    }))
    .filter((b) => diffDays(b.from, b.to) >= 0)
}

export function DumbDateTimeRange(props: DumbDateTimeRangeProps): JSX.Element {
  injectStyle('date-time-range', STYLES)

  const step = () => props.step ?? 30
  const busy = () => props.busy?.() ?? []

  /**
   * Дни выбираются календарём, время — слотами; храним их порознь.
   *
   * Сигналы названы `startTime`/`endTime`, а НЕ `fromTime`/`toTime`: имя
   * `toTime` уже занято функцией из `timeMath` (минуты → `HH:mm`), и геттер
   * сигнала её затенял. Вызов `toTime(минуты)` при этом не падал — он молча
   * возвращал значение сигнала, то есть `null`, и период не собирался вовсе.
   */
  const [days, setDays] = createSignal<{ from: Day; to: Day } | null>(
    props.value() ? { from: props.value()!.from.day, to: props.value()!.to.day } : null,
  )
  const [startTime, setStartTime] = createSignal<Time | null>(props.value()?.from.time ?? null)
  const [endTime, setEndTime] = createSignal<Time | null>(props.value()?.to.time ?? null)

  // Значение снаружи — источник истины: сбросили период кнопкой «Очистить»
  // или подставили чужую бронь на правку, и компонент обязан это показать.
  // Сравниваем по содержимому, иначе собственный onChange возвращался бы сюда
  // же и затирал наполовину набранный выбор.
  watch(
    () => {
      const v = props.value()
      return v ? `${v.from.day} ${v.from.time} ${v.to.day} ${v.to.time}` : ''
    },
    (key) => {
      const v = props.value()
      if (!v) {
        if (!days() && !startTime() && !endTime()) return
        setDays(null)
        setStartTime(null)
        setEndTime(null)
        return
      }
      const mine = picked()
      if (mine && key === `${mine.from.day} ${mine.from.time} ${mine.to.day} ${mine.to.time}`) return
      setDays({ from: v.from.day, to: v.to.day })
      setStartTime(v.from.time)
      setEndTime(v.to.time)
    },
    { defer: true },
  )

  const slots = createMemo(() => slotsOfDay({
    step: step(),
    openMin: props.openMin,
    closeMin: props.closeMin,
  }))

  /** собранный период; `null`, пока не хватает половины */
  const picked = createMemo(() => {
    const d = days()
    const ft = startTime()
    const tt = endTime()
    if (!d || !ft || !tt) return null
    return { from: { day: d.from, time: ft }, to: { day: d.to, time: tt } }
  })

  const length = () => {
    const p = picked()
    return p ? minutesBetween(p.from, p.to) : 0
  }

  /**
   * Отдать наружу, если период сходится. Причину отказа проговариваем — молча
   * не применить хуже, чем отказать.
   */
  function commit() {
    const p = picked()
    if (!p) return
    const check = checkMomentRange({
      from: p.from,
      to: p.to,
      busy: busy(),
      minMinutes: props.minMinutes,
      maxMinutes: props.maxMinutes,
    })
    if (!check.ok) {
      props.onReject?.(check.why)
      return
    }
    props.onChange(p)
  }

  function pickDays(next: { from: Day; to: Day } | null) {
    setDays(next)
    if (!next) {
      setStartTime(null)
      setEndTime(null)
      props.onChange(null)
      return
    }
    // Время предлагаем сразу: в гостинице заезд и выезд почти всегда типовые,
    // и заставлять тыкать в них каждый раз — работа на пустом месте.
    if (!startTime()) setStartTime(props.defaultFromTime ?? null)
    if (!endTime()) setEndTime(props.defaultToTime ?? null)
    queueMicrotask(commit)
  }

  function pickTime(which: 'from' | 'to', time: Time) {
    which === 'from' ? setStartTime(time) : setEndTime(time)
    queueMicrotask(commit)
  }

  /** занят ли слот на этом дне — с учётом того, что конец отрезка не включается */
  const slotState = (day: Day | undefined, time: Time) => {
    if (!day) return { busy: null as BusyMoment | null, disabled: true }
    const hit = slotBusy(day, time, step(), busy())
    return { busy: hit, disabled: !!hit }
  }

  /** слот выезда не может стоять раньше заезда — гасим такие сразу */
  const tooEarly = (time: Time) => {
    const d = days()
    const ft = startTime()
    if (!d || !ft) return false
    return absMin({ day: d.to, time }, d.from) <= toMin(ft)
  }

  /* ── протяжка по ленте слотов ─────────────────────────────────────────── */

  /**
   * Период внутри одних суток набирается ЖЕСТОМ: нажал на слот, повёл, отпустил.
   * Два клика («сначала начало, потом конец») тут проигрывают — глазом уже
   * видно свободное окно, и рука хочет обвести его целиком.
   *
   * Что под курсором, спрашиваем у браузера РАЗ В КАДР (`elementFromPoint` —
   * хиттест, ему нужна свежая раскладка, а подсветка предыдущего слота её
   * портит). Замеров слотов при этом ноль: ни одного `getBoundingClientRect`.
   */
  const [dragFrom, setDragFrom] = createSignal<Time | null>(null)
  const [dragTo, setDragTo] = createSignal<Time | null>(null)
  let hitRaf = 0
  let hitX = 0
  let hitY = 0

  /** слот под точкой; null — мимо ленты */
  const slotAt = (x: number, y: number): Time | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    return el?.closest<HTMLElement>('[data-slot]')?.dataset.slot ?? null
  }

  /** докуда пускаем протяжку: упираемся в ближайшее занятое, а не сквозь него */
  const limitTo = (day: Day, from: Time, to: Time): Time => {
    const reach = reachToMoment({ day, time: from }, busy(), { day, time: '24:00' })
    const cap = absMin(reach, day)
    const want = toMin(to) + step()
    return toTime(Math.min(want, cap) - step())
  }

  function onSlotDown(day: Day, time: Time, ev: PointerEvent) {
    if (ev.button !== 0) return
    // жест начинается сразу: слоты мелкие, порог тут только мешает
    suppressTextSelection()
    setDragFrom(time)
    setDragTo(time)
    const box = ev.currentTarget as HTMLElement

    const hit = () => {
      hitRaf = 0
      const under = slotAt(hitX, hitY)
      if (under) setDragTo(limitTo(day, dragFrom()!, under))
    }
    const move = (e: PointerEvent) => {
      hitX = e.clientX
      hitY = e.clientY
      if (!hitRaf) hitRaf = requestAnimationFrame(hit)
    }
    const up = () => {
      box.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      if (hitRaf) cancelAnimationFrame(hitRaf)
      hitRaf = 0
      restoreTextSelection()

      const a = dragFrom()
      const b = dragTo()
      setDragFrom(null)
      setDragTo(null)
      if (!a || !b) return
      // конец периода — КОНЕЦ последнего слота, а не его начало: обвели один
      // получасовой слот — получили полчаса, а не нулевую длительность
      const start = toMin(a) <= toMin(b) ? a : b
      const stop = toTime(Math.max(toMin(a), toMin(b)) + step())
      setDays({ from: day, to: day })
      setStartTime(start)
      setEndTime(stop)
      queueMicrotask(commit)
    }
    const cancel = () => {
      setDragFrom(null)
      setDragTo(null)
      restoreTextSelection()
      box.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }

    box.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    onCleanup(cancel)
  }

  /** попадает ли слот в тянущийся сейчас период */
  const inDrag = (time: Time) => {
    const a = dragFrom()
    const b = dragTo()
    if (!a || !b) return false
    const m = toMin(time)
    return m >= Math.min(toMin(a), toMin(b)) && m <= Math.max(toMin(a), toMin(b))
  }

  /** попадает ли слот в уже выбранный период (в пределах своего дня) */
  const inPicked = (day: Day | undefined, time: Time) => {
    const pk = picked()
    if (!pk || !day) return false
    const m = absMin({ day, time }, pk.from.day)
    return m >= absMin(pk.from, pk.from.day) && m < absMin(pk.to, pk.from.day)
  }

  const Slots = (p: { which: 'from' | 'to'; day: Day | undefined; label: string; drag?: boolean }) => (
    <div>
      <div class="mb-1 flex items-center gap-2 text-sm font-semibold">
        {p.label}
        <Show when={p.day}>
          <span class="badge badge-sm badge-ghost">{p.day}</span>
        </Show>
      </div>
      <div
        class="dumb-dt-slots"
        data-dragging={dragFrom() ? '1' : undefined}
        onPointerDown={(ev) => {
          if (!p.drag || !p.day) return
          const time = (ev.target as HTMLElement).closest<HTMLElement>('[data-slot]')?.dataset.slot
          if (time) onSlotDown(p.day, time, ev)
        }}
      >
        <For each={slots()}>
          {(time) => {
            const state = () => slotState(p.day, time)
            const early = () => !p.drag && p.which === 'to' && tooEarly(time)
            const chosen = () =>
              p.drag
                ? inDrag(time) || inPicked(p.day, time)
                : (p.which === 'from' ? startTime() : endTime()) === time
            return (
              <button
                type="button"
                class="dumb-dt-slot btn btn-xs"
                data-slot={time}
                classList={{
                  'btn-neutral': chosen(),
                  'btn-ghost': !chosen(),
                  'btn-disabled': state().disabled || early(),
                  'text-error': !!state().busy,
                }}
                data-busy={state().busy ? '1' : undefined}
                disabled={state().disabled || early()}
                title={state().busy?.title ?? (early() ? 'раньше заезда' : undefined)}
                onClick={() => !p.drag && pickTime(p.which, time)}
              >
                {time}
              </button>
            )
          }}
        </For>
      </div>
    </div>
  )

  return (
    <div class={`dumb-dt flex flex-col gap-4 ${props.class ?? ''}`} style={props.style}>
      <div class="dumb-dt-wrap" data-overlay={days() ? '1' : undefined}>
        <DumbDateRange
          value={days}
          onChange={pickDays}
          months={props.months}
          min={props.min ?? today()}
          max={props.max}
          busy={() => busyDays(busy())}
          onReject={props.onReject}
          // Часы прямо в ячейке: на дне заезда — со скольки, на дне выезда —
          // до скольки. Иначе время живёт отдельно от периода, и глазами их
          // приходится сводить самому.
          dayExtra={(day) => {
            const d = days()
            if (d && day === d.from && startTime()) {
              return <span class="dumb-dt-edge">{startTime()}</span>
            }
            if (d && day === d.to && endTime()) {
              return <span class="dumb-dt-edge">{endTime()}</span>
            }
            return props.dayExtra?.(day) ?? null
          }}
        />

        {/* Оверлей: часы обоих краёв под рукой, менять можно не сходя с
            календаря. Появляется вместе с выбранным периодом. */}
        <Show when={days()}>
          {(d) => (
            <div class="dumb-dt-overlay">
              <div class="bg-base-100/95 border-base-300 rounded-box flex flex-wrap items-center gap-3 border p-2 shadow-lg backdrop-blur">
                <DumbTimeSelect
                  label={<span class="font-semibold">{props.fromLabel ?? 'Заезд'}</span>}
                  value={startTime}
                  onChange={(t) => pickTime('from', t)}
                  step={step()}
                  openMin={props.openMin}
                  closeMin={props.closeMin}
                  day={d().from}
                  busy={busy}
                />
                <span class="opacity-90">→</span>
                <DumbTimeSelect
                  label={<span class="font-semibold">{props.toLabel ?? 'Выезд'}</span>}
                  value={endTime}
                  onChange={(t) => pickTime('to', t)}
                  step={step()}
                  openMin={props.openMin}
                  closeMin={props.closeMin}
                  day={d().to}
                  busy={busy}
                />
                <Show when={picked() && length() > 0}>
                  <span class="badge badge-sm badge-neutral ml-auto">{fmtLength(length())}</span>
                </Show>
              </div>
            </div>
          )}
        </Show>
      </div>

      <Show when={days()}>
        {(d) => (
          <Show
            when={props.mode === 'select'}
            fallback={
              <Show
                when={d().from !== d().to}
                fallback={
                  /* один день — ОДНА лента, период обводится протяжкой */
                  <Slots
                    which="from"
                    day={d().from}
                    label={props.fromLabel ?? 'Время'}
                    drag
                  />
                }
              >
                <div class="flex flex-wrap gap-6">
                  <Slots which="from" day={d().from} label={props.fromLabel ?? 'Заезд'} />
                  <Slots which="to" day={d().to} label={props.toLabel ?? 'Выезд'} />
                </div>
              </Show>
            }
          >
            {/* списками: мелкий шаг, тесная форма, телефон */}
            <div class="flex flex-wrap gap-6">
              <DumbTimeSelect
                label={props.fromLabel ?? 'Заезд'}
                value={startTime}
                onChange={(t) => pickTime('from', t)}
                step={step()}
                openMin={props.openMin}
                closeMin={props.closeMin}
                day={d().from}
                busy={busy}
              />
              <DumbTimeSelect
                label={props.toLabel ?? 'Выезд'}
                value={endTime}
                onChange={(t) => pickTime('to', t)}
                step={step()}
                openMin={props.openMin}
                closeMin={props.closeMin}
                day={d().to}
                busy={busy}
              />
            </div>
          </Show>
        )}
      </Show>

      <Show when={picked()}>
        {(p) => (
          <div class="text-sm">
            <b>{fmtMoment(p().from)}</b> → <b>{fmtMoment(p().to)}</b>
            <Show when={length() > 0}>
              <span class="ml-2">· {fmtLength(length())}</span>
              <Show when={diffDays(p().from.day, p().to.day) > 0}>
                <span class="ml-2 badge badge-sm badge-ghost">
                  {diffDays(p().from.day, p().to.day)} ноч.
                </span>
              </Show>
            </Show>
          </div>
        )}
      </Show>
    </div>
  )
}
