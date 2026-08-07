import { type JSX } from 'solid-js';
export type TreeNode = {
    id: string;
    label: string;
    /** свой класс значка; не задан — берётся из `icons` по виду узла */
    icon?: string;
    /** ветка ли это. Узел с `children` веткой считается и без флага */
    isFolder?: boolean;
    children?: Array<TreeNode>;
    /** мелким справа: счётчик, размер, статус — что угодно */
    badge?: string | number;
    /** строка станет ссылкой; навигацию делает потребитель */
    href?: string;
    /** доп. класс на строку */
    class?: string;
};
/** Классы значков. Кит не завязан на набор — Solar, Phosphor, Lucide, эмодзи. */
export type DumbTreeIcons = {
    /** стрелка ветки; ОДНА на оба состояния — раскрытая поворачивается на 90° */
    twist?: string;
    folder?: string;
    folderOpen?: string;
    leaf?: string;
};
export type DumbTreeProps = {
    /** корни дерева; не заданы — тянем через `loadChildren('')` */
    roots?: Array<TreeNode>;
    /**
     * Содержимое ветки по требованию. Зовётся при первом раскрытии и повторно —
     * когда сменился `refreshKey`.
     */
    loadChildren?: (parentId: string) => Promise<Array<TreeNode>>;
    /** выбранный узел */
    selected?: () => string | null | undefined;
    onSelect?: (node: TreeNode) => void;
    /** правый клик по строке */
    onContextMenu?: (ev: MouseEvent, node: TreeNode) => void;
    /** ключ localStorage для раскрытых веток; не задан — не помним */
    storageKey?: string;
    /** сменился — раскрытые ветки перечитываются */
    refreshKey?: () => number | string;
    /** фильтр по названию: показываем совпавшие и дорогу к ним */
    query?: () => string;
    /** свой матчер; по умолчанию подстрока без учёта регистра */
    match?: (node: TreeNode, query: string) => boolean;
    icons?: DumbTreeIcons;
    /** размер дерева одним кеглем: высота строк и отступы едут следом */
    size?: string;
    /** полосы через строку; по умолчанию есть */
    stripes?: boolean;
    /** свой контент справа в строке (кнопки, бейджи) */
    renderAction?: (node: TreeNode) => JSX.Element;
    /** узел можно тащить: что вернули — то и уедет в `dataTransfer` */
    getDragData?: (node: TreeNode) => {
        type: string;
        id: string;
        label: string;
    } | null;
    class?: string;
    style?: JSX.CSSProperties;
};
export declare function DumbTree(props: DumbTreeProps): JSX.Element;
