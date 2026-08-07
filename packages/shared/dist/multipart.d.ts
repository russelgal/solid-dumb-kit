export type MultipartHandshake = {
    /** идентификатор заливки от хранилища */
    uploadId: string;
    /** ключ объекта */
    key: string;
};
export type MultipartOptions = {
    /** начать: вернуть `uploadId` и ключ */
    begin: (file: File, prefix: string) => Promise<MultipartHandshake>;
    /** подписать один кусок; номера с ЕДИНИЦЫ, так требует S3 */
    signPart: (h: MultipartHandshake, partNumber: number) => Promise<string>;
    /** собрать объект из кусков */
    complete: (h: MultipartHandshake, parts: Array<UploadedPart>) => Promise<void>;
    /** выбросить недособранное */
    abort: (h: MultipartHandshake) => Promise<void>;
    /**
     * Размер куска, байт. По умолчанию 8 МиБ: у S3 минимум 5 МиБ на все куски,
     * кроме последнего, а мельче — это лишние подписи и лишние запросы.
     */
    partSize?: number;
    /** сколько кусков слать разом; по умолчанию 3 */
    concurrency?: number;
};
export type UploadedPart = {
    partNumber: number;
    /** ETag куска — по нему хранилище собирает объект */
    etag: string;
};
/**
 * Залить файл частями. Прогресс общий по файлу, а не по кускам: считаем
 * отданные байты каждого куска и делим на размер файла.
 */
export declare function uploadMultipart(file: File, ctx: {
    prefix: string;
    onProgress: (fraction: number) => void;
    signal: AbortSignal;
}, opts: MultipartOptions): Promise<{
    key: string;
}>;
/** стоит ли лить частями: мелкие файлы этого не окупают */
export declare const shouldSplit: (file: File, partSize?: number) => boolean;
