import { type JSX } from 'solid-js';
import { type CloseSideOption } from '@solid-dumb-kit/shared';
export type DumbPopoverProps = {
    /** где показать; `null` — закрыт */
    at: () => {
        x: number;
        y: number;
    } | null;
    onClose: () => void;
    children: JSX.Element;
    /** заголовок; не задан — шапки нет */
    title?: JSX.Element;
    /** низ карточки: кнопки */
    footer?: JSX.Element;
    /** не закрывать по клику мимо */
    keepOnOutside?: boolean;
    /** ширина, css; по умолчанию `min(320px, 92vw)` */
    width?: string;
    /** сторона крестика; по умолчанию по платформе: macOS слева, иначе справа */
    closeSide?: CloseSideOption;
    class?: string;
};
export declare function DumbPopover(props: DumbPopoverProps): JSX.Element;
