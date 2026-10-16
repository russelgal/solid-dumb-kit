import type { JSX } from '@solidjs/web';
import { type Day } from './dateMath';
export type BusySpan = {
    from: Day;
    to: Day;
    /** подпись при наведении: кто занял */
    title?: string;
    /** свой класс — раскрасить по типу брони */
    class?: string;
};
export type DumbDateRangeProps = {
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
    /**
     * Крайние месяцы — по краям периода: первый показывает месяц `from`,
     * последний — месяц `to`, у каждого свои стрелки. Нужно, когда период
     * длинный («с начала года»): подряд от `from` его конца не видно.
     * Работает при `months` от двух; по умолчанию месяцы идут подряд.
     */
    spread?: boolean;
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
export declare function DumbDateRange(props: DumbDateRangeProps): JSX.Element;
