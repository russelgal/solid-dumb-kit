import { JSX } from 'solid-js';

/** `YYYY-MM-DD` */
type Day = string;
declare const toDay: (d: Date) => Day;
declare const addDays: (day: Day, n: number) => Day;
/** сколько суток между датами; отрицательное, если вторая раньше */
declare const diffDays: (a: Day, b: Day) => number;
declare const today: () => Day;
/** 0 — воскресенье, как в JS; для календаря с понедельника см. `weekIndex` */
declare const weekday: (day: Day) => number;
/** позиция дня в неделе, начинающейся с понедельника: пн=0 … вс=6 */
declare const weekIndex: (day: Day) => number;
declare const startOfMonth: (day: Day) => Day;
declare function endOfMonth(day: Day): Day;
declare const addMonths: (day: Day, n: number) => Day;
/**
 * Сетка месяца: полные недели с понедельника, включая хвосты соседних месяцев.
 * Всегда 6 рядов по 7 дней — чтобы календарь не прыгал по высоте при
 * переключении месяцев, а это единственное, что в нём раздражает.
 */
declare function monthGrid(month: Day): Array<Day>;
declare const sameMonth: (a: Day, b: Day) => boolean;
/** диапазон в правильном порядке: тянуть можно в любую сторону */
declare function orderRange(a: Day, b: Day): [Day, Day];
declare const inRange: (day: Day, from: Day | null, to: Day | null) => boolean;
/** все дни диапазона включительно */
declare function daysBetween(from: Day, to: Day): Array<Day>;
/**
 * Пересекается ли выбранный отрезок с занятым. Границы СМЫКАЮТСЯ: в гостинице
 * выезд и заезд в один день — это не пересечение, номер освобождается утром.
 * Отсюда строгие неравенства.
 */
declare const overlaps: (a: {
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
declare function checkRange(args: {
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
declare function reachTo(from: Day, busy: Array<{
    from: Day;
    to: Day;
}>, limit: Day): Day;

type BusySpan = {
    from: Day;
    to: Day;
    /** подпись при наведении: кто занял */
    title?: string;
    /** свой класс — раскрасить по типу брони */
    class?: string;
};
type DumbDateRangeProps = {
    /** выбранный период; для одиночной даты `to === from` */
    value: () => {
        from: Day;
        to: Day;
    } | null;
    onChange: (next: {
        from: Day;
        to: Day;
    } | null) => void;
    /** одна дата вместо периода */
    single?: boolean;
    /** занятые отрезки: показываются и не дают выбрать */
    busy?: () => Array<BusySpan>;
    /** праздники и выходные — подсветить, но выбирать можно */
    marks?: () => Record<Day, {
        title?: string;
        class?: string;
    }>;
    /** сколько месяцев показывать разом; по умолчанию 1 */
    months?: number;
    /** раньше этого дня нельзя; по умолчанию без предела */
    min?: Day;
    max?: Day;
    minNights?: number;
    maxNights?: number;
    /** цена или что угодно в углу дня */
    dayExtra?: (day: Day) => JSX.Element;
    /** выбрать не вышло: сюда приходит причина */
    onReject?: (why: string) => void;
    class?: string;
};
declare function DumbDateRange(props: DumbDateRangeProps): JSX.Element;

export { type BusySpan, type Day, DumbDateRange, type DumbDateRangeProps, addDays, addMonths, checkRange, daysBetween, diffDays, endOfMonth, inRange, monthGrid, orderRange, overlaps, reachTo, sameMonth, startOfMonth, toDay, today, weekIndex, weekday };
