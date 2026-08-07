import { type JSX } from 'solid-js';
import { type CloseSideOption } from '@solid-dumb-kit/shared';
import { type Toast, type ToastBus } from './toast';
export type DumbToasterProps = {
    /** своя шина; не задана — общая */
    bus?: ToastBus;
    /** где показывать; по умолчанию снизу справа */
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
    /**
     * Больше стольких сразу не показывать; по умолчанию 6. Остальные ждут в
     * очереди и всплывают по мере того, как гаснут предыдущие.
     */
    max?: number;
    /**
     * С какой стороны крестик. По умолчанию решает платформа: в macOS слева, в
     * Windows и Linux справа.
     */
    closeSide?: CloseSideOption;
    /**
     * Анимировать: въезд плашки, улёт в историю и доводку соседей на
     * освободившееся место. Не задано — да, но молча выключается при системном
     * prefers-reduced-motion.
     */
    animate?: boolean;
    /** своя плашка */
    children?: (t: Toast, dismiss: () => void) => JSX.Element;
    class?: string;
};
export declare function DumbToaster(props: DumbToasterProps): JSX.Element;
