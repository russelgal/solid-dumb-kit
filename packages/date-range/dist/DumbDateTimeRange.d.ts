import { type JSX } from 'solid-js';
import { type Day } from './dateMath';
import { type BusyMoment, type Moment, type Time } from './timeMath';
export type DumbDateTimeRangeProps = {
    /** выбранный период; `null` — ничего не выбрано */
    value: () => {
        from: Moment;
        to: Moment;
    } | null;
    onChange: (next: {
        from: Moment;
        to: Moment;
    } | null) => void;
    /** занятые отрезки: показываются и не дают выбрать */
    busy?: () => Array<BusyMoment>;
    /**
     * Чем выбирать время внутри суток:
     *
     * - `slots` (по умолчанию) — лента слотов шагом `step`. Период тянется
     *   НАЖАТИЕМ И ПРОТЯЖКОЙ по ней, как в календаре: занятое видно сразу, а
     *   свободное окно окидываешь глазами;
     * - `select` — часы и минуты списками (`DumbTimeSelect`). Для мелкого шага,
     *   тесной формы и телефона, где `<select>` даёт родное колесо.
     */
    mode?: 'slots' | 'select';
    /** шаг слотов в минутах; по умолчанию 30 */
    step?: number;
    /**
     * Рабочее окно, минуты от полуночи. Ночь вырезается: у мастера в 03:00
     * записи нет, и показывать этот слот — только мешать.
     */
    openMin?: number;
    closeMin?: number;
    /** предлагать это время, когда день выбран, а слот ещё нет */
    defaultFromTime?: Time;
    defaultToTime?: Time;
    /** минимальная и максимальная длительность, минуты */
    minMinutes?: number;
    maxMinutes?: number;
    /** сколько месяцев показывать разом; по умолчанию 1 */
    months?: number;
    /** раньше этого дня нельзя; по умолчанию с сегодняшнего */
    min?: Day;
    max?: Day;
    /**
     * Своё в углу дня — цена, остаток, что угодно. На КРАЯХ выбранного периода
     * компонент рисует там время заезда и выезда: оно важнее цены ровно в этих
     * двух ячейках, а в остальных остаётся ваше.
     */
    dayExtra?: (day: Day) => JSX.Element;
    /** подписи над слотами; по умолчанию «Заезд» и «Выезд» */
    fromLabel?: string;
    toLabel?: string;
    /** выбрать не вышло: сюда приходит причина */
    onReject?: (why: string) => void;
    class?: string;
    style?: JSX.CSSProperties;
};
export declare function DumbDateTimeRange(props: DumbDateTimeRangeProps): JSX.Element;
