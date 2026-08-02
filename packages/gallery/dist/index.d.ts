import { JSX } from 'solid-js';

/** чем заливаем: своё дело потребителя, галерея транспорт не выбирает */
type Uploader = (file: File, ctx: {
    /** 0…1; зовётся часто, дёргать состояние на каждый вызов не стоит */
    onProgress: (fraction: number) => void;
    /** отменили — брось запрос */
    signal: AbortSignal;
}) => Promise<UploadResult>;
type UploadResult = {
    /** чем показывать картинку после заливки */
    url: string;
    /** ключ в хранилище — если он нужен потребителю для удаления */
    key?: string;
};
type QueueEvents = {
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
type UploadQueue = {
    /** поставить файл в очередь; id — тот же, что у элемента галереи */
    add: (id: string, file: File) => void;
    /** снять с очереди: ждущего выбросить, идущего прервать */
    cancel: (id: string) => void;
    /** снять всё разом — на размонтировании */
    destroy: () => void;
    /** сколько ещё не доехало: и в работе, и в ожидании */
    pending: () => number;
};
declare function createUploadQueue(upload: Uploader, events?: QueueEvents, 
/** сколько тянуть одновременно; больше шести смысла не имеет */
concurrency?: number): UploadQueue;

type GalleryStatus = 
/** транспорта нет: файл живёт только в браузере */
'local'
/** поставлен в очередь, но ещё не поехал */
 | 'queued' | 'uploading' | 'done' | 'error';
type GalleryItem = {
    id: string;
    /** адрес, по которому картинка живёт «по-настоящему» (после заливки) */
    url: string;
    /** `objectURL` выбранного файла: показывается, пока он есть */
    preview?: string;
    name?: string;
    size?: number;
    status?: GalleryStatus;
    /** 0…1, пока идёт заливка */
    progress?: number;
    error?: string;
    /** ключ в хранилище — приходит из транспорта */
    key?: string;
};
type DumbGalleryProps = {
    items: Array<GalleryItem>;
    /** позвать с новым набором: добавили, переставили, удалили, долилось */
    setItems: (next: Array<GalleryItem>) => void;
    /**
     * Чем заливать. Не задан — галерея локальная: файлы живут в браузере и
     * пропадут с перезагрузкой. Для S3-совместимого хранилища бери
     * `createPresignedUploader`.
     */
    upload?: Uploader;
    /** сколько тянуть одновременно; по умолчанию 3 */
    concurrency?: number;
    /** что пускать в выбор; по умолчанию `image/*` */
    accept?: string;
    /** можно ли выбрать несколько разом; по умолчанию да */
    multiple?: boolean;
    /** больше стольких не принимать; не задан — без предела */
    max?: number;
    /** ширина плитки, css; по умолчанию `minmax(120px, 1fr)` */
    tile?: string;
    /** правка: без неё нет ни выбора, ни перестановки, ни удаления */
    editable?: boolean;
    /** анимировать перестановку; по умолчанию да, но не при prefers-reduced-motion */
    animate?: boolean;
    /** клик по плитке — открыть просмотр, например */
    onOpen?: (item: GalleryItem, index: number) => void;
    /** своя плитка целиком; не задана — рисуем свою */
    children?: (item: GalleryItem, index: () => number) => JSX.Element;
    class?: string;
    style?: JSX.CSSProperties;
};
declare function DumbGallery(props: DumbGalleryProps): JSX.Element;

/** Что должен вернуть твой сервер на просьбу подписать */
type Presigned = {
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
type PresignedOptions = {
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
declare function createPresignedUploader(opts: PresignedOptions): Uploader;

export { DumbGallery, type DumbGalleryProps, type GalleryItem, type GalleryStatus, type Presigned, type PresignedOptions, type QueueEvents, type UploadQueue, type UploadResult, type Uploader, createPresignedUploader, createUploadQueue };
