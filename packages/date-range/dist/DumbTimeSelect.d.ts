import { type JSX } from 'solid-js';
import type { Day } from './dateMath';
import { type BusyMoment, type Time } from './timeMath';
export type DumbTimeSelectProps = {
    value: () => Time | null;
    onChange: (next: Time) => void;
    /** шаг минут; по умолчанию 30 */
    step?: number;
    /** рабочее окно, минуты от полуночи */
    openMin?: number;
    closeMin?: number;
    /** день, для которого проверяется занятость; без него занятость не смотрим */
    day?: Day;
    busy?: () => Array<BusyMoment>;
    /** подпись слева; не задана — списки идут голыми */
    label?: JSX.Element;
    disabled?: boolean;
    class?: string;
};
export declare function DumbTimeSelect(props: DumbTimeSelectProps): JSX.Element;
