export { DumbTimeline, type DumbTimelineProps, type TimelineRow } from './DumbTimeline'

/** Тип отрезка и календарные сутки — всё, что не зависит от шкалы. */
export { daysApart, shiftDay, type Day, type Span } from './timelineMath'

/**
 * Шкала времени и вся геометрия шахматки. Сутки — её частный случай:
 * гостиница (колонка = сутки, заезд 16:00), баня (почасовая сетка, зазор на
 * уборку), беседка (день с 12 до 23, ночи на сетке нет). Готовые наборы — в
 * `SCALES`.
 *
 * Эти же функции стоит звать на сервере, когда проверяешь занятость: тогда
 * ответ совпадёт с тем, что человек видит на экране.
 */
export {
  SCALES,
  clampEdge,
  closesAtNight,
  columns,
  confined,
  conflicts,
  dayBounds,
  rowBounds,
  floorsPerRow,
  fromX,
  headGroups,
  lengthOf,
  minLength,
  minutesOf,
  momentX,
  moveTo,
  snapEdge,
  snapOf,
  stackFloors,
  toMinutes,
  toMoment,
  toX,
  totalCols,
  type Moment,
  type RowRules,
  type Scale,
} from './scale'
