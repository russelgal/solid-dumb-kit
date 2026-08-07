import { type JSX } from 'solid-js';
export type MenuItem = {
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
    /**
     * Вложенное меню. Пункт с `items` раскрывает подменю вбок и сам ничего не
     * делает — `run` у него не нужен и не вызывается. Вложенность любая:
     * панель рекурсивна.
     */
    items?: Array<MenuItem>;
    run?: () => void;
};
export type DumbContextMenuProps = {
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
export declare function DumbContextMenu(props: DumbContextMenuProps): JSX.Element;
