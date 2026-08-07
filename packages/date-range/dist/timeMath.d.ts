import { type Day } from './dateMath';
/** `HH:mm`, 24 часа. `24:00` допустимо как «конец суток» */
export type Time = string;
/** точка на оси: день и время внутри него */
export type Moment = {
    day: Day;
    time: Time;
};
/** занятый отрезок: с точностью до минуты, конец НЕ включается */
export type BusyMoment = {
    from: Moment;
    to: Moment;
    /** подпись при наведении: кто занял */
    title?: string;
};
/** `HH:mm` → минуты от начала суток. Мусор превращается в 0, а не в NaN */
export declare function toMin(time: Time): number;
/** минуты → `HH:mm`. За сутки не переносим: 1500 минут — это `25:00` */
export declare function toTime(min: number): Time;
/**
 * Минуты момента относительно опорного дня. Именно так сравниваются точки из
 * РАЗНЫХ суток: заезд 12 августа 14:00 и выезд 15 августа 12:00 превращаются в
 * два числа, и дальше всё — обычная арифметика.
 */
export declare const absMin: (m: Moment, base: Day) => number;
/** момент из минут относительно опорного дня */
export declare function fromAbsMin(min: number, base: Day): Moment;
/** сколько минут между моментами; отрицательное — конец раньше начала */
export declare const minutesBetween: (from: Moment, to: Moment) => number;
/** округлить время вниз до шага сетки: 14:07 при шаге 30 → 14:00 */
export declare const snapTime: (time: Time, step: number) => Time;
/**
 * Слоты одних суток. Конец окна не включается: при окне 09:00–18:00 и шаге 60
 * последний слот — 17:00, потому что слот означает НАЧАЛО отрезка, а не момент
 * времени сам по себе.
 *
 * @param step шаг в минутах; неположительный молча становится 30
 * @param openMin/closeMin рабочее окно в минутах от полуночи
 */
export declare function slotsOfDay(opts: {
    step: number;
    openMin?: number;
    closeMin?: number;
}): Array<Time>;
/** пересекаются ли два отрезка; касание концами пересечением НЕ считается */
export declare function overlapsMoment(a: {
    from: Moment;
    to: Moment;
}, b: {
    from: Moment;
    to: Moment;
}): boolean;
/**
 * Занят ли слот. Слот — это отрезок `[time, time + step)`, а не точка: иначе
 * начало брони, ровно совпавшее с концом соседней, считалось бы занятым.
 */
export declare function slotBusy(day: Day, time: Time, step: number, busy: Array<BusyMoment>): BusyMoment | null;
/**
 * Докуда можно тянуть от момента, не задев занятое. Нужно, чтобы недостижимые
 * слоты гасли СРАЗУ, а не после клика: «нельзя» без причины бесит сильнее
 * всего.
 */
export declare function reachToMoment(from: Moment, busy: Array<BusyMoment>, limit: Moment): Moment;
/**
 * Проверка выбранного отрезка. Возвращает причину словами: её показывают
 * человеку, а не пишут в консоль.
 */
export declare function checkMomentRange(args: {
    from: Moment;
    to: Moment;
    busy?: Array<BusyMoment>;
    /** минимальная и максимальная длительность, минуты */
    minMinutes?: number;
    maxMinutes?: number;
    /** раньше этого момента нельзя */
    min?: Moment;
    max?: Moment;
}): {
    ok: true;
} | {
    ok: false;
    why: string;
};
/** длительность словами: 90 → «1 ч 30 мин», 1440 → «1 сут» */
export declare function fmtLength(minutes: number): string;
/** момент словами: «12.08 14:00» — для итоговой строки под календарём */
export declare const fmtMoment: (m: Moment) => string;
