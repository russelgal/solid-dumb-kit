// Даты — чистая арифметика, без DOM и без фреймворка.
//
// Дата ЗДЕСЬ — это строка `YYYY-MM-DD`, а не `Date`. Причина простая и злая:
// `Date` — это момент времени в часовом поясе, и «первое июня» у пользователя в
// Калининграде и на сервере в UTC оказываются разными сутками. В бронировании
// это ошибка ценой в номер: заезд уезжает на день.
//
// Все функции ниже работают со строками и с UTC внутри — так суток ровно
// столько, сколько на календаре.

/** `YYYY-MM-DD` */
export type Day = string

const MS = 86_400_000

export const toDay = (d: Date): Day => d.toISOString().slice(0, 10)

/** полночь UTC этих суток */
export const dayToDate = (day: Day): Date => new Date(`${day}T00:00:00Z`)

export const addDays = (day: Day, n: number): Day => toDay(new Date(dayToDate(day).getTime() + n * MS))

/** сколько суток между датами; отрицательное, если вторая раньше */
export const diffDays = (a: Day, b: Day): number =>
  Math.round((dayToDate(b).getTime() - dayToDate(a).getTime()) / MS)

export const today = (): Day => toDay(new Date())

/** 0 — воскресенье, как в JS; для календаря с понедельника см. `weekIndex` */
export const weekday = (day: Day): number => dayToDate(day).getUTCDay()

/** позиция дня в неделе, начинающейся с понедельника: пн=0 … вс=6 */
export const weekIndex = (day: Day): number => (weekday(day) + 6) % 7

export const startOfMonth = (day: Day): Day => `${day.slice(0, 7)}-01`

export function endOfMonth(day: Day): Day {
  const d = dayToDate(startOfMonth(day))
  d.setUTCMonth(d.getUTCMonth() + 1)
  return toDay(new Date(d.getTime() - MS))
}

export const addMonths = (day: Day, n: number): Day => {
  const d = dayToDate(startOfMonth(day))
  d.setUTCMonth(d.getUTCMonth() + n)
  return toDay(d)
}

/**
 * Сетка месяца: полные недели с понедельника, включая хвосты соседних месяцев.
 * Всегда 6 рядов по 7 дней — чтобы календарь не прыгал по высоте при
 * переключении месяцев, а это единственное, что в нём раздражает.
 */
export function monthGrid(month: Day): Array<Day> {
  const first = startOfMonth(month)
  const start = addDays(first, -weekIndex(first))
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export const sameMonth = (a: Day, b: Day): boolean => a.slice(0, 7) === b.slice(0, 7)

/** диапазон в правильном порядке: тянуть можно в любую сторону */
export function orderRange(a: Day, b: Day): [Day, Day] {
  return diffDays(a, b) < 0 ? [b, a] : [a, b]
}

export const inRange = (day: Day, from: Day | null, to: Day | null): boolean =>
  !!from && !!to && diffDays(from, day) >= 0 && diffDays(day, to) >= 0

/** все дни диапазона включительно */
export function daysBetween(from: Day, to: Day): Array<Day> {
  const n = diffDays(from, to)
  if (n < 0) return []
  return Array.from({ length: n + 1 }, (_, i) => addDays(from, i))
}

/**
 * Пересекается ли выбранный отрезок с занятым. Границы СМЫКАЮТСЯ: в гостинице
 * выезд и заезд в один день — это не пересечение, номер освобождается утром.
 * Отсюда строгие неравенства.
 */
export const overlaps = (
  a: { from: Day; to: Day },
  b: { from: Day; to: Day },
): boolean => diffDays(a.from, b.to) > 0 && diffDays(b.from, a.to) > 0

/**
 * Можно ли выбрать отрезок: не задевает ли занятое и хватает ли длины.
 * Возвращает причину отказа — её показывают человеку, а не глотают.
 */
export function checkRange(args: {
  from: Day
  to: Day
  busy?: Array<{ from: Day; to: Day }>
  minNights?: number
  maxNights?: number
  /** раньше этого дня нельзя */
  min?: Day
  max?: Day
}): { ok: true } | { ok: false; why: string } {
  const nights = diffDays(args.from, args.to)
  if (nights < 0) return { ok: false, why: 'конец раньше начала' }
  if (args.min && diffDays(args.min, args.from) < 0) return { ok: false, why: 'слишком рано' }
  if (args.max && diffDays(args.to, args.max) < 0) return { ok: false, why: 'слишком поздно' }
  if (args.minNights && nights < args.minNights) {
    return { ok: false, why: `минимум ${args.minNights} ноч.` }
  }
  if (args.maxNights && nights > args.maxNights) {
    return { ok: false, why: `максимум ${args.maxNights} ноч.` }
  }
  for (const b of args.busy ?? []) {
    if (overlaps({ from: args.from, to: args.to }, b)) return { ok: false, why: 'занято' }
  }
  return { ok: true }
}

/**
 * Докуда можно тянуть от выбранной даты, не задев занятое. Нужно, чтобы
 * подсветить недостижимые дни СРАЗУ, а не ругаться после клика.
 */
export function reachTo(from: Day, busy: Array<{ from: Day; to: Day }>, limit: Day): Day {
  let end = limit
  for (const b of busy) {
    // занятое, начинающееся после нашей даты, обрезает предел
    if (diffDays(from, b.from) > 0 && diffDays(b.from, end) >= 0) end = b.from
  }
  return end
}
