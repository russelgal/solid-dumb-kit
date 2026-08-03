import { JSX } from 'solid-js';

type MenuItem = {
    kind: 'separator';
} | {
    kind?: 'item';
    /** что написано */
    label: string;
    /** класс значка — свой набор даёт потребитель */
    icon?: string;
    /** подсказка справа: сочетание клавиш */
    hint?: string;
    disabled?: boolean;
    /** опасный пункт красится и стоит внизу: удаление, сброс */
    danger?: boolean;
    run: () => void;
};
type DumbContextMenuProps = {
    /** пункты; пересчитываются на каждое открытие — можно зависеть от выделения */
    items: () => Array<MenuItem>;
    /** внутри чего ловим правый клик; не задан — весь документ */
    target?: () => HTMLElement | null;
    /** не открывать: правый клик по полю ввода лучше отдать браузеру */
    disabled?: () => boolean;
    /** меню открылось/закрылось */
    onToggle?: (open: boolean) => void;
    class?: string;
};
declare function DumbContextMenu(props: DumbContextMenuProps): JSX.Element;

type DumbPopoverProps = {
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
    class?: string;
};
declare function DumbPopover(props: DumbPopoverProps): JSX.Element;

export { DumbContextMenu, type DumbContextMenuProps, DumbPopover, type DumbPopoverProps, type MenuItem };
