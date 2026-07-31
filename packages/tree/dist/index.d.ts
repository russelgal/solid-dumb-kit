import { JSX } from 'solid-js';

type DumbTreeNode = {
    id: number | string;
    parent: number | string;
    title: string;
    /** порядок среди соседей (для сортировки «по индексу») */
    index?: number;
    /** доп. строка для поиска/тултипа (бренд категории и т.п.) */
    meta?: string | null;
};
type Id = number | string;
type DumbTreeIcons = {
    /** папка свёрнута */
    folder: string;
    /** папка раскрыта */
    folderOpen: string;
    /** лист (flat-режим / узел без детей) */
    leaf: string;
    /** стрелка раскрытой папки */
    expanded: string;
    /** стрелка свёрнутой папки */
    collapsed: string;
    search: string;
    sortIndex: string;
    sortName: string;
    dragHandle: string;
};
type DumbTreeLabels = Partial<{
    search: string;
    sortIndex: string;
    sortName: string;
}>;
type DumbTreeProps<T extends DumbTreeNode> = {
    /** плоский массив узлов (иерархия по parent). undefined → спиннер загрузки */
    nodes?: Array<T>;
    /** заголовок сайдбара */
    title?: string;
    /** активный (выбранный) id — реактивный аксессор */
    activeId?: () => Id | null | undefined;
    /** клик по строке */
    onSelect?: (id: T['id'], node: T) => void;
    /** плоский список без иерархии/сворачивания */
    flat?: boolean;
    /** скрыть поле поиска */
    hideSearch?: boolean;
    placeholder?: string;
    /** свой матчер поиска (по умолчанию fuzzy по title/meta/id) */
    match?: (node: T, query: string) => boolean;
    /** скрыть тоггл сортировки и держать порядок строго по index */
    hideSort?: boolean;
    /** локаль для сравнения названий (по умолчанию — браузерная) */
    locale?: string;
    /** ключ localStorage для раскрытых папок и режима сортировки */
    storageKey?: string;
    /** drag-reorder flat-списка: переставить from→to в порядке отображения */
    sortable?: (from: number, to: number) => void;
    /** анимировать перестановку; по умолчанию да, но не при prefers-reduced-motion */
    animate?: boolean;
    /** доп. контент справа в строке (бейджи/иконки статуса) */
    rowExtra?: (node: T) => JSX.Element;
    /** доп. класс на строку-ссылку (напр. opacity-50 для скрытых) */
    rowClass?: (node: T) => string | undefined;
    /** доп. класс на текст строки (напр. line-through) */
    titleClass?: (node: T) => string | undefined;
    /** свой tooltip строки (по умолчанию «title · meta · id N») */
    rowTitle?: (node: T) => string;
    /** доп. класс на корневой <aside> */
    class?: string;
    /** классы иконок (обязательно — кит не несёт свой набор) */
    icons: DumbTreeIcons;
    labels?: DumbTreeLabels;
};
declare function DumbTree<T extends DumbTreeNode>(props: DumbTreeProps<T>): JSX.Element;

export { DumbTree, type DumbTreeIcons, type DumbTreeLabels, type DumbTreeNode, type DumbTreeProps };
