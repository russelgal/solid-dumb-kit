// Время и моменты: арифметика без `Date` и без часовых поясов.
//
// Время здесь — строка `HH:mm`, момент — пара `{ day, time }`. Причина та же,
// по которой дата в `dateMath` — строка `YYYY-MM-DD`: `new Date('2026-08-12
// 14:00')` разбирается в ЛОКАЛЬНОЙ зоне, и то же самое значение у сервера в
// UTC и у гостя во Владивостоке оказывается разными сутками. Строка так себя
// не ведёт: что записали, то и прочитали.
//
// Всё сравнение сводится к минутам. Внутри одних суток хватает `toMin`, между
// разными — `absMin`, которая добавляет к минутам номер дня относительно
// опорной даты. Разворачивать это в миллисекунды незачем: шаг сетки — минуты,
// и точнее нам не нужно.

import { diffDays, type Day } from './dateMath'

/** `HH:mm`, 24 часа. `24:00` допустимо как «конец суток» */
export type Time = string

/** точка на оси: день и время внутри него */
export type Moment = { day: Day; time: Time }

/** занятый отрезок: с точностью до минуты, конец НЕ включается */
export type BusyMoment = {
  from: Moment
  to: Moment
  /** подпись при наведении: кто занял */
  title?: string
}

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n))

/** `HH:mm` → минуты от начала суток. Мусор превращается в 0, а не в NaN */
export function toMin(time: Time): number {
  const [h, m] = time.split(':')
  const hh = Number(h)
  const mm = Number(m)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0
  return hh * 60 + mm
}

/** минуты → `HH:mm`. За сутки не переносим: 1500 минут — это `25:00` */
export function toTime(min: number): Time {
  const safe = Math.max(0, Math.round(min))
  return `${pad2(Math.floor(safe / 60))}:${pad2(safe % 60)}`
}

/**
 * Минуты момента относительно опорного дня. Именно так сравниваются точки из
 * РАЗНЫХ суток: заезд 12 августа 14:00 и выезд 15 августа 12:00 превращаются в
 * два числа, и дальше всё — обычная арифметика.
 */
export const absMin = (m: Moment, base: Day): number => diffDays(base, m.day) * 1440 + toMin(m.time)

/** момент из минут относительно опорного дня */
export function fromAbsMin(min: number, base: Day): Moment {
  const days = Math.floor(min / 1440)
  const rest = min - days * 1440
  // сдвиг дня считаем через ту же арифметику дат, что и везде
  const day = shiftDay(base, days)
  return { day, time: toTime(rest) }
}

/** день + N суток; вынесено, чтобы не тащить сюда весь dateMath */
function shiftDay(day: Day, n: number): Day {
  if (n === 0) return day
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** сколько минут между моментами; отрицательное — конец раньше начала */
export const minutesBetween = (from: Moment, to: Moment): number =>
  absMin(to, from.day) - toMin(from.time)

/** округлить время вниз до шага сетки: 14:07 при шаге 30 → 14:00 */
export const snapTime = (time: Time, step: number): Time =>
  toTime(Math.floor(toMin(time) / step) * step)

/**
 * Слоты одних суток. Конец окна не включается: при окне 09:00–18:00 и шаге 60
 * последний слот — 17:00, потому что слот означает НАЧАЛО отрезка, а не момент
 * времени сам по себе.
 *
 * @param step шаг в минутах; неположительный молча становится 30
 * @param openMin/closeMin рабочее окно в минутах от полуночи
 */
export function slotsOfDay(opts: {
  step: number
  openMin?: number
  closeMin?: number
}): Array<Time> {
  const step = opts.step > 0 ? opts.step : 30
  const open = Math.max(0, opts.openMin ?? 0)
  const close = Math.min(1440, opts.closeMin ?? 1440)
  const out: Array<Time> = []
  for (let m = Math.ceil(open / step) * step; m < close; m += step) out.push(toTime(m))
  return out
}

/** пересекаются ли два отрезка; касание концами пересечением НЕ считается */
export function overlapsMoment(
  a: { from: Moment; to: Moment },
  b: { from: Moment; to: Moment },
): boolean {
  const base = a.from.day
  return absMin(a.from, base) < absMin(b.to, base) && absMin(b.from, base) < absMin(a.to, base)
}

/**
 * Занят ли слот. Слот — это отрезок `[time, time + step)`, а не точка: иначе
 * начало брони, ровно совпавшее с концом соседней, считалось бы занятым.
 */
export function slotBusy(
  day: Day,
  time: Time,
  step: number,
  busy: Array<BusyMoment>,
): BusyMoment | null {
  const slot = { from: { day, time }, to: fromAbsMin(toMin(time) + step, day) }
  return busy.find((b) => overlapsMoment(slot, b)) ?? null
}

/**
 * Докуда можно тянуть от момента, не задев занятое. Нужно, чтобы недостижимые
 * слоты гасли СРАЗУ, а не после клика: «нельзя» без причины бесит сильнее
 * всего.
 */
export function reachToMoment(
  from: Moment,
  busy: Array<BusyMoment>,
  limit: Moment,
): Moment {
  const base = from.day
  const start = toMin(from.time)
  let end = absMin(limit, base)
  for (const b of busy) {
    const bs = absMin(b.from, base)
    // упираемся в ближайшее занятое, которое начинается ПОСЛЕ нас
    if (bs >= start && bs < end) end = bs
  }
  return fromAbsMin(end, base)
}

/**
 * Проверка выбранного отрезка. Возвращает причину словами: её показывают
 * человеку, а не пишут в консоль.
 */
export function checkMomentRange(args: {
  from: Moment
  to: Moment
  busy?: Array<BusyMoment>
  /** минимальная и максимальная длительность, минуты */
  minMinutes?: number
  maxMinutes?: number
  /** раньше этого момента нельзя */
  min?: Moment
  max?: Moment
}): { ok: true } | { ok: false; why: string } {
  const base = args.from.day
  const from = absMin(args.from, base)
  const to = absMin(args.to, base)
  const length = to - from

  if (length <= 0) return { ok: false, why: 'конец раньше начала' }
  if (args.min && from < absMin(args.min, base)) return { ok: false, why: 'слишком рано' }
  if (args.max && to > absMin(args.max, base)) return { ok: false, why: 'слишком поздно' }
  if (args.minMinutes && length < args.minMinutes) {
    return { ok: false, why: `минимум ${fmtLength(args.minMinutes)}` }
  }
  if (args.maxMinutes && length > args.maxMinutes) {
    return { ok: false, why: `максимум ${fmtLength(args.maxMinutes)}` }
  }
  for (const b of args.busy ?? []) {
    if (overlapsMoment({ from: args.from, to: args.to }, b)) {
      return { ok: false, why: b.title ? `занято: ${b.title}` : 'занято' }
    }
  }
  return { ok: true }
}

/** длительность словами: 90 → «1 ч 30 мин», 1440 → «1 сут» */
export function fmtLength(minutes: number): string {
  if (minutes % 1440 === 0) return `${minutes / 1440} сут`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} мин`
  return m ? `${h} ч ${m} мин` : `${h} ч`
}

/** момент словами: «12.08 14:00» — для итоговой строки под календарём */
export const fmtMoment = (m: Moment): string =>
  `${m.day.slice(8, 10)}.${m.day.slice(5, 7)} ${m.time}`
