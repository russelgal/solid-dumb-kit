import { type JSX } from 'solid-js';
import { type CloseSideOption } from '@solid-dumb-kit/shared';
import { type Toast, type ToastBus } from './toast';
export type DumbToastCenterProps = {
    /** своя шина; не задана — общая */
    bus?: ToastBus;
    /** у какого края; по умолчанию справа, как в macOS */
    side?: 'right' | 'left';
    /** заголовок панели */
    title?: string;
    /** рисовать ли кнопку-колокольчик; не нужна — открывай `toast.showHistory()` */
    bell?: boolean;
    /** анимировать выезд; не задано — да, но с оглядкой на prefers-reduced-motion */
    animate?: boolean;
    /** сторона крестиков; по умолчанию по платформе: macOS слева, иначе справа */
    closeSide?: CloseSideOption;
    /** своя строка истории */
    children?: (t: Toast, forget: () => void) => JSX.Element;
    class?: string;
};
/**
 * «5 мин», «2 ч», «вчера». Считается от переданного «сейчас», а не от
 * `Date.now()` внутри: панель обновляет время раз в полминуты одним сигналом,
 * а не каждой строкой по своему таймеру.
 */
export declare function ago(time: number, now: number): string;
export declare function DumbToastCenter(props: DumbToastCenterProps): JSX.Element;
