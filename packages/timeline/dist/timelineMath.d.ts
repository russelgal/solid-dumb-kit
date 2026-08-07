/** `YYYY-MM-DD` — строка, а не `Date`: часовые пояса сдвигают сутки */
export type Day = string;
/** Отрезок на шахматке. Моменты — `YYYY-MM-DD` или `YYYY-MM-DDTHH:mm`. */
export type Span = {
    id: string;
    /** в какой строке */
    row: string;
    from: string;
    /** конец: у суточной брони это день выезда */
    to: string;
};
/**
 * Сколько КАЛЕНДАРНЫХ суток между датами. Время игнорируется намеренно: это
 * «сколько ночей», а не «сколько часов».
 *
 * `PlainDate` не знает часовых поясов — значит переход на летнее время и
 * прочая зонная механика тут не существуют в принципе, а не «не мешают».
 */
export declare const daysApart: (a: Day, b: Day) => number;
/** сдвинуть дату на N суток */
export declare const shiftDay: (day: Day, n: number) => Day;
