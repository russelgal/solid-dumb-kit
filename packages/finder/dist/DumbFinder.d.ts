import { type JSX } from 'solid-js';
import { type FileKind } from './finderPath';
import type { FinderEntry, FinderSource } from './finderTypes';
export type FinderView = 'grid' | 'list';
export type DumbFinderProps = {
    /** чем говорить с хранилищем */
    source: FinderSource;
    /** открытая папка; не задан — файндер водит себя сам, начиная с корня */
    path?: string;
    onPathChange?: (prefix: string) => void;
    /** выделенные ключи; не задан — держит у себя */
    selected?: Set<string>;
    onSelectionChange?: (keys: Set<string>) => void;
    /** плитками или списком; не задан — плитками, переключатель в тулбаре */
    view?: FinderView;
    onViewChange?: (view: FinderView) => void;
    /** что пускать в выбор файлов; по умолчанию всё */
    accept?: string;
    /** сколько файлов тянуть одновременно; по умолчанию 3 */
    concurrency?: number;
    /** как называется корень в крошках; по умолчанию «Всё» */
    rootLabel?: string;
    /** ширина плитки, css-трек; по умолчанию `minmax(132px, 1fr)` */
    tile?: string;
    /** высота области с файлами; по умолчанию `60vh` */
    height?: string;
    /** дерево папок слева; по умолчанию есть */
    sidebar?: boolean;
    /** ширина дерева, css; по умолчанию `265px` */
    sidebarWidth?: string;
    /** ключ localStorage для раскрытых веток дерева; по умолчанию `dumb-finder` */
    treeKey?: string;
    /**
     * Значки видов файлов — CSS-КЛАССЫ, а не разметка: свой набор (Solar,
     * Phosphor, Lucide) выбирает потребитель, и его же Tailwind/iconify собирает
     * из этих строк CSS. Не задан — рисуем эмодзи, чтобы пакет работал и без
     * иконочного набора вовсе.
     */
    icons?: Partial<Record<FileKind | 'dir' | 'dirOpen' | 'twist' | 'refresh' | 'viewGrid' | 'viewList' | 'mkdir' | 'upload' | 'remove' | 'undo', string>>;
    /**
     * Правка. Без неё файндер только смотрит: ни заливки, ни удаления, ни
     * переноса — даже если `source` всё это умеет.
     */
    editable?: boolean;
    /** двойной клик по файлу (по папке файндер ходит сам) */
    onOpen?: (entry: FinderEntry) => void;
    /** сорвалось: не смогли перечислить, залить, удалить, перенести */
    onError?: (message: string) => void;
    /** своя плитка целиком; не задана — рисуем свою */
    children?: (entry: FinderEntry, ctx: {
        selected: boolean;
        view: FinderView;
    }) => JSX.Element;
    class?: string;
    style?: JSX.CSSProperties;
};
export declare function DumbFinder(props: DumbFinderProps): JSX.Element;
