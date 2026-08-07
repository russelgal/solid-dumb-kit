import { type JSX } from 'solid-js';
import { type CloseSideOption } from '@solid-dumb-kit/shared';
export type DumbModalProps = {
    open: () => boolean;
    onClose: () => void;
    /** заголовок; не задан — шапки нет вовсе */
    title?: JSX.Element;
    /** низ окна: кнопки */
    footer?: JSX.Element;
    children: JSX.Element;
    /**
     * Спросить перед закрытием. Вернул `false` — окно остаётся. Сюда вешают
     * «есть несохранённое»: браузер закрывает по Esc молча, и правка теряется.
     */
    onBeforeClose?: () => boolean | Promise<boolean>;
    /** не закрывать по клику на подложку; по умолчанию закрывает */
    keepOnBackdrop?: boolean;
    /** не закрывать по Esc; по умолчанию закрывает */
    keepOnEsc?: boolean;
    /** ширина окна, css; по умолчанию `min(560px, 92vw)` */
    width?: string;
    /**
     * С какой стороны крестик. По умолчанию решает платформа: в macOS слева, в
     * Windows и Linux справа — там, где рука его и ищет.
     */
    closeSide?: CloseSideOption;
    /** анимировать; по умолчанию да, но не при prefers-reduced-motion */
    animate?: boolean;
    class?: string;
    style?: JSX.CSSProperties;
};
export declare function DumbModal(props: DumbModalProps): JSX.Element;
