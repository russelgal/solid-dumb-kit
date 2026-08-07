export { DumbDateRange, type DumbDateRangeProps, type BusySpan } from './DumbDateRange'
export { DumbDateTimeRange, type DumbDateTimeRangeProps } from './DumbDateTimeRange'
export { DumbTimeSelect, type DumbTimeSelectProps } from './DumbTimeSelect'

/**
 * Даты — чистая арифметика над строками `YYYY-MM-DD`. Наружу выложена потому,
 * что проверять занятость и считать ночи потребителю приходится и вне календаря.
 */
export {
  addDays, addMonths, checkRange, daysBetween, diffDays, endOfMonth, inRange, monthGrid,
  orderRange, overlaps, reachTo, sameMonth, startOfMonth, today, toDay, weekday, weekIndex,
  type Day,
} from './dateMath'

/**
 * Время и моменты — та же чистая арифметика, что и у дат: `HH:mm` строкой,
 * сравнение в минутах. Нужна и вне календаря: посчитать занятость на сервере,
 * нарезать слоты своему виджету, проверить период перед записью в базу.
 */
export {
  absMin, checkMomentRange, fmtLength, fmtMoment, fromAbsMin, minutesBetween, overlapsMoment,
  reachToMoment, slotBusy, slotsOfDay, snapTime, toMin, toTime,
  type BusyMoment, type Moment, type Time,
} from './timeMath'
