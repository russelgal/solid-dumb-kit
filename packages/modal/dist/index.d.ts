import { JSX } from 'solid-js';

type DumbModalProps = {
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
    /** анимировать; по умолчанию да, но не при prefers-reduced-motion */
    animate?: boolean;
    class?: string;
    style?: JSX.CSSProperties;
};
declare function DumbModal(props: DumbModalProps): JSX.Element;

export { DumbModal, type DumbModalProps };
