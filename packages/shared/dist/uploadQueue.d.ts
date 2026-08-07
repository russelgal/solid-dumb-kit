/** чем заливаем: своё дело потребителя, галерея транспорт не выбирает */
export type Uploader = (file: File, ctx: {
    /** 0…1; зовётся часто, дёргать состояние на каждый вызов не стоит */
    onProgress: (fraction: number) => void;
    /** отменили — брось запрос */
    signal: AbortSignal;
}) => Promise<UploadResult>;
export type UploadResult = {
    /** чем показывать картинку после заливки */
    url: string;
    /** ключ в хранилище — если он нужен потребителю для удаления */
    key?: string;
};
export type QueueEvents = {
    /**
     * Заливка ФАКТИЧЕСКИ началась, а не просто встала в очередь.
     *
     * Без этого события все поставленные файлы показывались бы «идущими», из
     * которых реально едет только часть, — то самое враньё, ради которого
     * очередь и заводилась.
     */
    onStart?: (id: string) => void;
    onProgress?: (id: string, fraction: number) => void;
    onDone?: (id: string, result: UploadResult) => void;
    onError?: (id: string, message: string) => void;
};
export type UploadQueue = {
    /** поставить файл в очередь; id — тот же, что у элемента галереи */
    add: (id: string, file: File) => void;
    /** снять с очереди: ждущего выбросить, идущего прервать */
    cancel: (id: string) => void;
    /** снять всё разом — на размонтировании */
    destroy: () => void;
    /** сколько ещё не доехало: и в работе, и в ожидании */
    pending: () => number;
};
export declare function createUploadQueue(upload: Uploader, events?: QueueEvents, 
/** сколько тянуть одновременно; больше шести смысла не имеет */
concurrency?: number): UploadQueue;
