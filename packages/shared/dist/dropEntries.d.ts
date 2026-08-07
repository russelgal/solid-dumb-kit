/** файл вместе с путём внутри брошенной папки */
export type DroppedFile = {
    file: File;
    /**
     * Путь относительно места броска: `фото/2026/море.jpg`. У файла, брошенного
     * поодиночке, — просто имя.
     */
    path: string;
};
/**
 * Разобрать брошенное в плоский список файлов с путями.
 *
 * Зовётся ПРЯМО в обработчике `drop`, без `await` перед ней:
 *
 * ```ts
 * onDrop={(ev) => {
 *   ev.preventDefault()
 *   readDropEntries(ev.dataTransfer).then((files) => …)
 * }}
 * ```
 *
 * Папок в браузере может не оказаться (Safari до 11.1, старый Firefox) — тогда
 * возвращаются обычные файлы, без путей. Это не ошибка, это меньше данных.
 */
export declare function readDropEntries(dt: DataTransfer | null): Promise<Array<DroppedFile>>;
/** есть ли в брошенном хоть одна папка — чтобы предупредить, что будет долго */
export declare function hasDirectories(dt: DataTransfer | null): boolean;
