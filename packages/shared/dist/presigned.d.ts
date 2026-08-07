import type { Uploader, UploadResult } from './uploadQueue';
/** Что должен вернуть твой сервер на просьбу подписать */
export type Presigned = {
    /** куда класть — подписанная ссылка */
    url: string;
    /** каким методом; по умолчанию PUT */
    method?: 'PUT' | 'POST';
    /** заголовки, вошедшие в подпись: их обязательно повторить один в один */
    headers?: Record<string, string>;
    /** ключ объекта в бакете — вернётся потребителю как есть */
    key?: string;
    /** по какому адресу файл будет виден потом; не задан — берём `url` без query */
    publicUrl?: string;
};
export type PresignedOptions = {
    /**
     * Спросить у своего сервера подпись. Единственное место, где галерея ходит
     * наружу за чем-то, кроме самого файла.
     */
    sign: (file: File) => Promise<Presigned>;
};
/**
 * Транспорт для `DumbGallery`: спрашивает подпись, кладёт файл по ней,
 * отдаёт публичный адрес.
 */
export declare function createPresignedUploader(opts: PresignedOptions): Uploader;
/**
 * Положить файл по подписанной ссылке, показывая прогресс. Отдельно от
 * `createPresignedUploader`, потому что подпись просят по-разному: галерее
 * хватает файла, файндеру нужен ещё и префикс, куда класть.
 */
export declare function putWithProgress(file: File, p: Presigned, ctx: {
    onProgress: (f: number) => void;
    signal: AbortSignal;
}): Promise<UploadResult>;
