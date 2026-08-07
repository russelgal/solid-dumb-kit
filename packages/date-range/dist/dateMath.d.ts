/** `YYYY-MM-DD` */
export type Day = string;
export declare const toDay: (d: Date) => Day;
/** полночь UTC этих суток */
export declare const dayToDate: (day: Day) => Date;
export declare const addDays: (day: Day, n: number) => Day;
/** сколько суток между датами; отрицательное, если вторая раньше */
export declare const diffDays: (a: Day, b: Day) => number;
export declare const today: () => Day;
/** 0 — воскресенье, как в JS; для календаря с понедельника см. `weekIndex` */
export declare const weekday: (day: Day) => number;
/** позиция дня в неделе, начинающейся с понедельника: пн=0 … вс=6 */
export declare const weekIndex: (day: Day) => number;
export declare const startOfMonth: (day: Day) => Day;
export declare function endOfMonth(day: Day): Day;
export declare const addMonths: (day: Day, n: number) => Day;
/**
 * Сетка месяца: полные недели с понедельника, включая хвосты соседних месяцев.
 * Всегда 6 рядов по 7 дней — чтобы календарь не прыгал по высоте при
 * переключении месяцев, а это единственное, что в нём раздражает.
 */
export declare function monthGrid(month: Day): Array<Day>;
export declare const sameMonth: (a: Day, b: Day) => boolean;
/** диапазон в правильном порядке: тянуть можно в любую сторону */
export declare function orderRange(a: Day, b: Day): [Day, Day];
export declare const inRange: (day: Day, from: Day | null, to: Day | null) => boolean;
/** все дни диапазона включительно */
export declare function daysBetween(from: Day, to: Day): Array<Day>;
/**
 * Пересекается ли выбранный отрезок с занятым. Границы СМЫКАЮТСЯ: в гостинице
 * выезд и заезд в один день — это не пересечение, номер освобождается утром.
 * Отсюда строгие неравенства.
 */
export declare const overlaps: (a: {
    from: Day;
    to: Day;
}, b: {
    from: Day;
    to: Day;
}) => boolean;
/**
 * Можно ли выбрать отрезок: не задевает ли занятое и хватает ли длины.
 * Возвращает причину отказа — её показывают человеку, а не глотают.
 */
export declare function checkRange(args: {
    from: Day;
    to: Day;
    busy?: Array<{
        from: Day;
        to: Day;
    }>;
    minNights?: number;
    maxNights?: number;
    /** раньше этого дня нельзя */
    min?: Day;
    max?: Day;
}): {
    ok: true;
} | {
    ok: false;
    why: string;
};
/**
 * Докуда можно тянуть от выбранной даты, не задев занятое. Нужно, чтобы
 * подсветить недостижимые дни СРАЗУ, а не ругаться после клика.
 */
export declare function reachTo(from: Day, busy: Array<{
    from: Day;
    to: Day;
}>, limit: Day): Day;
