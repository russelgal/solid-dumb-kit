export { DumbDateRange, type DumbDateRangeProps, type BusySpan } from './DumbDateRange'

/**
 * Даты — чистая арифметика над строками `YYYY-MM-DD`. Наружу выложена потому,
 * что проверять занятость и считать ночи потребителю приходится и вне календаря.
 */
export {
  addDays, addMonths, checkRange, daysBetween, diffDays, endOfMonth, inRange, monthGrid,
  orderRange, overlaps, reachTo, sameMonth, startOfMonth, today, toDay, weekday, weekIndex,
  type Day,
} from './dateMath'
