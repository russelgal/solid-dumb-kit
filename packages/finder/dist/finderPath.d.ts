import type { FinderEntry } from './finderTypes';
/** имя без пути: `a/b/c.jpg` → `c.jpg`, `a/b/` → `b` */
export declare function nameOf(key: string): string;
/** папка, в которой лежит ключ: `a/b/c.jpg` → `a/b/`, `a/` → `` */
export declare function parentOf(key: string): string;
/** приписать имя к префиксу, не наплодив двойных слэшей */
export declare function joinPrefix(prefix: string, name: string): string;
/**
 * Хлебные крошки от корня до текущего места. Корень идёт первым всегда — по
 * нему возвращаются наверх, и он же цель для переноса «в самый верх».
 */
export declare function crumbs(prefix: string, rootLabel?: string): Array<{
    name: string;
    prefix: string;
}>;
/**
 * Можно ли перенести ключ в префикс.
 *
 * Отказов ровно три, и все три — про здравый смысл, а не про хранилище:
 * на место, где он уже лежит; папку внутрь самой себя; папку внутрь своего же
 * потомка (иначе ветка уезжает сама в себя и пропадает).
 */
export declare function canMove(key: string, to: string): boolean;
export type SortKey = 'name' | 'size' | 'modified';
/**
 * Порядок показа. Папки всегда сверху — даже при сортировке по размеру, у
 * которого для папки и значения-то нет; так делает любой файловый менеджер, и
 * ломать привычку незачем.
 *
 * Имена сравниваем `localeCompare` с `numeric`: иначе `файл10` встаёт перед
 * `файл2`, и это замечают сразу.
 */
export declare function sortEntries(entries: Array<FinderEntry>, key?: SortKey, desc?: boolean): Array<FinderEntry>;
export type FileKind = 'image' | 'video' | 'audio' | 'pdf' | 'archive' | 'text' | 'file';
export declare function kindOf(name: string): FileKind;
/** значок по виду файла: эмодзи, чтобы пакет не тащил иконочный шрифт */
export declare const ICONS: Record<FileKind | 'dir', string>;
