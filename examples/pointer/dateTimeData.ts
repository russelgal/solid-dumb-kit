// Данные для витрины DumbDateTimeRange: сняты с рабочего стенда
// (`scripts/pull-timeline.mjs`) и обезличены — имена гостей заменены номерами
// броней, телефоны вычищены, цены и режим заселения оставлены как есть.
//
// Лежат отдельно от примера, чтобы тот оставался про КОМПОНЕНТ, а не про
// гостиничный прайс. Обновить: перезапустить скрипт и поправить числа здесь.

import { addDays, today, weekday, type BusyMoment, type Day } from '@solid-dumb-kit/date-range'

const T = today()

/**
 * Занятость домика. Даты сдвинуты относительно сегодняшнего дня, иначе пример
 * протухнет через месяц.
 *
 * Третья и четвёртая записи — СТЫК: гость выезжает в 12:00, следующий заезжает
 * в 16:00 того же дня. Касание концами пересечением не считается, поэтому день
 * и занят, и свободен одновременно — как в жизни.
 */
export const HOTEL_BUSY: Array<BusyMoment> = [
  { from: { day: addDays(T, 4), time: '16:00' }, to: { day: addDays(T, 5), time: '12:00' }, title: 'Бронь №9163' },
  { from: { day: addDays(T, 11), time: '16:00' }, to: { day: addDays(T, 13), time: '12:00' }, title: 'Бронь №9184' },
  { from: { day: addDays(T, 13), time: '16:00' }, to: { day: addDays(T, 14), time: '12:00' }, title: 'Бронь №9207' },
  // ремонт — такая же занятость, только без гостя
  { from: { day: addDays(T, 21), time: '00:00' }, to: { day: addDays(T, 23), time: '00:00' }, title: 'Ремонт' },
]

/** цена ночи: будни 28 000, пятница и суббота 34 000 — как на стенде */
export const priceOf = (day: Day) => (weekday(day) === 5 || weekday(day) === 6 ? 34000 : 28000)

/** переговорная: два совещания сегодня и одно завтра */
export const ROOM_BUSY: Array<BusyMoment> = [
  { from: { day: T, time: '11:30' }, to: { day: T, time: '13:00' }, title: 'Планёрка' },
  { from: { day: T, time: '16:00' }, to: { day: T, time: '17:30' }, title: 'Демо клиенту' },
  { from: { day: addDays(T, 1), time: '10:00' }, to: { day: addDays(T, 1), time: '12:00' }, title: 'Собеседование' },
]
